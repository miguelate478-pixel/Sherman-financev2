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
  getSirePropuesta(ruc: string, period: string, tipo: 'RVIE'|'RCE', sireToken: string): Promise<{ numTicket: string; estado: string; archivoReporte?: { nomArchivoReporte: string }[] }>;
  consultarTicket(ticket: string, sireToken: string): Promise<{ numTicket: string; estado: string; archivoReporte?: { nomArchivoReporte: string }[] }>;
}

// No cache — always get fresh token to avoid stale/invalid token issues
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
  async getSirePropuesta(_r: string, period: string, tipo: string, _t: string) { return { numTicket:`TICK-${tipo}-${period}-${Date.now()}`, estado:'06', archivoReporte:[{ nomArchivoReporte:`${tipo}_${period}.zip` }] }; }
  async consultarTicket(ticket: string, _t: string) { return { numTicket:ticket, estado:'06' }; }
}

export class DirectSunatProvider implements ISunatProvider {
  private apiBase      = 'https://api-seguridad.sunat.gob.pe/v1';
  private validateBase = 'https://api.sunat.gob.pe/v1';
  private sireBase     = 'https://api-sire.sunat.gob.pe/v1';

  async getToken(clientId?: string, clientSecret?: string): Promise<string> {
    return 'no-cpe-token';
  }

  async getSireToken(ruc: string, solUser: string, solPass: string, clientId?: string, clientSecret?: string): Promise<string> {
    const cId  = clientId     || process.env.SUNAT_CLIENT_ID     || '';
    const cSec = clientSecret || process.env.SUNAT_CLIENT_SECRET || '';
    if (!cId || !cSec) throw new Error('Client ID y Client Secret requeridos.');
    const url = `https://api-seguridad.sunat.gob.pe/v1/clientessol/${cId}/oauth2/token/`;
    const params = new URLSearchParams({
      grant_type:    'password',
      scope:         'https://api-sire.sunat.gob.pe',
      client_id:     cId,
      client_secret: cSec,
      username:      `${ruc}${solUser}`,
      password:      solPass,
    });
    console.log(`[SIRE] Auth POST ${url}`);
    console.log(`[SIRE] username=${ruc}${solUser} | clientId=${cId}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SUNAT auth error ${res.status}: ${body}`);
    }
    const j = await res.json() as { access_token: string; expires_in: number };
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
    const token = p.sireToken ?? await this.getSireToken(p.ruc, p.solUser??'', p.solPass??'', p.clientId, p.clientSecret);
    const tipo  = p.operation==='VENTAS' ? 'RVIE' : 'RCE';

    // Solicitar propuesta SIRE
    const ticket = await this.getSirePropuesta(p.ruc, p.period, tipo, token);
    console.log(`[SIRE] Ticket: ${ticket.numTicket} | Estado: ${ticket.estado}`);

    // Polling hasta estado 06 (terminado)
    let estado = ticket.estado;
    let finalTicket = ticket;
    let attempts = 0;
    while (estado !== '06' && estado !== '07' && attempts < 30) {
      await sleep(3000);
      finalTicket = await this.consultarTicket(ticket.numTicket, token);
      estado = finalTicket.estado;
      attempts++;
      console.log(`[SIRE] Polling ${attempts}: estado=${estado}`);
    }

    if (estado === '07') throw new Error('SIRE reportó error en el ticket');
    if (estado !== '06') throw new Error(`SIRE no completó después de ${attempts} intentos. Estado: ${estado}`);

    const archivos = finalTicket.archivoReporte || [];
    console.log(`[SIRE] Archivos disponibles: ${archivos.map(a => a.nomArchivoReporte).join(', ')}`);

    const allDocuments: SunatDocument[] = [];
    let totalXml = 0, totalPdf = 0, totalCdr = 0, totalErrors = 0;

