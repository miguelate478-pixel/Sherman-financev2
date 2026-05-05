import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export interface SunatDocument {
  id: string; ruc: string; serie: string; numero: string;
  tipo: string; fecha: string; total: number; moneda: string;
  rsEmisor: string; rucEmisor: string; rsReceptor: string; rucReceptor: string;
  sunatStatus: string; cdrStatus: string;
  tipoDocCliente?: string;
  numDocCliente?: string;
  razonSocialCliente?: string;
  // Campos adicionales para Excel completo
  fecVencPag?: string;
  tipoCambio?: number;
  annCDP?: string;
  valNG?: number;
  isc?: number;
  icbper?: number;
  otrosTrib?: number;
  biGravadaDG?: number;
  igvDG?: number;
}

export interface SunatValidationResult {
  estadoCp: string; estadoRuc: string; condDomiRuc: string;
  observaciones: string[]; errorCode?: string;
}

export interface DownloadResult {
  xmlContent?: string; pdfBuffer?: Buffer; cdrContent?: string;
  hash?: string; success: boolean; error?: string; storedPath?: string;
}

export interface BulkResult {
  period: string; operation: string;
  docsFound: number; docsXml: number; docsPdf: number; docsCdr: number; errors: number;
  documents: SunatDocument[];
}

export interface ISunatProvider {
  getToken(clientId?: string, clientSecret?: string): Promise<string>;
  getSireToken(ruc: string, solUser: string, solPass: string, clientId?: string, clientSecret?: string): Promise<string>;
  validateDocument(p: { ruc: string; token: string; numRuc: string; codComp: string; serie: string; numero: string; fecha: string; monto: number }): Promise<SunatValidationResult>;
  bulkDownload(p: { ruc: string; period: string; operation: 'COMPRAS'|'VENTAS'; documentTypes: string[]; sireToken?: string; solUser?: string; solPass?: string; clientId?: string; clientSecret?: string }): Promise<BulkResult>;
  downloadXml(ruc: string, documentId: string, storagePath?: string): Promise<DownloadResult>;
  downloadPdf(ruc: string, documentId: string, storagePath?: string): Promise<DownloadResult>;
  downloadCdr(ruc: string, documentId: string, storagePath?: string): Promise<DownloadResult>;
  getSirePropuesta(ruc: string, period: string, tipo: 'RVIE'|'RCE', sireToken: string, clientId?: string, solUser?: string, solPass?: string, clientSecret?: string): Promise<{ numTicket: string; estado: string; archivoReporte?: { nomArchivoReporte: string }[] }>;
  consultarTicket(ticket: string, sireToken: string, period?: string): Promise<{ numTicket: string; estado: string; archivoReporte?: { nomArchivoReporte: string }[] }>;
}

// Cache de tokens SIRE por clientId+ruc
const sireTokenCache = new Map<string, { token: string; expiresAt: number }>();

