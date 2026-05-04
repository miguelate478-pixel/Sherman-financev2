import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export interface SunatDocument {
  id: string; ruc: string; serie: string; numero: string;
  tipo: string; fecha: string; total: number; moneda: string;
  rsEmisor: string; rucEmisor: string; rsReceptor: string; rucReceptor: string;
  sunatStatus: string; cdrStatus: string;
  // Campos reales que devuelve SUNAT para el receptor/cliente
  tipoDocCliente?: string;   // "6" = RUC, "1" = DNI, "0" = sin doc
  numDocCliente?: string;    // RUC o DNI real (ej: "20611749792")
  razonSocialCliente?: string; // Razón social (puede venir vacío)
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
  bulkDownload(p: { ruc: string; period: string; operation: 'COMPRAS'|'VENTAS'; documentTypes: string[]; sireToken?: string; solUser?: string; solPass?: string }): Promise<BulkResult>;
  downloadXml(ruc: string, documentId: string, storagePath?: string): Promise<DownloadResult>;
  downloadPdf(ruc: string, documentId: string, storagePath?: string): Promise<DownloadResult>;
  downloadCdr(ruc: string, documentId: string, storagePath?: string): Promise<DownloadResult>;
  getSirePropuesta(ruc: string, period: string, tipo: 'RVIE'|'RCE', sireToken: string): Promise<{ numTicket: string; estado: string; archivoReporte?: { nomArchivoReporte: string }[] }>;
  consultarTicket(ticket: string, sireToken: string): Promise<{ numTicket: string; estado: string; archivoReporte?: { nomArchivoReporte: string }[] }>;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();
function getCached(key: string) { const c = tokenCache.get(key); if (c && c.expiresAt > Date.now() + 60_000) return c.token; return null; }
function setCache(key: string, token: string, expiresIn: number) { tokenCache.set(key, { token, expiresAt: Date.now() + expiresIn * 1000 }); }

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
  return `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:ID>${doc.serie}-${doc.numero}</cbc:ID><cbc:IssueDate>${doc.fecha}</cbc:IssueDate><cbc:InvoiceTypeCode listID="0101">${doc.tipo}</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>${doc.moneda}</cbc:DocumentCurrencyCode><cac:AccountingSupplierParty><cac:Party><cac:PartyTaxScheme><cbc:CompanyID>${doc.rucEmisor}</cbc:CompanyID></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${doc.rsEmisor}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty><cac:AccountingCustomerParty><cac:Party><cac:PartyTaxScheme><cbc:CompanyID>${doc.rucReceptor}</cbc:CompanyID></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${doc.rsReceptor}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty><cac:TaxTotal><cbc:TaxAmount currencyID="${doc.moneda}">${igv}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="${doc.moneda}">${base}</cbc:TaxableAmount><cac:TaxCategory><cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="${doc.moneda}">${Math.abs(doc.total).toFixed(2)}</cbc:PayableAmount></cac:LegalMonetaryTotal><cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="ZZ">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="${doc.moneda}">${base}</cbc:LineExtensionAmount><cac:Item><cbc:Description>Servicio profesional segun contrato de prestacion de servicios — ${doc.rsEmisor} — Periodo Abril 2026</cbc:Description><cac:SellersItemIdentification><cbc:ID>SRV-001</cbc:ID></cac:SellersItemIdentification></cac:Item><cac:Price><cbc:PriceAmount currencyID="${doc.moneda}">${base}</cbc:PriceAmount></cac:Price><cac:TaxTotal><cbc:TaxAmount currencyID="${doc.moneda}">${igv}</cbc:TaxAmount><cac:TaxSubtotal><cac:TaxCategory><cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal></cac:InvoiceLine></Invoice>`;
}

export class MockSunatProvider implements ISunatProvider {
  async getToken(_clientId?: string, _clientSecret?: string) { await sleep(400); return 'mock-cpe-' + Date.now(); }
  async getSireToken(_r: string, _u: string, _p: string, _clientId?: string, _clientSecret?: string) { await sleep(400); return 'mock-sire-' + Date.now(); }
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
    const cId = clientId || process.env.SUNAT_CLIENT_ID || '';
    const cSecret = clientSecret || process.env.SUNAT_CLIENT_SECRET || '';
    
