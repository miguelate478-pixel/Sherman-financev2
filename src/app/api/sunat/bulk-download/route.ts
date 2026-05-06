import { NextRequest } from 'next/server';
import { findCompanyById, findDocumentById, getCredentialByCompany, createBulkJob, createBulkJobPeriod, updateBulkJob, updateBulkJobPeriod, getBulkJobs, createDocument, createDocumentLine, updateDocument, createAuditLog, getDocuments } from '@/lib/db';
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
            // Si ya existe Y no necesitamos extraer líneas, saltar
            if(existing && !includeDetails) continue;
            // Si ya existe Y necesitamos líneas Y ya tiene líneas, saltar
            if(existing && includeDetails && (existing.parserStatus === 'PARSEADO' || existing.parserStatus === 'CLASIFICADO')) {
              console.log(`[BULK] ${docId}: ya parseado (${existing.parserStatus}), saltando`);
              continue;
            }

            const storePath=getStoragePath(company.ruc as string,period,op,doc.tipo,`${doc.serie}-${doc.numero}`);
            let xmlContent:string|undefined,hasXml=false,hasPdf=false,hasCdr=false,xmlPath='',pdfPath='',cdrPath='',docHash='';

            if(!fileTypes||fileTypes.includes('XML')){try{const r=await sunat.downloadXml(company.ruc as string,doc.id,storePath);if(r.success&&r.xmlContent){hasXml=true;xmlContent=r.xmlContent;docHash=r.hash||'';xmlPath=`${storePath}/document.xml`;periodXml++;}}catch{periodErrors++;}}
            if(!fileTypes||fileTypes.includes('PDF')){try{const r=await sunat.downloadPdf(company.ruc as string,doc.id,storePath);if(r.success){hasPdf=true;pdfPath=`${storePath}/document.pdf`;periodPdf++;}}catch{periodErrors++;}}
            if(!fileTypes||fileTypes.includes('CDR')){try{const r=await sunat.downloadCdr(company.ruc as string,doc.id,storePath);if(r.success){hasCdr=true;cdrPath=`${storePath}/cdr.xml`;periodCdr++;}}catch{periodErrors++;}}

            const base = doc.biGravadaDG !== undefined ? doc.biGravadaDG : (Math.abs(doc.total)/1.18);
            const igv  = doc.igvDG !== undefined ? doc.igvDG : (Math.abs(doc.total) - base);
            const receiverRuc = op==='VENTAS'
              ? (doc.numDocCliente || doc.rucReceptor || '')
              : doc.rucReceptor;
            const receiverName = op==='VENTAS'
              ? (doc.razonSocialCliente || doc.rsReceptor || '')
              : doc.rsReceptor;

            // Solo crear documento si no existe
            if (!existing) {
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
            } else {
              console.log(`[BULK] ${docId}: doc existente, procesando líneas`);
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

// ─── Helpers SIRE ZIP ─────────────────────────────────────────────
const SIRE_BASE = 'https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros';

function sireHeaders(token: string): Record<string,string> {
  return {
    'Authorization':   `Bearer ${token}`,
    'Accept':          'application/json, text/plain, */*',
    'Accept-Language': 'es-419,es;q=0.9',
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin':          'https://e-factura.sunat.gob.pe',
    'Referer':         'https://e-factura.sunat.gob.pe/',
  };
}

/** Solicita propuesta y devuelve ticket */
async function solicitarPropuesta(ruc: string, periodo: string, tipo: 'RVIE'|'RCE', token: string): Promise<string> {
  const ep = tipo === 'RVIE'
    ? `${SIRE_BASE}/rvie/propuesta/web/propuesta/${periodo}/exportapropuesta?codTipoArchivo=1&codOrigenEnvio=2`
    : `${SIRE_BASE}/rce/propuesta/web/propuesta/${periodo}/exportacioncomprobantepropuesta?codTipoArchivo=1&codOrigenEnvio=2`;
  console.log(`[POLLING] Solicitando propuesta ${tipo} ${periodo}: ${ep}`);
  const res = await fetch(ep, { headers: sireHeaders(token), signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Propuesta ${tipo} HTTP ${res.status}: ${body.substring(0,300)}`);
  }
  const j = await res.json() as { numTicket?: string; mensaje?: string };
  const ticket = j.numTicket ?? '';
  console.log(`[POLLING] Ticket obtenido: ${ticket}`);
  return ticket;
}

/** Polling hasta que el ticket esté listo. Devuelve nombre del archivo ZIP */
async function esperarTicket(ticket: string, periodo: string, tipo: 'RVIE'|'RCE', token: string, maxIntentos = 60, intervaloMs = 5000): Promise<string> {
  // FIX 2: endpoints de polling distintos para RCE y RVIE
  const url = tipo === 'RCE'
    ? `${SIRE_BASE}/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets`
      + `?perIni=${periodo}&perFin=${periodo}&page=1&perPage=20&numTicket=${ticket}&codLibro=080000&codOrigenEnvio=2`
    : `${SIRE_BASE}/rvie/propuesta/web/propuesta/${periodo}/consultaestadoticket?numTicket=${ticket}`;

  console.log(`[POLLING] URL polling ${tipo}: ${url}`);

  for (let i = 1; i <= maxIntentos; i++) {
    console.log(`[POLLING] Intento ${i}/${maxIntentos} ticket: ${ticket} tipo: ${tipo}`);
    await new Promise(r => setTimeout(r, intervaloMs));

    try {
      const res = await fetch(url, { headers: sireHeaders(token), signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        console.log(`[POLLING] HTTP ${res.status} en intento ${i}`);
        continue;
      }
      const raw = await res.text();
      console.log(`[POLLING] Respuesta intento ${i}: ${raw.substring(0, 400)}`);

      let data: Record<string,unknown>;
      try { data = JSON.parse(raw); } catch { continue; }

      // Buscar en registros o en raíz (estructura varía entre RCE y RVIE)
      const registros = (data.registros as Record<string,unknown>[]) ?? [data];
      const reg = registros.find(r => String(r.numTicket) === ticket) ?? registros[0];
      if (!reg) continue;

      const codEstado = String(reg.codEstadoProceso ?? reg.codEstado ?? '');
      const detalle   = reg.detalleTicket as Record<string,unknown> | undefined;
      const nomArchivo = String(
        detalle?.nomArchivoReporte
        ?? (reg.archivoReporte as Record<string,unknown>[])?.[0]?.nomArchivoReporte
        ?? reg.nomArchivoReporte
        ?? ''
      );

      console.log(`[POLLING] codEstado=${codEstado} archivo=${nomArchivo}`);

      if (codEstado === '06') {
        if (!nomArchivo) throw new Error('Ticket listo pero sin nombre de archivo');
        return nomArchivo;
      }
      if (codEstado === '07') throw new Error('SIRE reportó error en el ticket (codEstado=07)');
      // Otros estados: seguir esperando
    } catch (e) {
      if ((e as Error).message.includes('codEstado=07') || (e as Error).message.includes('sin nombre')) throw e;
      console.log(`[POLLING] Error en intento ${i}: ${(e as Error).message}`);
    }
  }
  throw new Error(`Timeout: ticket ${ticket} no completó en ${maxIntentos * intervaloMs / 1000}s`);
}

/** Descarga el ZIP y devuelve su contenido como Buffer */
async function descargarZip(nomArchivo: string, periodo: string, tipo: 'RVIE'|'RCE', token: string): Promise<Buffer> {
  // FIX 1: URL de descarga diferente para RCE vs RVIE
  const url = tipo === 'RCE'
    ? `${SIRE_BASE}/rce/propuesta/web/propuesta/${periodo}/descargaarchivo?nomArchivoReporte=${encodeURIComponent(nomArchivo)}`
    : `${SIRE_BASE}/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte?nomArchivoReporte=${encodeURIComponent(nomArchivo)}&codLibro=080000`;
  console.log(`[POLLING] Descargando ZIP ${tipo}: ${url}`);
  const res = await fetch(url, {
    headers: { ...sireHeaders(token), Accept: 'application/zip, application/octet-stream, */*' },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Descarga ZIP ${tipo} HTTP ${res.status}: ${body.substring(0,300)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`[POLLING] ZIP ${tipo} descargado: ${buf.length} bytes`);
  return buf;
}

/** Extrae XMLs del ZIP y devuelve mapa { nombreArchivo: contenidoXml } */
function extraerXmlsDeZip(zipBuffer: Buffer): Map<string, string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require('adm-zip') as new (buf: Buffer) => {
    getEntries(): { entryName: string; getData(): Buffer }[];
  };
  const zip = new AdmZip(zipBuffer);
  const xmls = new Map<string, string>();
  for (const entry of zip.getEntries()) {
    if (entry.entryName.toLowerCase().endsWith('.xml') && !entry.entryName.includes('__MACOSX')) {
      const content = entry.getData().toString('utf8');
      xmls.set(entry.entryName, content);
      console.log(`[POLLING] XML extraído del ZIP: ${entry.entryName} (${content.length} bytes)`);
    }
  }
  return xmls;
}

/** Intenta hacer match entre nombre de archivo XML del ZIP y un docId de la BD */
function matchXmlADoc(entryName: string, docs: Record<string,unknown>[]): Record<string,unknown> | null {
  // Nombre típico: 20508565934-01-FJ88-00030587.xml  o  20610169849-01-E001-00000101.xml
  const base = entryName.replace(/\.xml$/i, '').replace(/.*\//, '');
  const parts = base.split('-');
  if (parts.length < 4) return null;
  // parts[0]=rucEmisor, parts[1]=tipo, parts[2]=serie, parts[3]=numero (con ceros)
  const serie  = parts[2];
  const numero = String(parseInt(parts[3], 10)); // quitar ceros a la izquierda
  return docs.find(d =>
    String(d.serie) === serie && String(d.number) === numero
  ) ?? null;
}

// ─── PUT: Parsear XMLs via SIRE propuesta ZIP ─────────────────────
export async function PUT(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const body = await req.json();
    const { companyId, period, classifyWithAI } = body;
    if (!companyId || !period) return err('companyId y period requeridos');

    const company = await findCompanyById(companyId);
    if (!company) return err('Empresa no encontrada');

    const cred = await getCredentialByCompany(companyId);
    if (!cred) return err('Sin credenciales configuradas');

    let solPass = '';
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    if (process.env.SUNAT_PROVIDER === 'direct') {
      solPass   = decrypt(cred.encryptedPass as string, cred.iv as string, cred.authTag as string);
      clientId  = (cred.clientId as string) || undefined;
      if (cred.encClientSecret) {
        try {
          const p2 = JSON.parse(cred.encClientSecret as string) as { enc:string; iv:string; tag:string };
          clientSecret = decrypt(p2.enc, p2.iv, p2.tag);
        } catch {
          try { clientSecret = decrypt(cred.encClientSecret as string, cred.iv as string, cred.authTag as string); } catch {}
        }
      }
    }

    if (!clientId || !clientSecret) return err('Client ID y Client Secret requeridos');

    const sunat = getSunatProvider();
    const sireToken = await sunat.getSireToken(
      company.ruc as string, cred.solUser as string, solPass, clientId, clientSecret
    );
    console.log('[PARSE] Token SIRE obtenido OK');

    const periodo = period.replace('-', ''); // "2025-12" → "202512"

    // Obtener docs pendientes de la BD para este período
    const allDocs = await getDocuments({ companyId, period });
    const pendientes = (allDocs as Record<string,unknown>[]).filter(
      d => d.parserStatus === 'PENDIENTE' || d.parserStatus === 'ERROR' || d.parserStatus === 'SIN_XML'
    );
    console.log(`[PARSE] ${pendientes.length} docs pendientes en ${period}`);
    if (pendientes.length === 0) return ok({ parsed: 0, errors: 0, sinXml: 0, total: 0, message: 'No hay documentos pendientes' });

    const compras = pendientes.filter(d => d.operation === 'COMPRA');
    const ventas  = pendientes.filter(d => d.operation === 'VENTA');
    console.log(`[PARSE] Compras pendientes: ${compras.length} | Ventas pendientes: ${ventas.length}`);

    const ai = getAiProvider();
    const { parseXmlUbl } = await import('@/lib/xml-parser');
    let parsed = 0, errors = 0, sinXml = 0;

    // ── Función auxiliar para procesar un mapa de XMLs contra docs ──
    const procesarXmls = async (xmlMap: Map<string, string>, docsList: Record<string,unknown>[]) => {
      for (const [entryName, xmlContent] of xmlMap) {
        const doc = matchXmlADoc(entryName, docsList);
        if (!doc) {
          console.log(`[PARSE] Sin match para ${entryName}`);
          continue;
        }
        const docId = doc.id as string;
        const tipo  = doc.docType as string;
        try {
          const parsedDoc = await parseXmlUbl(xmlContent);
          let linesGuardadas = 0;
          for (const line of parsedDoc.lines) {
            let cl = null;
            if (classifyWithAI) {
              try { cl = await ai.classifyLine(line.description, line.lineTotal, tipo); } catch {}
            }
            try {
              await createDocumentLine({
                id: `${docId}-L${line.lineNumber}`, documentId: docId,
                lineNumber: line.lineNumber, code: line.code || '',
                description: line.description, quantity: line.quantity,
                unit: line.unit, unitValue: line.unitValue,
                igvAmount: line.igvAmount, lineTotal: line.lineTotal,
                affectType: line.affectType,
                pcgeAccount: cl?.pcgeAccount || null, costCenter: cl?.costCenter || null,
                category: cl?.category || null, iaConfidence: cl?.confidence || 0,
                needsReview: cl?.needsReview || false, isRecurrent: cl?.isRecurrent || false,
              });
              linesGuardadas++;
            } catch {}
          }
          await updateDocument(docId, {
            hasXml: true, parserStatus: 'PARSEADO',
            aiStatus: classifyWithAI ? 'CLASIFICADO' : 'PENDIENTE',
          });
          console.log(`[PARSE] ${docId}: ${linesGuardadas}/${parsedDoc.lines.length} líneas guardadas ✓`);
          parsed++;
        } catch (e) {
          console.error(`[PARSE] Error parseando ${docId}:`, (e as Error).message);
          await updateDocument(docId, { parserStatus: 'ERROR' });
          errors++;
        }
      }
    };

    // ── COMPRAS: ZIP via RCE propuesta ───────────────────────────────
    if (compras.length > 0) {
      try {
        console.log(`[PARSE] Solicitando ZIP RCE para ${periodo}...`);
        const ticketRce = await solicitarPropuesta(company.ruc as string, periodo, 'RCE', sireToken);
        const nomArchivoRce = await esperarTicket(ticketRce, periodo, 'RCE', sireToken);
        const zipRce = await descargarZip(nomArchivoRce, periodo, 'RCE', sireToken);
        const xmlsRce = extraerXmlsDeZip(zipRce);
        console.log(`[PARSE] ZIP RCE: ${xmlsRce.size} XMLs extraídos`);
        await procesarXmls(xmlsRce, compras);
        // Marcar como SIN_XML los que no tuvieron match
        for (const doc of compras) {
          const d = doc as Record<string,unknown>;
          if (d.parserStatus === 'PENDIENTE' || d.parserStatus === 'ERROR' || d.parserStatus === 'SIN_XML') {
            // Refrescar estado
            const fresh = await findDocumentById(d.id as string);
            if (fresh && fresh.parserStatus !== 'PARSEADO') {
              sinXml++;
              await updateDocument(d.id as string, { parserStatus: 'SIN_XML' });
            }
          }
        }
      } catch (e) {
        console.error('[PARSE] Error procesando ZIP RCE:', (e as Error).message);
        errors += compras.length;
      }
    }

    // ── VENTAS: ZIP via RVIE propuesta ───────────────────────────────
    if (ventas.length > 0) {
      try {
        console.log(`[PARSE] Solicitando ZIP RVIE para ${periodo}...`);
        const ticketRvie = await solicitarPropuesta(company.ruc as string, periodo, 'RVIE', sireToken);
        const nomArchivoRvie = await esperarTicket(ticketRvie, periodo, 'RVIE', sireToken);
        const zipRvie = await descargarZip(nomArchivoRvie, periodo, 'RVIE', sireToken);
        const xmlsRvie = extraerXmlsDeZip(zipRvie);
        console.log(`[PARSE] ZIP RVIE: ${xmlsRvie.size} XMLs extraídos`);
        await procesarXmls(xmlsRvie, ventas);
        for (const doc of ventas) {
          const d = doc as Record<string,unknown>;
          const fresh = await findDocumentById(d.id as string);
          if (fresh && fresh.parserStatus !== 'PARSEADO') {
            sinXml++;
            await updateDocument(d.id as string, { parserStatus: 'SIN_XML' });
          }
        }
      } catch (e) {
        console.error('[PARSE] Error procesando ZIP RVIE:', (e as Error).message);
        errors += ventas.length;
      }
    }

    await createAuditLog({
      userId: user.sub, userEmail: user.email, userRole: user.role,
      action: 'PARSE_XML_SIRE_ZIP',
      object: `${companyId} ${period} parsed=${parsed} errors=${errors} sinXml=${sinXml}`,
      ip: getIP(req),
    });

    return ok({ parsed, errors, sinXml, total: pendientes.length });
  } catch(e) { return err(`Error: ${(e as Error).message}`, 500); }
}