    for (const archivo of archivos) {
      try {
        const zipUrl = `${this.sireBase}/contribuyente/migeigv/libros/rvierce/gestionprocesosmasivos/web/masivo/descargaarchivo?nomArchivoReporte=${encodeURIComponent(archivo.nomArchivoReporte)}`;
        const zipRes = await fetch(zipUrl, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(30000),
        });

        if (!zipRes.ok) {
          console.log(`[SIRE] Error descargando ${archivo.nomArchivoReporte}: HTTP ${zipRes.status}`);
          continue;
        }

        const zipBuffer = Buffer.from(await zipRes.arrayBuffer());
        console.log(`[SIRE] ZIP descargado: ${zipBuffer.length} bytes`);

        // Detectar si es ZIP por firma PK
        const isZip = zipBuffer[0] === 0x50 && zipBuffer[1] === 0x4B;
        if (!isZip) {
          throw new Error('SIRE no devolvió un ZIP válido. Tamaño: ' + zipBuffer.byteLength + ' bytes');
        }

        const AdmZip = require('adm-zip');
        const zip = new AdmZip(zipBuffer);
        const entries = zip.getEntries();
        console.log('[SIRE] Archivos en ZIP:', entries.map((e: { entryName: string }) => e.entryName).join(', '));

        const documents: SunatDocument[] = [];
        let docsXml = 0, docsPdf = 0, docsCdr = 0, errors = 0;

        for (const entry of entries) {
          const name = (entry.entryName as string).toLowerCase();

          if (name.endsWith('.pdf')) {
            docsPdf++;
            continue;
          }

          if (name.endsWith('.xml')) {
            // CDR: nombre empieza con R- o contiene cdr/CDR
            if (name.startsWith('r-') || name.includes('cdr')) {
              docsCdr++;
              continue;
            }

            // XML de comprobante UBL 2.1
            docsXml++;
            try {
              const xmlContent = entry.getData().toString('utf8');
              const { parseXmlUbl } = require('../xml-parser');
              const parsed = await parseXmlUbl(xmlContent);
              documents.push({
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
              console.log(`[SIRE] XML parseado: ${parsed.header.serie}-${parsed.header.numero} | Total: ${parsed.header.totalImporte}`);
            } catch (e) {
              errors++;
              console.error('[SIRE] Error parseando XML:', entry.entryName, (e as Error).message);
            }
          }
        }

        console.log(`[SIRE] Total: ${documents.length} docs | ${docsXml} XML | ${docsPdf} PDF | ${docsCdr} CDR | ${errors} errores`);
        allDocuments.push(...documents);
        totalXml += docsXml;
        totalPdf += docsPdf;
        totalCdr += docsCdr;
        totalErrors += errors;

      } catch(e) {
        console.log(`[SIRE] Error procesando archivo ${archivo.nomArchivoReporte}: ${(e as Error).message}`);
        totalErrors++;
      }
    }

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

  async getSirePropuesta(ruc: string, period: string, tipo: 'RVIE'|'RCE', token: string) {
    // Formato YYYYMM según manual SIRE v25 (ej: "2025-12" → "202512")
    const per = period.replace('-','');
    const ep  = tipo==='RVIE'
      ? `/contribuyente/migeigv/libros/rvie/propuesta/web/propuesta/${per}/exportapropuesta?codTipoArchivo=0`
      : `/contribuyente/migeigv/libros/rce/propuesta/web/propuesta/${per}/exportacioncomprobantepropuesta?codTipoArchivo=0`;
    console.log(`[SIRE] Propuesta ${tipo} período ${per}: ${this.sireBase}${ep}`);
    const res = await fetch(`${this.sireBase}${ep}`, {
      headers:{ Authorization:`Bearer ${token}`, Accept:'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SIRE propuesta error ${res.status}: ${body}`);
    }
    return res.json() as Promise<{ numTicket:string; estado:string; archivoReporte?:{ nomArchivoReporte:string }[] }>;
  }

  async consultarTicket(ticket: string, token: string) {
    const res = await fetch(
      `${this.sireBase}/contribuyente/migeigv/libros/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets?numTicket=${ticket}`,
      { headers:{ Authorization:`Bearer ${token}` }, signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json() as {
      numTicket: string;
      estado: string;
      codProceso?: number;
      archivoReporte?: { nomArchivoReporte: string }[];
      registros?: { codProceso: number }[];
    };
    // Según manual SIRE v25: codProceso 3=OK, 4=con observaciones, 2=en proceso
    const codProceso = data.codProceso ?? data.registros?.[0]?.codProceso;
    if (codProceso === 3 || codProceso === 4) {
      // Terminado — normalizar estado a "06" para compatibilidad
      return { ...data, estado: '06' };
    }
    if (codProceso !== undefined && codProceso !== 2) {
      // Error
      return { ...data, estado: '07' };
    }
    return data;
  }

  async downloadXml(_ruc: string, _id: string, _sp?: string): Promise<DownloadResult> { return { success:false, error:'XML via SIRE propuesta ZIP' }; }
  async downloadPdf(_ruc: string, _id: string, _sp?: string): Promise<DownloadResult> { return { success:false, error:'PDF via SIRE (pending)' }; }
  async downloadCdr(_ruc: string, _id: string, _sp?: string): Promise<DownloadResult> { return { success:false, error:'CDR via SIRE (pending)' }; }
}

export function getSunatProvider(): ISunatProvider {
  return process.env.SUNAT_PROVIDER==='direct' ? new DirectSunatProvider() : new MockSunatProvider();
}
