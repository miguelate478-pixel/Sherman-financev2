import { NextRequest } from 'next/server';
import { findCompanyById, findDocumentById, getCredentialByCompany, createBulkJob, createBulkJobPeriod, updateBulkJob, updateBulkJobPeriod, getBulkJobs, createDocument, createDocumentLine, updateDocument, createAuditLog } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized, getIP } from '@/lib/response';
import { getSunatProvider, getStoragePath } from '@/lib/providers/sunat';
import { getAiProvider } from '@/lib/providers/ai';
import { decrypt } from '@/lib/crypto';

function getPeriods(from:string,to:string):string[]{const ps:string[]=[];let[y,m]=from.split('-').map(Number);const[ty,tm]=to.split('-').map(Number);while(y<ty||(y===ty&&m<=tm)){ps.push(`${y}-${String(m).padStart(2,'0')}`);m++;if(m>12){m=1;y++;}}return ps;}

// ─── CPE Token (scope diferente a SIRE) ───────────────────────────
const cpeTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getCpeToken(ruc: string, solUser: string, solPass: string, clientId: string, clientSecret: string): Promise<string> {
  const key = `cpe-${ruc}-${clientId}`;
  const cached = cpeTokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt - 60000) return cached.token;

  const res = await fetch(`https://api-seguridad.sunat.gob.pe/v1/clientessol/${clientId}/oauth2/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'password',
      scope:         'https://api-cpe.sunat.gob.pe',   // ← scope CPE, no SIRE
      client_id:     clientId,
      client_secret: clientSecret,
      username:      `${ruc}${solUser}`,
      password:      solPass,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CPE token error ${res.status}: ${body.substring(0,300)}`);
  }
  const j = await res.json() as { access_token: string; expires_in: number };
  cpeTokenCache.set(key, { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 });
  console.log('[CPE] Token obtenido OK para RUC:', ruc, '| expires_in:', j.expires_in);
  return j.access_token;
}

// ─── Descarga individual por CPE ──────────────────────────────────
const CPE_BASE = 'https://api-cpe.sunat.gob.pe/v1/contribuyente/gem';
const TIPO_MAP: Record<string,string> = { '01':'01','03':'03','07':'07','08':'08','RC':'RC' };

