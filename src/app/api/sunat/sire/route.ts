import { NextRequest } from 'next/server';
import { findCompanyById, getCredentialByCompany, createAuditLog } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized, getIP } from '@/lib/response';
import { getSunatProvider } from '@/lib/providers/sunat';
import { decrypt } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const { companyId, period, tipo } = await req.json() as { companyId:string; period:string; tipo:'RVIE'|'RCE' };
    if (!companyId||!period||!tipo) return err('companyId, period y tipo requeridos');
    const company = await findCompanyById(companyId);
    const cred    = await getCredentialByCompany(companyId);
    if (!company) return err('Empresa no encontrada');
    if (!cred)    return err('Sin credenciales SOL. Ve a Centro SUNAT → Credenciales SOL.');
    const provider = getSunatProvider();
    let sireToken:string;
    if (process.env.SUNAT_PROVIDER==='direct') {
      const solPass = decrypt(cred.encryptedPass as string, cred.iv as string, cred.authTag as string);
      let clientId: string | undefined = cred.clientId as string || undefined;
      let clientSecret: string | undefined;
      if (cred.encClientSecret) {
        try {
          const p = JSON.parse(cred.encClientSecret as string) as { enc:string; iv:string; tag:string };
          clientSecret = decrypt(p.enc, p.iv, p.tag);
        } catch {}
      }
      sireToken = await provider.getSireToken(company.ruc as string, cred.solUser as string, solPass, clientId, clientSecret);
    } else {
      sireToken = await provider.getSireToken(company.ruc as string, '', '');
    }
    const ticket = await provider.getSirePropuesta(company.ruc as string, period, tipo, sireToken);
    await createAuditLog({ userId:user.sub, userEmail:user.email, userRole:user.role, action:`SIRE_${tipo}_SOLICITADO`, object:`${company.ruc} ${period}`, ip:getIP(req) });
    return ok({ numTicket:ticket.numTicket, estado:ticket.estado, mensaje:ticket.estado==='06'?'Propuesta lista':ticket.estado==='07'?'Error SIRE':'Procesando...', archivo:ticket.archivoReporte?.[0]?.nomArchivoReporte });
  } catch(e) { return err((e as Error).message, 500); }
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { searchParams } = new URL(req.url);
  const ticket = searchParams.get('ticket'), companyId = searchParams.get('companyId');
  if (!ticket||!companyId) return err('ticket y companyId requeridos');
  try {
    const cred = await getCredentialByCompany(companyId);
    const company = await findCompanyById(companyId);
    if (!cred||!company) return err('Sin configuración');
    const provider = getSunatProvider();
    let sireToken:string;
    if (process.env.SUNAT_PROVIDER==='direct') {
      const solPass = decrypt(cred.encryptedPass as string, cred.iv as string, cred.authTag as string);
      const clientId: string | undefined = cred.clientId as string || undefined;
      let clientSecret: string | undefined;
      if (cred.encClientSecret) {
        try {
          const p = JSON.parse(cred.encClientSecret as string) as { enc:string; iv:string; tag:string };
          clientSecret = decrypt(p.enc, p.iv, p.tag);
        } catch {}
      }
      sireToken = await provider.getSireToken(company.ruc as string, cred.solUser as string, solPass, clientId, clientSecret);
    } else {
      sireToken = await provider.getSireToken(company.ruc as string, '', '');
    }

    // Llamar directamente al endpoint de polling y devolver la respuesta RAW completa
    const periodo = searchParams.get('period') || '';
    const codLibro = searchParams.get('codLibro') || '080000';
    const rawUrl = `https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets`
      + `?perIni=${periodo}&perFin=${periodo}&page=1&perPage=20&numTicket=${ticket}&codLibro=${codLibro}&codOrigenEnvio=2`;

    const rawRes = await fetch(rawUrl, {
      headers: {
        'Authorization': `Bearer ${sireToken}`,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'es-419,es;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://e-factura.sunat.gob.pe',
        'Referer': 'https://e-factura.sunat.gob.pe/',
      },
      signal: AbortSignal.timeout(10000),
    });
    const rawText = await rawRes.text();
    console.log(`[SIRE-DIAG] HTTP ${rawRes.status} URL: ${rawUrl}`);
    console.log(`[SIRE-DIAG] RAW: ${rawText}`);

    let parsed: unknown;
    try { parsed = JSON.parse(rawText); } catch { parsed = rawText; }

    // También devolver el resultado de consultarTicket para comparar
    const result = await provider.consultarTicket(ticket, sireToken, periodo || undefined);
    return ok({ sunatRaw: parsed, sunatStatus: rawRes.status, consultarTicketResult: result });
  } catch(e) { return err((e as Error).message, 500); }
}