export function getStoragePath(ruc: string, period: string, operation: string, tipo: string, docId: string): string {
  const base = process.env.STORAGE_PATH ?? './storage';
  return path.join(base, 'sunat', ruc, period, operation.toLowerCase(), tipo, docId.replace(/\//g, '-'));
}

export function saveFile(dirPath: string, filename: string, content: string | Buffer): string {
  fs.mkdirSync(dirPath, { recursive: true });
  const fp = path.join(dirPath, filename);
  if (typeof content === 'string') fs.writeFileSync(fp, content, 'utf8');
  else fs.writeFileSync(fp, content);
  return fp;
}

export function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

const MOCK_DOCS: SunatDocument[] = [
  { id:'F001-100001',ruc:'20512345678',serie:'F001',numero:'100001',tipo:'01',fecha:'2026-04-03',total:11800,moneda:'PEN',rsEmisor:'PROVEEDOR NACIONAL SAC',rucEmisor:'20100066603',rsReceptor:'EMPRESA SAC',rucReceptor:'20512345678',sunatStatus:'ACEPTADO',cdrStatus:'OK' },
  { id:'F002-200002',ruc:'20512345678',serie:'F002',numero:'200002',tipo:'01',fecha:'2026-04-05',total:5310,moneda:'PEN',rsEmisor:'SERVICIOS TI PERU SAC',rucEmisor:'20200300400',rsReceptor:'EMPRESA SAC',rucReceptor:'20512345678',sunatStatus:'ACEPTADO',cdrStatus:'OK' },
  { id:'B001-300001',ruc:'20512345678',serie:'B001',numero:'300001',tipo:'03',fecha:'2026-04-10',total:1180,moneda:'PEN',rsEmisor:'FERRETERIA SAC',rucEmisor:'10456789012',rsReceptor:'EMPRESA SAC',rucReceptor:'20512345678',sunatStatus:'ACEPTADO',cdrStatus:'OK' },
  { id:'NC01-400001',ruc:'20512345678',serie:'NC01',numero:'400001',tipo:'07',fecha:'2026-04-20',total:-590,moneda:'PEN',rsEmisor:'DELTA SA',rucEmisor:'20333444556',rsReceptor:'EMPRESA SAC',rucReceptor:'20512345678',sunatStatus:'ACEPTADO',cdrStatus:'OK' },
  { id:'FV01-500001',ruc:'20512345678',serie:'FV01',numero:'500001',tipo:'01',fecha:'2026-04-02',total:23600,moneda:'PEN',rsEmisor:'EMPRESA SAC',rucEmisor:'20512345678',rsReceptor:'GRUPO ANDINO SA',rucReceptor:'20654321098',sunatStatus:'ACEPTADO',cdrStatus:'OK' },
  { id:'FV01-500002',ruc:'20512345678',serie:'FV01',numero:'500002',tipo:'01',fecha:'2026-04-08',total:59000,moneda:'PEN',rsEmisor:'EMPRESA SAC',rucEmisor:'20512345678',rsReceptor:'CONSTRUCTORA SAC',rucReceptor:'20789012346',sunatStatus:'ACEPTADO',cdrStatus:'OK' },
];

function mockXml(doc: SunatDocument): string {
  const base = (Math.abs(doc.total)/1.18).toFixed(2);
  const igv  = (Math.abs(doc.total)-parseFloat(base)).toFixed(2);
  return `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"><cbc:ID>${doc.serie}-${doc.numero}</cbc:ID><cbc:IssueDate>${doc.fecha}</cbc:IssueDate><cbc:DocumentCurrencyCode>${doc.moneda}</cbc:DocumentCurrencyCode><cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="${doc.moneda}">${Math.abs(doc.total).toFixed(2)}</cbc:PayableAmount></cac:LegalMonetaryTotal></Invoice>`;
}

export class MockSunatProvider implements ISunatProvider {
  async getToken(_cId?: string, _cSec?: string) { await sleep(400); return 'mock-cpe-' + Date.now(); }
  async getSireToken(_r: string, _u: string, _p: string, _cId?: string, _cSec?: string) { await sleep(400); return 'mock-sire-' + Date.now(); }
  async validateDocument(_p: { numRuc: string }) { await sleep(600); return { estadoCp:'1', estadoRuc:'00', condDomiRuc:'00', observaciones:[] }; }
  async bulkDownload(p: { ruc: string; operation: 'COMPRAS'|'VENTAS' }): Promise<BulkResult> {
    await sleep(1000);
    const docs = p.operation==='COMPRAS' ? MOCK_DOCS.filter(d=>d.rucReceptor===p.ruc||d.rucEmisor!==p.ruc).slice(0,4) : MOCK_DOCS.filter(d=>d.rucEmisor===p.ruc).slice(0,2);
    return { period:'', operation:p.operation, docsFound:docs.length, docsXml:docs.length, docsPdf:docs.length-1, docsCdr:docs.length, errors:0, documents:docs };
  }
  async downloadXml(_ruc: string, documentId: string, storagePath?: string): Promise<DownloadResult> {
    await sleep(220);
    const doc = MOCK_DOCS.find(d=>d.id===documentId) ?? MOCK_DOCS[0];
    const xml = mockXml(doc);
    const hash = sha256(xml);
    if (storagePath) { try { saveFile(storagePath,'document.xml',xml); } catch {} }
    return { xmlContent:xml, hash, success:true };
  }
  async downloadPdf(_ruc: string, _id: string, storagePath?: string): Promise<DownloadResult> {
    await sleep(180);
    const pdf = Buffer.from('%PDF-1.4 mock\n%%EOF');
    if (storagePath) { try { saveFile(storagePath,'document.pdf',pdf); } catch {} }
    return { pdfBuffer:pdf, hash:sha256(pdf), success:true };
  }
  async downloadCdr(_ruc: string, documentId: string, storagePath?: string): Promise<DownloadResult> {
    await sleep(150);
    const cdr = `<?xml version="1.0"?><ApplicationResponse><cbc:ResponseCode>0</cbc:ResponseCode><cbc:Description>Aceptado ${documentId}</cbc:Description></ApplicationResponse>`;
    if (storagePath) { try { saveFile(storagePath,'cdr.xml',cdr); } catch {} }
    return { cdrContent:cdr, hash:sha256(cdr), success:true };
  }
  async getSirePropuesta(_r: string, period: string, tipo: string, _t: string, _cId?: string, _su?: string, _sp?: string, _cs?: string) { return { numTicket:`TICK-${tipo}-${period}-${Date.now()}`, estado:'06', archivoReporte:[{ nomArchivoReporte:`${tipo}_${period}.zip` }] }; }
  async consultarTicket(ticket: string, _t: string, _period?: string) { return { numTicket:ticket, estado:'06' }; }
}

export class DirectSunatProvider implements ISunatProvider {
  private apiBase      = 'https://api-seguridad.sunat.gob.pe/v1';
  private validateBase = 'https://api.sunat.gob.pe/v1';
  private sireBase     = 'https://api-sire.sunat.gob.pe/v1';

  private sireHeaders(token: string): Record<string, string> {
    return {
      'Authorization':    `Bearer ${token}`,
      'Accept':           'application/json, text/plain, */*',
      'Accept-Language':  'es-419,es;q=0.9',
      'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      'Origin':           'https://e-factura.sunat.gob.pe',
      'Referer':          'https://e-factura.sunat.gob.pe/',
      'Sec-Fetch-Dest':   'empty',
      'Sec-Fetch-Mode':   'cors',
      'Sec-Fetch-Site':   'same-site',
    };
  }

  private async fetchWithRetry(url: string, options: RequestInit, maxRetries: number = 3): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[SIRE] Attempt ${attempt}/${maxRetries} to download: ${url}`);
        const res = await fetch(url, options);
        if (res.ok) return res;

        // If not OK, log and retry
        const body = await res.text();
        console.log(`[SIRE] HTTP ${res.status} on attempt ${attempt}: ${body.substring(0, 200)}`);
        lastError = new Error(`HTTP ${res.status}`);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // exponential backoff
          console.log(`[SIRE] Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (e) {
        lastError = e as Error;
        console.log(`[SIRE] Network error on attempt ${attempt}: ${(e as Error).message}`);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[SIRE] Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw new Error(`Failed to download after ${maxRetries} attempts: ${lastError?.message}`);
  }

  async getToken(clientId?: string, clientSecret?: string): Promise<string> {
    return 'no-cpe-token';
  }

  async getSireToken(ruc: string, solUser: string, solPass: string, clientId?: string, clientSecret?: string): Promise<string> {
    const cId  = clientId  || '';
    const cSec = clientSecret || '';
    if (!cId || !cSec) throw new Error('Client ID y Client Secret requeridos.');

    // Cache: reutilizar token si no ha expirado (con 60s de margen)
    const cacheKey = `sire-${ruc}-${cId}`;
    const cached = sireTokenCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt - 60000) {
      console.log('[SIRE] Token desde cache para RUC:', ruc);
      return cached.token;
    }

    const res = await fetch(`${this.apiBase}/clientessol/${cId}/oauth2/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'password',
        scope:         'https://api-sire.sunat.gob.pe',
        client_id:     cId,
        client_secret: cSec,
        username:      `${ruc}${solUser}`,
        password:      solPass,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SIRE token error ${res.status}: ${body}`);
    }
    const j = await res.json() as { access_token: string; expires_in: number };
    // Guardar en cache con tiempo de expiración
    sireTokenCache.set(cacheKey, {
      token: j.access_token,
      expiresAt: Date.now() + (j.expires_in * 1000),
    });
    console.log('[SIRE] Token obtenido OK para RUC:', ruc, '| expires_in:', j.expires_in, 's');
    return j.access_token;
  }

  async validateDocument(p: { ruc:string; token:string; numRuc:string; codComp:string; serie:string; numero:string; fecha:string; monto:number }): Promise<SunatValidationResult> {
    const res = await fetch(`${this.validateBase}/contribuyente/contribuyentes/${p.ruc}/validarcomprobante`, {
      method:'POST', headers:{ Authorization:`Bearer ${p.token}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ numRuc:p.numRuc, codComp:p.codComp, numeroSerie:p.serie, numero:p.numero, fechaEmision:p.fecha, monto:String(p.monto) }),
    });
    const j = await res.json() as { success:boolean; data?:SunatValidationResult; errorCode?:string };
    if (!j.success) return { estadoCp:'0', estadoRuc:'00', condDomiRuc:'00', observaciones:[], errorCode:j.errorCode };
    return j.data!;
  }

  async bulkDownload(p: { ruc:string; period:string; operation:'COMPRAS'|'VENTAS'; documentTypes:string[]; sireToken?:string; solUser?:string; solPass?:string; clientId?:string; clientSecret?:string }): Promise<BulkResult> {
    const cId  = p.clientId  || '';
    const cSec = p.clientSecret || '';
    const periodo = p.period.replace('-', ''); // "2025-12" → "202512"

    // 1. Obtener token
    let token = p.sireToken || '';
    if (!token) {
      token = await this.getSireToken(p.ruc, p.solUser??'', p.solPass??'', cId, cSec);
    }

    const SIRE_BASE = 'https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros';

    // 2. Obtener comprobantes directamente via endpoint /comprobantes (sin ZIP)
    const esVentas = p.operation === 'VENTAS';

    // URLs confirmadas con el portal e-factura real:
    // RVIE (ventas): /rvie/propuesta/web/propuesta/{periodo}/comprobantes ✅ (token API)
    // RCE (compras): /rce/propuesta/web/propuesta/{periodo}/busqueda?codTipoOpe=1 ✅ (token portal)
    const comprobantesUrls = esVentas
      ? [`${SIRE_BASE}/rvie/propuesta/web/propuesta/${periodo}/comprobantes?codTipoOpe=1`]
      : [
          `${SIRE_BASE}/rce/propuesta/web/propuesta/${periodo}/busqueda?codTipoOpe=1`,
          `${SIRE_BASE}/rce/propuesta/web/propuesta/${periodo}/comprobantes`,
        ];

    const allDocuments: SunatDocument[] = [];
    let page = 1;
    const perPage = 100;
    let totalRegistros = 0;

    // Encontrar URL que funciona
    let comprobantesUrl = comprobantesUrls[0];
    let urlFound = false;
    for (const testUrl of comprobantesUrls) {
      try {
        const sep = testUrl.includes('?') ? '&' : '?';
        const testRes = await fetch(`${testUrl}${sep}page=1&perPage=1`, { headers: this.sireHeaders(token), signal: AbortSignal.timeout(10000) });
        if (testRes.ok) { comprobantesUrl = testUrl; urlFound = true; console.log(`[SIRE] URL comprobantes OK: ${testUrl}`); break; }
        console.log(`[SIRE] URL ${testUrl.substring(55)} → ${testRes.status}`);
      } catch {}
    }

    if (!urlFound) {
      console.log(`[SIRE] Endpoint /comprobantes no disponible para ${p.operation} ${periodo}. Usando resumen CSV.`);

      // Para RCE: usar el resumen CSV que sí está disponible con token de API
      const resumenUrl = `https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rvierce/resumen/web/resumencomprobantes/${periodo}/1/1/exporta?codLibro=080000`;
      try {
        const resRes = await fetch(resumenUrl, { headers: this.sireHeaders(token), signal: AbortSignal.timeout(15000) });
        if (resRes.ok) {
          const rawBytes = await resRes.arrayBuffer();
          // Decodificar bytes ASCII (el endpoint devuelve bytes como texto)
          const bytes = new Uint8Array(rawBytes);
          let csvText = '';
          // Si el contenido son números separados por newlines (bytes ASCII), decodificar
          const textContent = new TextDecoder('utf-8').decode(bytes);
          if (/^\d+\n/.test(textContent.trim())) {
            // Formato de bytes ASCII
            const byteNums = textContent.trim().split('\n').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
            csvText = String.fromCharCode(...byteNums);
          } else {
            csvText = textContent;
          }
          console.log(`[SIRE] Resumen CSV RCE:\n${csvText.substring(0, 500)}`);

          // Parsear CSV: Tipo,Total,BI,IGV,...,TotalCP
          const lines = csvText.split('\n').filter(l => l.trim() && !l.startsWith('Tipo') && !l.startsWith('TOTAL'));
          for (const line of lines) {
            const cols = line.split(',');
            if (cols.length < 2) continue;
            const tipoDesc = cols[0].trim(); // "01-Factura"
            const totalDocs = parseInt(cols[1]) || 0;
            const biGravado = parseFloat(cols[2]) || 0;
            const igv = parseFloat(cols[3]) || 0;
            const totalCP = parseFloat(cols[cols.length - 1]) || 0;
            const codTipo = tipoDesc.split('-')[0].trim().padStart(2, '0');

            if (totalDocs === 0) continue;

            // Crear un documento resumen por tipo
            allDocuments.push({
              id:          `RESUMEN-${codTipo}-${periodo}`,
              ruc:         p.ruc,
              serie:       'RESUMEN',
              numero:      `${codTipo}-${periodo}`,
              tipo:        codTipo,
              fecha:       `${p.period.substring(0,4)}-${p.period.substring(5,7)}-01`,
              total:       totalCP,
              moneda:      'PEN',
              rsEmisor:    `${totalDocs} comprobantes tipo ${tipoDesc}`,
              rucEmisor:   '',
              rsReceptor:  p.ruc,
              rucReceptor: p.ruc,
              sunatStatus: 'ACEPTADO',
              cdrStatus:   'OK',
            });
            console.log(`[SIRE] Resumen ${tipoDesc}: ${totalDocs} docs, BI=${biGravado}, IGV=${igv}, Total=${totalCP}`);
          }
        } else {
          console.log(`[SIRE] Resumen CSV HTTP ${resRes.status}`);
        }
      } catch(e) {
        console.error('[SIRE] Error obteniendo resumen CSV:', (e as Error).message);
      }

      console.log(`[SIRE] Total resúmenes RCE: ${allDocuments.length}`);
      return { period: p.period, operation: p.operation, docsFound: allDocuments.length, docsXml:0, docsPdf:0, docsCdr:0, errors:0, documents: allDocuments };
    }

    do {
      const url = comprobantesUrl.includes('?')
        ? `${comprobantesUrl}&page=${page}&perPage=${perPage}`
        : `${comprobantesUrl}?page=${page}&perPage=${perPage}`;
      console.log(`[SIRE] Comprobantes ${p.operation} ${periodo} página ${page}: ${url}`);
      try {
        let res = await fetch(url, { headers: this.sireHeaders(token), signal: AbortSignal.timeout(30000) });

        // Refresh token si 401
        if (res.status === 401) {
          console.log('[SIRE] 401 — refrescando token');
          token = await this.getSireToken(p.ruc, p.solUser??'', p.solPass??'', cId, cSec);
          res = await fetch(url, { headers: this.sireHeaders(token), signal: AbortSignal.timeout(30000) });
        }

        if (!res.ok) {
          const body = await res.text();
          console.log(`[SIRE] Comprobantes HTTP ${res.status}:`, body.substring(0, 300));
          break;
        }

        const data = await res.json() as {
          paginacion?: { totalRegistros: number };
          registros?: Record<string, unknown>[];
        };

        totalRegistros = data.paginacion?.totalRegistros ?? 0;
        const registros = data.registros ?? [];
        console.log(`[SIRE] Página ${page}: ${registros.length} comprobantes (total: ${totalRegistros})`);

        for (const reg of registros) {
          const serie  = String(reg.numSerieCDP ?? '');
          const numero = String(reg.numCDP ?? '');
          const tipo   = String(reg.codTipoCDP ?? '01');
          // Fecha puede venir como YYYY-MM-DD o DD/MM/YYYY
          const fechaRaw = String(reg.fecEmision ?? '');
          const fecha = fechaRaw.includes('/') ? fechaRaw.split('/').reverse().join('-') : fechaRaw.substring(0,10);
          const moneda = String(reg.codMoneda ?? 'PEN');

          // Montos: RVIE usa campos directos, RCE busqueda usa objeto montos
          const montos = reg.montos as Record<string,unknown> | undefined;
          const total  = Number(montos?.mtoTotalCp ?? reg.mtoTotalCP ?? reg.mtoTotalCP ?? 0);
          const base   = Number(montos?.mtoBIGravadaDG ?? reg.mtoBIGravada ?? 0);
          const igv    = Number(montos?.mtoIgvIpmDG ?? reg.mtoIGV ?? 0);
          const valNG  = Number(montos?.mtoValorAdqNG ?? 0);

          // Para ventas: emisor=empresa, receptor=cliente
          // Para compras (busqueda): proveedor en nomRazonSocialProveedor/numDocIdentidadProveedor
          const rucEmisor   = esVentas
            ? p.ruc
            : String(reg.numDocIdentidadProveedor ?? reg.numDocIdentidad ?? '');
          const rsEmisor    = esVentas
            ? String(reg.nomRazonSocial ?? '')
            : String(reg.nomRazonSocialProveedor ?? reg.nomRazonSocialCliente ?? '');
          const rucReceptor = esVentas
            ? String(reg.numDocIdentidad ?? reg.numDocIdentidadProveedor ?? '')
            : p.ruc;
          const rsReceptor  = esVentas
            ? String(reg.nomRazonSocialCliente ?? reg.nomRazonSocialProveedor ?? '')
            : String(reg.nomRazonSocial ?? '');

          allDocuments.push({
            id:          `${serie}-${numero}`,
            ruc:         p.ruc,
            serie,
            numero,
            tipo,
            fecha,
            total,
            moneda,
            rsEmisor,
            rucEmisor,
            rsReceptor,
            rucReceptor: esVentas ? String(reg.numDocIdentidad ?? reg.numDocIdentidadProveedor ?? '') : p.ruc,
            sunatStatus: String(reg.codEstadoComprobante === '1' ? 'ACEPTADO' : 'OBSERVADO'),
            cdrStatus:   'OK',
            // Campos adicionales para Excel completo
            fecVencPag:  String(reg.fecVencPag ?? '').substring(0,10),
            tipoCambio:  Number((reg.tipoCambio as Record<string,unknown>)?.mtoTipoCambio ?? 1),
            annCDP:      String(reg.annCDP ?? ''),
            valNG:       Number(montos?.mtoValorAdqNG ?? reg.mtoValorAdqNG ?? 0),
            isc:         Number(montos?.mtoISC ?? reg.mtoISC ?? 0),
            icbper:      Number(montos?.mtoIcbp ?? reg.mtoIcbp ?? 0),
            otrosTrib:   Number(montos?.mtoOtrosTrib ?? reg.mtoOtrosTrib ?? 0),
            biGravadaDG: base,
            igvDG:       igv,
          });
        }

        page++;
      } catch(e) {
        console.error('[SIRE] Error obteniendo comprobantes:', (e as Error).message);
        break;
      }
    } while ((page - 1) * perPage < totalRegistros);

    console.log(`[SIRE] Total comprobantes obtenidos: ${allDocuments.length}`);

    return {
      period:    p.period,
      operation: p.operation,
      docsFound: allDocuments.length,
      docsXml:   0,
      docsPdf:   0,
      docsCdr:   0,
      errors:    0,
      documents: allDocuments,
    };
  }

  async getSirePropuesta(ruc: string, period: string, tipo: 'RVIE'|'RCE', token: string, clientId?: string, solUser?: string, solPass?: string, clientSecret?: string) {
    // Formato YYYYMM según manual SIRE v25 (ej: "2025-12" → "202512")
    const per = period.replace('-','');
    // RUC va en la ruta según API SIRE
    const ep  = tipo==='RVIE'
      ? `/contribuyente/migeigv/libros/rvie/propuesta/web/propuesta/${per}/exportapropuesta?codTipoArchivo=0`
      : `/contribuyente/migeigv/libros/rce/propuesta/web/propuesta/${per}/exportacioncomprobantepropuesta?codTipoArchivo=0&codOrigenEnvio=2`;
    console.log(`[SIRE] Propuesta ${tipo} RUC ${ruc} período ${per}: ${this.sireBase}${ep}`);
    console.log(`[SIRE] Token (primeros 40 chars): ${token.substring(0, 40)}...`);

    const doRequest = async (tkn: string) => fetch(`${this.sireBase}${ep}`, {
      headers: this.sireHeaders(tkn),
      signal: AbortSignal.timeout(15000),
    });

    let res = await doRequest(token);
    console.log(`[SIRE] Propuesta HTTP status: ${res.status}`);

    // Si 401, limpiar cache y reintentar con token fresco
    if (res.status === 401 && clientId && solUser !== undefined && solPass !== undefined) {
      console.log('[SIRE] 401 en propuesta — limpiando cache y reintentando con token fresco...');
      const body401 = await res.text();
      console.log('[SIRE] 401 body (completo):', body401.substring(0, 2000));
      const cacheKey = `sire-${ruc}-${clientId}`;
      sireTokenCache.delete(cacheKey);
      const freshToken = await this.getSireToken(ruc, solUser, solPass, clientId, clientSecret);
      console.log(`[SIRE] Token fresco (primeros 40 chars): ${freshToken.substring(0, 40)}...`);
      res = await doRequest(freshToken);
      console.log(`[SIRE] Reintento HTTP status: ${res.status}`);
    }

    if (!res.ok) {
      const body = await res.text();
      console.log(`[SIRE] Error final ${res.status} body:`, body.substring(0, 2000));
      throw new Error(`SIRE propuesta error ${res.status}: ${body}`);
    }
    const jsonResponse = await res.json();
    console.log('[SIRE] Propuesta JSON response:', JSON.stringify(jsonResponse, null, 2));
    return jsonResponse as Promise<{ numTicket:string; estado:string; archivoReporte?:{ nomArchivoReporte:string }[] }>;
  }

  async consultarTicket(ticket: string, token: string, period?: string) {
    const per = period ? period.replace('-', '') : '';
    const params = new URLSearchParams({
      numTicket: ticket,
      page:    '1',
      perPage: '10',
      perIni:  per,
      perFin:  per,
    });
    const res = await fetch(
      `${this.sireBase}/contribuyente/migeigv/libros/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets?${params}`,
      { headers: this.sireHeaders(token), signal: AbortSignal.timeout(10000) }
    );
    const rawText = await res.text();
    console.log(`[SIRE] consultarTicket HTTP ${res.status} raw COMPLETO:`, rawText);
    if (!res.ok) {
      console.error(`[SIRE] consultarTicket error ${res.status}`);
      return { numTicket: ticket, estado: undefined as unknown as string };
    }
    const data = JSON.parse(rawText) as {
      numTicket: string;
      estado: string;
      codProceso?: string | number;
      codEstadoProceso?: string;
      desEstadoProceso?: string;
      archivoReporte?: { nomArchivoReporte: string }[];
      registros?: {
        codProceso?: string | number;
        codEstadoProceso?: string;
        archivoReporte?: { nomArchivoReporte: string }[];
      }[];
    };

    const registro = data.registros?.[0] ?? data;
    const codEstado = registro.codEstadoProceso ?? data.codEstadoProceso;
    const archivoReporte = registro.archivoReporte ?? data.archivoReporte;

    console.log(`[SIRE] consultarTicket codEstadoProceso=${codEstado} archivos=${archivoReporte?.length ?? 0}`);

    // codEstadoProceso "06" = Terminado, "07" = Error
    if (codEstado === '06') {
      return { ...data, archivoReporte, estado: '06' };
    }
    if (codEstado === '07') {
      return { ...data, estado: '07' };
    }
    // En proceso o desconocido — seguir polling
    return { ...data, estado: undefined as unknown as string };
  }

  async downloadXml(_ruc: string, _id: string, _sp?: string): Promise<DownloadResult> { return { success:false, error:'XML via SIRE propuesta ZIP' }; }
  async downloadPdf(_ruc: string, _id: string, _sp?: string): Promise<DownloadResult> { return { success:false, error:'PDF via SIRE (pending)' }; }
  async downloadCdr(_ruc: string, _id: string, _sp?: string): Promise<DownloadResult> { return { success:false, error:'CDR via SIRE (pending)' }; }
}

export function getSunatProvider(): ISunatProvider {
  return process.env.SUNAT_PROVIDER==='direct' ? new DirectSunatProvider() : new MockSunatProvider();
}