async function downloadCpeFile(token: string, tipo: string, serie: string, numero: string, rucEmisor: string, fileType: 'xml'|'pdf'|'cdr'): Promise<{ content: Buffer; ok: boolean; error?: string }> {
  const tipoCode = TIPO_MAP[tipo] ?? tipo;
  const url = `${CPE_BASE}/comprobantes/${tipoCode}/${serie}/${numero}/${rucEmisor}/${fileType}`;
  const accept = fileType === 'pdf' ? 'application/pdf' : 'application/xml';
  console.log(`[CPE] Descargando ${fileType.toUpperCase()}: ${url}`);
  try {
    let res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: accept }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[CPE] HTTP ${res.status} para ${serie}-${numero} ${fileType}: ${body.substring(0,200)}`);
      return { content: Buffer.alloc(0), ok: false, error: `HTTP ${res.status}: ${body.substring(0,200)}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { content: buf, ok: true };
  } catch(e) {
    return { content: Buffer.alloc(0), ok: false, error: (e as Error).message };
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const body = await req.json();
    const { companyId, operation, periodFrom, periodTo, documentTypes, fileTypes, includeDetails, classifyWithAI } = body;
    if (!companyId||!periodFrom||!periodTo) return err('companyId, periodFrom y periodTo requeridos');

    const company = await findCompanyById(companyId);
    if (!company) return err('Empresa no encontrada');

    const cred = await getCredentialByCompany(companyId);
    let solPass = '';
    let clientId: string | null = null;
    let clientSecret: string | null = null;
    if (cred && process.env.SUNAT_PROVIDER==='direct') {
      solPass = decrypt(cred.encryptedPass as string, cred.iv as string, cred.authTag as string);
      clientId = cred.clientId as string | null;
      if (cred.encClientSecret) {
        try {
          const p = JSON.parse(cred.encClientSecret as string) as { enc:string; iv:string; tag:string };
          clientSecret = decrypt(p.enc, p.iv, p.tag);
          console.log('[BULK] clientSecret desencriptado OK, longitud:', clientSecret.length);
        } catch (e1) {
          console.error('[BULK] Error JSON.parse encClientSecret:', (e1 as Error).message);
          // Intentar formato legacy (encriptado directo sin JSON wrapper)
          try {
            clientSecret = decrypt(cred.encClientSecret as string, cred.iv as string, cred.authTag as string);
            console.log('[BULK] clientSecret legacy desencriptado OK, longitud:', clientSecret.length);
          } catch (e2) {
            console.error('[BULK] Error decrypt legacy encClientSecret:', (e2 as Error).message);
          }
        }
      } else {
        console.log('[BULK] encClientSecret no existe en BD para companyId:', companyId);
      }
    }
    console.log('[BULK] Estado credenciales — clientId:', !!clientId, '| clientSecret:', !!clientSecret, '| solPass len:', solPass.length);

    const periods = getPeriods(periodFrom, periodTo);
    const ops = operation==='BOTH'?['COMPRAS','VENTAS']:[operation==='PURCHASES'?'COMPRAS':'VENTAS'];

    const jobId = await createBulkJob({ companyId, operation, periodFrom, periodTo, periodType:periods.length===1?'MONTHLY':'RANGE', totalPeriods:periods.length*ops.length, createdBy:user.email });

    const sunat = getSunatProvider();
    const ai    = getAiProvider();
    let totalDocs=0,totalXml=0,totalPdf=0,totalCdr=0,totalErrors=0;
    let lastError = '';

    let sireToken='';
    try {
      sireToken = await sunat.getSireToken(
        company.ruc as string,
        (cred?.solUser as string)||'',
        solPass,
        clientId ?? undefined,
        clientSecret ?? undefined
      );
    } catch(e) {
      console.error('[BULK] Error obteniendo SIRE token:', (e as Error).message);
    }

    for (const period of periods) {
      for (const op of ops) {
        const jpId = await createBulkJobPeriod({ jobId, period, operation:op });
        try {
          const result = await sunat.bulkDownload({
            ruc:           company.ruc as string,
            period,
            operation:     op as 'COMPRAS'|'VENTAS',
            documentTypes: documentTypes||['01','03','07','08'],
            sireToken:     sireToken || undefined,
            solUser:       (cred?.solUser as string)||'',
            solPass,
            clientId:      clientId ? clientId : undefined,
            clientSecret:  clientSecret ? clientSecret : undefined,
          });
          let periodXml=0,periodPdf=0,periodCdr=0,periodErrors=0;

          for (const doc of result.documents) {
            const docId=`${doc.serie}-${doc.numero}-${period}`;
            const existing = await findDocumentById(docId);
            if(existing) continue;

            const storePath=getStoragePath(company.ruc as string,period,op,doc.tipo,`${doc.serie}-${doc.numero}`);
            let xmlContent:string|undefined,hasXml=false,hasPdf=false,hasCdr=false,xmlPath='',pdfPath='',cdrPath='',docHash='';

            if(!fileTypes||fileTypes.includes('XML')){try{const r=await sunat.downloadXml(company.ruc as string,doc.id,storePath);if(r.success&&r.xmlContent){hasXml=true;xmlContent=r.xmlContent;docHash=r.hash||'';xmlPath=`${storePath}/document.xml`;periodXml++;}}catch{periodErrors++;}}
            if(!fileTypes||fileTypes.includes('PDF')){try{const r=await sunat.downloadPdf(company.ruc as string,doc.id,storePath);if(r.success){hasPdf=true;pdfPath=`${storePath}/document.pdf`;periodPdf++;}}catch{periodErrors++;}}
            if(!fileTypes||fileTypes.includes('CDR')){try{const r=await sunat.downloadCdr(company.ruc as string,doc.id,storePath);if(r.success){hasCdr=true;cdrPath=`${storePath}/cdr.xml`;periodCdr++;}}catch{periodErrors++;}}

            const base = doc.biGravadaDG !== undefined ? doc.biGravadaDG : (Math.abs(doc.total)/1.18);
            const igv  = doc.igvDG !== undefined ? doc.igvDG : (Math.abs(doc.total) - base);
            // Para VENTAS: el cliente viene en numDocCliente/razonSocialCliente (campos reales SUNAT)
            // Para COMPRAS: el proveedor viene en rucEmisor/rsEmisor
            const receiverRuc = op==='VENTAS'
              ? (doc.numDocCliente || doc.rucReceptor || '')
              : doc.rucReceptor;
            const receiverName = op==='VENTAS'
              ? (doc.razonSocialCliente || doc.rsReceptor || '')
              : doc.rsReceptor;
            try {
              console.log('[BULK] Guardando doc:', docId, 'companyId:', companyId, 'periodo:', period);
              await createDocument({
                id:docId, companyId, bulkJobId:jobId,
                operation: op==='COMPRAS'?'COMPRA':'VENTA',
                docType: doc.tipo, serie: doc.serie, number: doc.numero,
                issuerRuc: doc.rucEmisor, issuerName: doc.rsEmisor,
                receiverRuc, receiverName,
                issueDate: doc.fecha,
                dueDate: doc.fecVencPag || null,
                currency: doc.moneda,
                base: parseFloat(base.toFixed(2)),
                igv: parseFloat(igv.toFixed(2)),
                total: doc.total,
                sunatStatus: doc.sunatStatus, cdrStatus: doc.cdrStatus,
                hasXml, hasPdf, hasCdr, xmlPath, pdfPath, cdrPath, hashSha256: docHash,
                period, workflow:'PENDIENTE_REVISION', concarStatus:'PENDIENTE',
                parserStatus:'PENDIENTE', aiStatus:'PENDIENTE',
              });
              console.log('[BULK] Doc guardado OK:', docId);
            } catch (dbError) {
              console.error(`[BULK_DOWNLOAD] Failed to save document ${docId}:`, dbError);
              periodErrors++;
              continue;
            }

            // ── Extraer líneas del XML ──────────────────────────────
            if (includeDetails) {
              // 1. Intentar con XML ya descargado vía SIRE (si existe)
              let xmlForLines: string | undefined = xmlContent;

              // 2. Si no hay XML de SIRE, intentar descarga individual vía API CPE
              console.log(`[BULK] includeDetails para ${docId} — xmlContent:${!!xmlContent} clientId:${!!clientId} clientSecret:${!!clientSecret}`);
              if (!xmlForLines && clientId && clientSecret) {
                try {
                  const cpeToken = await getCpeToken(
                    company.ruc as string,
                    (cred?.solUser as string) || '',
                    solPass,
                    clientId,
                    clientSecret
                  );
                  // Para compras: el emisor es doc.rucEmisor
                  // Para ventas: el emisor es la propia empresa
                  const rucEmisorCpe = op === 'COMPRAS' ? doc.rucEmisor : company.ruc as string;
                  const cpeResult = await downloadCpeFile(cpeToken, doc.tipo, doc.serie, doc.numero, rucEmisorCpe, 'xml');
                  if (cpeResult.ok && cpeResult.content.length > 0) {
                    xmlForLines = cpeResult.content.toString('utf8');
                    console.log(`[BULK] XML CPE descargado para ${docId}: ${xmlForLines.length} bytes`);
                    // Actualizar flags en BD
                    hasXml = true;
                    docHash = cpeResult.content.toString('hex').substring(0, 64);
                    await updateDocument(docId, { hasXml: true, hashSha256: docHash });
                  } else {
                    console.log(`[BULK] CPE XML no disponible para ${docId}: ${cpeResult.error}`);
                  }
                } catch (cpeErr) {
                  console.log(`[BULK] Error CPE para ${docId}: ${(cpeErr as Error).message}`);
                }
              }

              // 3. Parsear XML y guardar líneas
              if (xmlForLines) {
                try {
                  const { parseXmlUbl } = await import('@/lib/xml-parser');
                  const parsed = await parseXmlUbl(xmlForLines);
                  let linesGuardadas = 0;
                  for (const line of parsed.lines) {
                    let cl = null;
                    if (classifyWithAI) {
                      try { cl = await ai.classifyLine(line.description, line.lineTotal, doc.tipo); } catch {}
                    }
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
                      console.error(`[BULK] Error guardando línea ${line.lineNumber} de ${docId}:`, (lineErr as Error).message);
                    }
                  }
                  await updateDocument(docId, {
                    parserStatus: 'PARSEADO',
                    aiStatus:     classifyWithAI ? 'CLASIFICADO' : 'PENDIENTE',
                  });
                  console.log(`[BULK] ${docId}: ${linesGuardadas}/${parsed.lines.length} líneas guardadas`);
                } catch (parseErr) {
                  console.error(`[BULK] Error parseando XML de ${docId}:`, (parseErr as Error).message);
                  await updateDocument(docId, { parserStatus: 'ERROR' });
                }
              } else {
                console.log(`[BULK] ${docId}: sin XML disponible para extraer líneas`);
              }
            }
          }

          await updateBulkJobPeriod(jpId,{status:'COMPLETADO',docsFound:result.docsFound,docsXml:periodXml,docsPdf:periodPdf,docsCdr:periodCdr,errors:periodErrors,completedAt:new Date().toISOString()});
          totalDocs+=result.docsFound;totalXml+=periodXml;totalPdf+=periodPdf;totalCdr+=periodCdr;totalErrors+=periodErrors;
        } catch(e) {
          console.error('[BULK ERROR] período:', period, 'op:', op);
          console.error('[BULK ERROR] mensaje:', (e as Error).message);
          console.error('[BULK ERROR] stack:', (e as Error).stack?.split('\n')[1]);
          await updateBulkJobPeriod(jpId,{status:'ERROR',completedAt:new Date().toISOString()});
          totalErrors++;
          lastError = (e as Error).message;
        }
      }
    }

    const finalStatus=totalErrors>0?'COMPLETADO_CON_ERRORES':'COMPLETADO';
    await updateBulkJob(jobId,{status:finalStatus,docsFound:totalDocs,docsXml:totalXml,docsPdf:totalPdf,docsCdr:totalCdr,errors:totalErrors,completedAt:new Date().toISOString()});
    await createAuditLog({userId:user.sub,userEmail:user.email,userRole:user.role,action:'BULK_DOWNLOAD_COMPLETADO',object:`${periodFrom}→${periodTo} ${operation} ${totalDocs}docs`,ip:getIP(req)});
    return ok({jobId,status:finalStatus,totalDocs,totalXml,totalPdf,totalCdr,totalErrors,lastError:lastError||undefined});
  } catch(e) { return err(`Error: ${(e as Error).message}`,500); }
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const p = new URL(req.url).searchParams;
  return ok(await getBulkJobs(p.get('companyId')||undefined));
}