    const key = `cpe-${cId}`;
    const c = getCached(key); if (c) return c;
    const res = await fetch(`${this.apiBase}/clientesextranet/${cId}/oauth2/token/`, {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({ grant_type:'client_credentials', scope:`${this.validateBase}/contribuyente/controlcpe`, client_id:cId, client_secret:cSecret }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SUNAT CPE token error ${res.status}: ${body}`);
    }
    const j = await res.json() as { access_token:string; expires_in:number };
    setCache(key, j.access_token, j.expires_in);
    return j.access_token;
  }

  async getSireToken(ruc: string, solUser: string, solPass: string, clientId?: string, clientSecret?: string): Promise<string> {
    const cId = clientId || process.env.SUNAT_CLIENT_ID || '';
    const cSecret = clientSecret || process.env.SUNAT_CLIENT_SECRET || '';
    
    const key = `sire-${ruc}`;
    const c = getCached(key); if (c) return c;
    const res = await fetch(`${this.apiBase}/clientessol/${cId}/oauth2/token/`, {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({ grant_type:'password', scope:`${this.validateBase}/contribuyente/migeigv`, client_id:cId, client_secret:cSecret, username:`${ruc}${solUser}`, password:solPass }),
    });
    if (!res.ok) throw new Error(`SIRE token error ${res.status}: ${await res.text()}`);
    const j = await res.json() as { access_token:string; expires_in:number };
    setCache(key, j.access_token, j.expires_in);
    return j.access_token;
  }

  async validateDocument(p: { ruc:string; token:string; numRuc:string; codComp:string; serie:string; numero:string; fecha:string; monto:number }): Promise<SunatValidationResult> {
    const res = await fetch(`${this.validateBase}/contribuyente/controlcpe/${p.ruc}/validarcomprobante`, {
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
    const ticket = await this.getSirePropuesta(p.ruc, p.period, tipo, token);
    let estado = ticket.estado; let finalTicket = ticket; let attempts = 0;
    while (estado!=='06' && estado!=='07' && attempts<20) { await sleep(2000); finalTicket = await this.consultarTicket(ticket.numTicket, token); estado = finalTicket.estado; attempts++; }
    if (estado==='07') throw new Error('SIRE ticket error');
    return { period:p.period, operation:p.operation, docsFound:0, docsXml:0, docsPdf:0, docsCdr:0, errors:0, documents:[] };
  }

  async getSirePropuesta(ruc: string, period: string, tipo: 'RVIE'|'RCE', token: string) {
    const per = period.replace('-','');
    const ep  = tipo==='RVIE' ? `/contribuyente/migeigv/libros/rvie/propuesta/web/propuesta/${per}/exportapropuesta?codTipoArchivo=0` : `/contribuyente/migeigv/libros/rce/propuesta/web/propuesta/${per}/exportacioncomprobantepropuesta?codTipoArchivo=0`;
    const res = await fetch(`${this.sireBase}${ep}`, { headers:{ Authorization:`Bearer ${token}`, Accept:'application/json' } });
    if (!res.ok) throw new Error(`SIRE propuesta error ${res.status}`);
    return res.json() as Promise<{ numTicket:string; estado:string; archivoReporte?:{ nomArchivoReporte:string }[] }>;
  }

  async consultarTicket(ticket: string, token: string) {
    const res = await fetch(`${this.sireBase}/contribuyente/migeigv/libros/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets?numTicket=${ticket}`, { headers:{ Authorization:`Bearer ${token}` } });
    return res.json() as Promise<{ numTicket:string; estado:string; archivoReporte?:{ nomArchivoReporte:string }[] }>;
  }

  async downloadXml(_ruc: string, _id: string, _sp?: string): Promise<DownloadResult> { return { success:false, error:'XML via SIRE propuesta ZIP (use mock mode to test)' }; }
  async downloadPdf(_ruc: string, _id: string, _sp?: string): Promise<DownloadResult> { return { success:false, error:'PDF via SIRE (pending)' }; }
  async downloadCdr(_ruc: string, _id: string, _sp?: string): Promise<DownloadResult> { return { success:false, error:'CDR via SIRE (pending)' }; }
}

export function getSunatProvider(): ISunatProvider {
  return process.env.SUNAT_PROVIDER==='direct' ? new DirectSunatProvider() : new MockSunatProvider();
}
