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

    // 1. Obtener token con auto-refresh
    let token = p.sireToken || '';
    if (!token) {
      token = await this.getSireToken(p.ruc, p.solUser??'', p.solPass??'', cId, cSec);
    }

    const SIRE_BASE = 'https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros';
    const headers = this.sireHeaders(token);

    let numTicket = '';
    let directBuffer: Buffer | null = null;

    if (p.operation === 'VENTAS') {
      // RVIE - endpoint ventas
      const urlVentas = `${SIRE_BASE}/rvie/propuesta/web/propuesta/${periodo}/exportapropuesta?codOrigenEnvio=2&codTipoArchivo=0`;
      console.log('[SIRE] Ventas GET', urlVentas);
      try {
        const res = await fetch(urlVentas, { headers });
        if (res.ok) {
          const data = await res.json() as { numTicket?: string };
          numTicket = data?.numTicket ?? '';
          console.log('[SIRE] Ventas ticket:', numTicket);
        } else if (res.status === 401) {
          token = await this.getSireToken(p.ruc, p.solUser??'', p.solPass??'', cId, cSec);
          const res2 = await fetch(urlVentas, { headers: this.sireHeaders(token) });
          if (res2.ok) { const d = await res2.json() as { numTicket?: string }; numTicket = d?.numTicket ?? ''; }
        } else {
          const body = await res.text();
          console.log('[SIRE] Ventas error', res.status, body.substring(0, 300));
        }
      } catch(e) { console.error('[SIRE] Ventas fetch error:', (e as Error).message); }

    } else {
      // RCE - endpoint compras 5.34
      const url534 = `${SIRE_BASE}/rce/propuesta/web/propuesta/${periodo}/exportacioncomprobantepropuesta?codTipoArchivo=0&codOrigenEnvio=2`;
      console.log('[SIRE] 5.34 GET', url534);
      try {
        const res = await fetch(url534, { headers });
        if (res.ok) {
          const data = await res.json() as { numTicket?: string };
          numTicket = data?.numTicket ?? '';
          console.log('[SIRE] 5.34 ticket:', numTicket, 'data:', JSON.stringify(data));
        } else if (res.status === 401) {
          console.warn('[SIRE] 401 - refrescando token');
          token = await this.getSireToken(p.ruc, p.solUser??'', p.solPass??'', cId, cSec);
          const res2 = await fetch(url534, { headers: this.sireHeaders(token) });
          if (res2.ok) { const d = await res2.json() as { numTicket?: string }; numTicket = d?.numTicket ?? ''; }
          else { console.log('[SIRE] 5.34 retry', res2.status, (await res2.text()).substring(0,200)); }
        } else {
          const body = await res.text();
          console.log('[SIRE] 5.34 HTTP', res.status, body.substring(0, 500));
        }
      } catch(e) { console.error('[SIRE] 5.34 error:', (e as Error).message); }

      // Fallback: portal exporta directo
      if (!numTicket) {
        const urlPortal = `${SIRE_BASE}/rvierce/resumen/web/resumencomprobantes/${periodo}/1/0/exporta?codLibro=080000`;
        console.log('[SIRE] Portal exporta GET', urlPortal);
        try {
          const res = await fetch(urlPortal, { headers: this.sireHeaders(token) });
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.byteLength > 0) {
              directBuffer = buf;
              numTicket = `DIRECT_${periodo}_${Date.now()}`;
              console.log('[SIRE] Portal exporta OK, size:', buf.byteLength);
            }
          } else { console.log('[SIRE] Portal exporta', res.status); }
        } catch(e) { console.error('[SIRE] Portal error:', (e as Error).message); }
      }

      // Fallback: 5.53 reportecar
      if (!numTicket) {
        const url553 = `${SIRE_BASE}/rvierce/gestionlibro/web/comprobanteslibros/${periodo}/reportecar`;
        for (const codFase of ['1','2','3']) {
          try {
            const res = await fetch(`${url553}?codOrigenEnvio=2&codLibro=080000&codFase=${codFase}`, { headers: this.sireHeaders(token) });
            if (res.ok) {
              const d = await res.json() as { numTicket?: string };
              numTicket = d?.numTicket ?? '';
              if (numTicket) { console.log('[SIRE] 5.53 ticket codFase', codFase, ':', numTicket); break; }
            }
          } catch {}
        }
      }
    }

    if (!numTicket) throw new Error('No se pudo obtener ticket de SIRE. El período puede no tener comprobantes.');

    // 2. Si es descarga directa (buffer ya disponible)
    let zipBuffer: Buffer | null = directBuffer;

    // Código de libro según operación
    const codLibro = p.operation === 'VENTAS' ? '140100' : '080100';

    // 3. Si hay ticket, hacer polling
    if (!zipBuffer && !numTicket.startsWith('DIRECT_')) {
      const pollUrl = `${SIRE_BASE}/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets`;
      let nomArchivo = '';
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 3000));
        // Sin codLibro ni codOrigenEnvio — esos parámetros causan 422
        const params = `perIni=${periodo}&perFin=${periodo}&page=1&perPage=20&numTicket=${numTicket}`;
        try {
          const res = await fetch(`${pollUrl}?${params}`, { headers: this.sireHeaders(token) });
          if (!res.ok) {
            const errBody = await res.text();
            console.log(`[SIRE] Poll ${res.status}:`, errBody.substring(0, 300));
            continue;
          }
          const data = await res.json() as { registros?: Record<string,unknown>[] };
          const registros = data?.registros ?? [];
          const item = Array.isArray(registros) ? registros[0] : registros as unknown as Record<string,unknown>;
          if (!item) continue;
          const codEstado = (item.codEstado ?? item.codEstadoProceso) as string | undefined;
          console.log(`[SIRE] Poll ${i+1}: ticket ${numTicket} codEstado=${codEstado}`);
          if (codEstado === '06' || codEstado === '3' || codEstado === '4') {
            const archivos = (item.archivoReporte ?? []) as { nomArchivoReporte: string }[];
            nomArchivo = archivos[0]?.nomArchivoReporte ?? '';
            if (!nomArchivo) nomArchivo = `${p.ruc}_${p.operation}_${periodo}_${numTicket}.zip`;
            console.log('[SIRE] Terminado. Archivo:', nomArchivo);
            break;
          }
          if (codEstado === '05' || codEstado === '07') {
            throw new Error(`Ticket ${numTicket} error estado ${codEstado}`);
          }
        } catch(e) { if ((e as Error).message.includes('Ticket')) throw e; }
      }
      if (!nomArchivo) throw new Error(`Ticket ${numTicket} no terminó o sin archivo`);

      // 4. Descargar ZIP — sin codLibro (el nombre del archivo ya identifica el recurso)
      const dlUrl = `${SIRE_BASE}/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte?nomArchivoReporte=${encodeURIComponent(nomArchivo)}`;
      console.log('[SIRE] Descargando archivo:', dlUrl);
      const dlRes = await fetch(dlUrl, { headers: this.sireHeaders(token) });
      if (!dlRes.ok) {
        // Intentar con codLibro
        const dlUrl2 = `${SIRE_BASE}/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte?nomArchivoReporte=${encodeURIComponent(nomArchivo)}&codLibro=${codLibro}`;
        console.log('[SIRE] Reintentando con codLibro:', dlUrl2);
        const dlRes2 = await fetch(dlUrl2, { headers: this.sireHeaders(token) });
        if (!dlRes2.ok) throw new Error(`Error descargando ZIP: ${dlRes2.status}`);
        zipBuffer = Buffer.from(await dlRes2.arrayBuffer());
      } else {
        zipBuffer = Buffer.from(await dlRes.arrayBuffer());
      }
      console.log('[SIRE] ZIP descargado:', zipBuffer.byteLength, 'bytes');
    }

    if (!zipBuffer || zipBuffer.byteLength === 0) {
      return { period: p.period, operation: p.operation, docsFound:0, docsXml:0, docsPdf:0, docsCdr:0, errors:0, documents:[] };
    }

    // 5. Extraer XMLs del ZIP
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    console.log('[SIRE] Archivos en ZIP:', entries.map((e: { entryName: string }) => e.entryName).join(', '));

    const allDocuments: SunatDocument[] = [];
    let totalXml = 0, totalPdf = 0, totalCdr = 0, totalErrors = 0;

    for (const entry of entries) {
      const name = (entry.entryName as string).toLowerCase();
      if (name.endsWith('.pdf')) { totalPdf++; continue; }
      if (name.endsWith('.xml') && (name.startsWith('r-') || name.includes('cdr'))) { totalCdr++; continue; }
      if (name.endsWith('.xml')) {
        totalXml++;
        try {
          const xmlContent = entry.getData().toString('utf8');
          const { parseXmlUbl } = require('../xml-parser');
          const parsed = await parseXmlUbl(xmlContent);
          allDocuments.push({
            id:          `${parsed.header.serie}-${parsed.header.numero}`,
            ruc:         p.ruc,
            serie:       parsed.header.serie,
            numero:      parsed.header.numero,
            tipo:        parsed.header.tipoDoc,
            fecha:       parsed.header.fechaEmision,
            total:       parsed.header.totalImporte,
            moneda:      parsed.header.moneda,
            rsEmisor:    parsed.header.rsEmisor,
            rucEmisor:   parsed.header.rucEmisor,
            rsReceptor:  parsed.header.rsReceptor,
            rucReceptor: parsed.header.rucReceptor,
            sunatStatus: 'ACEPTADO',
            cdrStatus:   'OK',
          });
          console.log('[SIRE] XML OK:', parsed.header.serie, parsed.header.numero);
        } catch(e) {
          totalErrors++;
          console.error('[SIRE] XML error:', entry.entryName, (e as Error).message);
        }
      }
    }

    console.log(`[SIRE] Resultado: ${allDocuments.length} docs | ${totalXml} XML | ${totalPdf} PDF | ${totalCdr} CDR | ${totalErrors} errores`);
    return {
      period:    p.period,
      operation: p.operation,
      docsFound: allDocuments.length,
      docsXml:   totalXml,
      docsPdf:   totalPdf,
      docsCdr:   totalCdr,
      errors:    totalErrors,
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
