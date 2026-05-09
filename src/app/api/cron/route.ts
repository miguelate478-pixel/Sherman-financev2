import { NextRequest } from 'next/server';
import { getAllCompanies, getCredentialByCompany, createAuditLog, createDocument, findDocumentById } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { getSunatProvider } from '@/lib/providers/sunat';
import { runAlertas } from '@/lib/alerts';

export async function GET(req: NextRequest) {
  // Verificar secret para que solo Railway pueda llamarlo
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  // Mes anterior: si estamos en mayo 2026, descargamos abril 2026
  let year  = now.getFullYear();
  let month = now.getMonth(); // getMonth() = 0-11, mes actual es getMonth()+1
  if (month === 0) { month = 12; year -= 1; }
  const period = `${year}-${String(month).padStart(2, '0')}`;

  console.log(`[CRON] Iniciando descarga automática período: ${period}`);

  const companies = await getAllCompanies();
  const results: Record<string, unknown>[] = [];

  for (const companyRaw of companies) {
    const company = companyRaw as Record<string, unknown>;
    if (company.status !== 'activo') continue;
    try {
      const cred = await getCredentialByCompany(company.id as string);
      if (!cred || cred.status !== 'verified') {
        console.log(`[CRON] ${company.ruc} sin credenciales verificadas, saltando`);
        continue;
      }

      const solPass = decrypt(
        cred.encryptedPass as string,
        cred.iv as string,
        cred.authTag as string
      );

      let clientSecret: string | null = null;
      if (cred.encClientSecret) {
        try {
          const p = JSON.parse(cred.encClientSecret as string) as { enc: string; iv: string; tag: string };
          clientSecret = decrypt(p.enc, p.iv, p.tag);
        } catch {}
      }

      const sunat = getSunatProvider();

      // Obtener token SIRE una sola vez por empresa
      const sireToken = await sunat.getSireToken(
        company.ruc as string,
        cred.solUser as string,
        solPass,
        cred.clientId as string ?? undefined,
        clientSecret ?? undefined
      );

      for (const operation of ['COMPRAS', 'VENTAS'] as const) {
        try {
          const result = await sunat.bulkDownload({
            ruc:           company.ruc as string,
            period,
            operation,
            documentTypes: ['01', '03', '07', '08'],
            sireToken,
            solUser:       cred.solUser as string,
            solPass,
            clientId:      cred.clientId as string ?? undefined,
            clientSecret:  clientSecret ?? undefined,
          });

          console.log(`[CRON] ${company.ruc} ${operation}: ${result.docsFound} docs`);

          // Guardar documentos en la BD
          let saved = 0;
          for (const doc of result.documents) {
            const docId = `${doc.serie}-${doc.numero}-${period}`;
            const existing = await findDocumentById(docId);
            if (existing) continue;

            const base = doc.biGravadaDG ?? Math.abs(doc.total) / 1.18;
            const igv  = doc.igvDG      ?? Math.abs(doc.total) - base;

            try {
              await createDocument({
                id: docId,
                companyId:    company.id,
                bulkJobId:    null,
                operation:    operation === 'COMPRAS' ? 'COMPRA' : 'VENTA',
                docType:      doc.tipo,
                serie:        doc.serie,
                number:       doc.numero,
                issuerRuc:    doc.rucEmisor,
                issuerName:   doc.rsEmisor,
                receiverRuc:  doc.rucReceptor,
                receiverName: doc.rsReceptor,
                issueDate:    doc.fecha,
                dueDate:      doc.fecVencPag || null,
                currency:     doc.moneda,
                base:         parseFloat(base.toFixed(2)),
                igv:          parseFloat(igv.toFixed(2)),
                total:        doc.total,
                sunatStatus:  doc.sunatStatus,
                cdrStatus:    doc.cdrStatus,
                hasXml: false, hasPdf: false, hasCdr: false,
                xmlPath: null, pdfPath: null, cdrPath: null,
                hashSha256: null,
                period,
                workflow:     'PENDIENTE_REVISION',
                concarStatus: 'PENDIENTE',
                parserStatus: 'PENDIENTE',
                aiStatus:     'PENDIENTE',
              });
              saved++;
            } catch (dbErr) {
              console.error(`[CRON] Error guardando ${docId}:`, (dbErr as Error).message);
            }
          }

          results.push({
            ruc:       company.ruc,
            operation,
            docsFound: result.docsFound,
            docsSaved: saved,
          });
        } catch (opErr) {
          console.error(`[CRON] Error ${company.ruc} ${operation}:`, (opErr as Error).message);
          results.push({ ruc: company.ruc, operation, error: (opErr as Error).message });
        }
      }

      await createAuditLog({
        userId:    'system',
        userEmail: 'cron@system',
        userRole:  'Sistema',
        action:    'CRON_DESCARGA_AUTOMATICA',
        object:    `${company.ruc} período ${period}`,
        ip:        '0.0.0.0',
      });

      // ── Alertas WhatsApp post-descarga ──────────────────
      try {
        await runAlertas(company.id as string, company.nombre as string || company.ruc as string);
      } catch (alertErr) {
        console.error(`[CRON] Error alertas ${company.ruc}:`, (alertErr as Error).message);
      }

    } catch (e) {
      console.error(`[CRON] Error empresa ${company.ruc}:`, (e as Error).message);
      results.push({ ruc: company.ruc, error: (e as Error).message });
    }
  }

  console.log(`[CRON] Completado. Resultados:`, JSON.stringify(results));
  return Response.json({ ok: true, period, results });
}