// ─── PUT: Descarga XMLs via browser automation (portal e-factura) ────────────
// Usa Puppeteer + Chromium para automatizar el portal SUNAT y descargar
// los XMLs de comprobantes recibidos (compras) que no están en la API CPE.
export async function PUT(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const { companyId, period, maxDocs = 50 } = await req.json() as {
      companyId: string; period: string; maxDocs?: number;
    };
    if (!companyId || !period) return err('companyId y period requeridos');

    const company = await findCompanyById(companyId);
    const cred    = await getCredentialByCompany(companyId);
    if (!company) return err('Empresa no encontrada');
    if (!cred)    return err('Sin credenciales SOL');

    if (process.env.SUNAT_PROVIDER !== 'direct') {
      return err('Browser automation solo disponible en modo direct (producción)');
    }

    const solPass = decrypt(cred.encryptedPass as string, cred.iv as string, cred.authTag as string);

    // Importar módulos necesarios
    const { downloadXmlFromSunat } = await import('@/lib/providers/sunat-scraper');
    const { parseXmlUbl } = await import('@/lib/xml-parser');
    const { createDocumentLine, updateDocument, getDocuments } = await import('@/lib/db');
    const { getAiProvider } = await import('@/lib/providers/ai');
    const ai = getAiProvider();

    const logs: string[] = [];
    const log = (m: string) => {
      console.log(`[BROWSER] ${m}`);
      logs.push(m);
    };

    log(`Iniciando descarga browser para ${company.ruc} período ${period}`);

    // Obtener documentos pendientes de parseo
    const allDocs = await getDocuments({ companyId, period });
    const pendientes = (allDocs as Record<string, unknown>[]).filter(
      d => d.parserStatus === 'PENDIENTE' || d.parserStatus === 'ERROR' || d.parserStatus === 'SIN_XML'
    );

    log(`Documentos pendientes: ${pendientes.length}`);

    if (pendientes.length === 0) {
      return ok({ parsed: 0, errors: 0, total: 0, logs, message: 'No hay documentos pendientes' });
    }

    // Limitar a maxDocs
    const docsToProcess = pendientes.slice(0, maxDocs);
    log(`Procesando ${docsToProcess.length} documentos (límite: ${maxDocs})`);

    let parsed = 0, errors = 0, sinXml = 0;

    // Procesar cada documento individualmente
    for (const doc of docsToProcess) {
      const docId = doc.id as string;
      const serie = doc.serie as string;
      const numero = doc.number as string;
      const rucEmisor = doc.issuerRuc as string;
      const tipo = doc.docType as string;

      log(`Procesando ${serie}-${numero} (RUC emisor: ${rucEmisor})...`);

      try {
        // Descargar XML via scraping
        const scraperResult = await downloadXmlFromSunat(
          {
            ruc: company.ruc as string,
            solUser: cred.solUser as string,
            solPass,
          },
          {
            rucEmisor,
            tipoComprobante: tipo,
            serie,
            numero,
          }
        );

        if (!scraperResult.xmlContent) {
          log(`${serie}-${numero}: Sin XML - ${scraperResult.error || 'no disponible'}`);
          await updateDocument(docId, { parserStatus: 'SIN_XML' });
          sinXml++;
          continue;
        }

        log(`${serie}-${numero}: XML obtenido (${scraperResult.xmlContent.length} bytes)`);

        // Parsear XML y guardar líneas
        const parsedDoc = await parseXmlUbl(scraperResult.xmlContent);
        let linesGuardadas = 0;

        for (const line of parsedDoc.lines) {
          let cl = null;
          try { cl = await ai.classifyLine(line.description, line.lineTotal, tipo); } catch {}
          
          try {
            await createDocumentLine({
              id:           `${docId}-L${line.lineNumber}`,
              documentId:   docId,
              lineNumber:   line.lineNumber,
              code:         line.code || '',
              description:  line.description,
              quantity:     line.quantity,
              unit:         line.unit,
              unitValue:    line.unitValue,
              igvAmount:    line.igvAmount,
              lineTotal:    line.lineTotal,
              affectType:   line.affectType,
              pcgeAccount:  cl?.pcgeAccount  || null,
              costCenter:   cl?.costCenter   || null,
              category:     cl?.category     || null,
              iaConfidence: cl?.confidence   || 0,
              needsReview:  cl?.needsReview  || false,
              isRecurrent:  cl?.isRecurrent  || false,
            });
            linesGuardadas++;
          } catch (lineErr) {
            log(`Error guardando línea ${line.lineNumber}: ${(lineErr as Error).message}`);
          }
        }

        await updateDocument(docId, { 
          hasXml: true, 
          parserStatus: 'PARSEADO', 
          aiStatus: 'CLASIFICADO' 
        });
        
        log(`${serie}-${numero}: ${linesGuardadas}/${parsedDoc.lines.length} líneas guardadas ✓`);
        parsed++;

      } catch (e) {
        log(`Error procesando ${serie}-${numero}: ${(e as Error).message}`);
        await updateDocument(docId, { parserStatus: 'ERROR' });
        errors++;
      }
    }

    await createAuditLog({
      userId: user.sub, userEmail: user.email, userRole: user.role,
      action: 'BROWSER_XML_DOWNLOAD',
      object: `${companyId} ${period} parsed=${parsed} errors=${errors} sinXml=${sinXml}`,
      ip: getIP(req),
    });

    log(`Resumen: ${parsed} parseados, ${errors} errores, ${sinXml} sin XML`);

    return ok({ parsed, errors, sinXml, total: docsToProcess.length, logs });
  } catch (e) {
    console.error('[BROWSER] Error fatal:', (e as Error).message);
    return err(`Error browser: ${(e as Error).message}`, 500);
  }
}
