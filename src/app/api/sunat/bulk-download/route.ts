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

    // ── Browser compartido para scraping (se inicializa solo si es necesario) ──
    let browser: any = null;
    let browserPage: any = null;
    let browserAuthenticated = false;

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

    try {
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

              // 3. Si tampoco hay XML de CPE, intentar sesión HTTP directa (sin browser)
              if (!xmlForLines && op === 'COMPRAS' && cred) {
                try {
                  console.log(`[BULK] Intentando sesión HTTP directa para ${docId}...`);
                  const { fetchXmlViaSolSession } = await import('@/lib/providers/sunat-scraper');
                  
                  // Mapear tipo de comprobante
                  const tipoMap: Record<string, string> = {
                    '01': '01', // Factura
                    '03': '03', // Boleta
                    '07': '07', // Nota de crédito
                    '08': '08', // Nota de débito
                  };
                  const tipoCodigo = tipoMap[doc.tipo] || '01';
                  
                  const httpXml = await fetchXmlViaSolSession(
                    doc.serie,
                    doc.numero,
                    tipoCodigo,
                    doc.rucEmisor,
                    {
                      ruc: company.ruc as string,
                      solUser: cred.solUser as string,
                      solPass,
                    }
                  );
                  
                  if (httpXml) {
                    xmlForLines = httpXml;
                    console.log(`[BULK] XML HTTP descargado para ${docId}: ${xmlForLines.length} bytes`);
                    hasXml = true;
                    await updateDocument(docId, { hasXml: true });
                  } else {
                    console.log(`[BULK] HTTP no disponible para ${docId}`);
                  }
                } catch (httpErr) {
                  console.log(`[BULK] Error HTTP para ${docId}: ${(httpErr as Error).message}`);
                }
              }

              // 4. Si HTTP también falla, intentar scraping con browser (último recurso)
              if (!xmlForLines && op === 'COMPRAS' && cred) {
                try {
                  console.log(`[BULK] Intentando scraping para ${docId}...`);
                  
                  // Inicializar browser solo una vez
                  if (!browserAuthenticated) {
                    console.log('[BULK] Inicializando browser compartido...');
                    const puppeteer = await import('puppeteer');
                    browser = await puppeteer.default.launch({
                      headless: true,
                      args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--no-zygote',
                        '--single-process',
                        '--disable-extensions',
                        '--disable-background-networking',
                      ],
                    });
                    
                    browserPage = await browser.newPage();
                    await browserPage.setUserAgent(
                      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
                    );
                    
                    // LOGIN (solo una vez)
                    console.log('[BULK] Login en SUNAT...');
                    await browserPage.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
                      waitUntil: 'networkidle2',
                      timeout: 30000,
                    });
                    await browserPage.waitForSelector('#txtRuc', { timeout: 10000 });
                    await browserPage.type('#txtRuc', company.ruc as string, { delay: 50 });
                    await browserPage.type('#txtUsuario', cred.solUser as string, { delay: 50 });
                    await browserPage.type('#txtContrasena', solPass, { delay: 50 });
                    await browserPage.click('#btnAceptar');
                    await browserPage.waitForSelector('#divContainerMenu', { timeout: 15000 });
                    console.log('[BULK] Login OK - browser autenticado');
                    
                    // CLICK EN EMPRESAS (data-id="2")
                    await browserPage.evaluate(() => {
                      const empresasDiv =
                        document.querySelector('div[data-id="2"]') || document.querySelector('#divOpcionServicio2');
                      if (empresasDiv) {
                        (empresasDiv as HTMLElement).click();
                      }
                    });
                    await new Promise(r => setTimeout(r, 2000));
                    
                    // NAVEGACIÓN POR MENÚ (4 CLICKS)
                    await browserPage.evaluate(() => {
                      const el =
                        document.querySelector('li[data-id2="11"] span.spanNivelDescripcion') ||
                        Array.from(document.querySelectorAll('span.spanNivelDescripcion')).find(
                          s => (s as HTMLElement).textContent?.trim() === 'Comprobantes de pago'
                        );
                      if (el) (el as HTMLElement).click();
                    });
                    await new Promise(r => setTimeout(r, 1500));
                    
                    await browserPage.evaluate(() => {
                      const el =
                        document.querySelector('li[data-id2="11_38"] span.spanNivelDescripcion') ||
                        Array.from(document.querySelectorAll('span.spanNivelDescripcion')).filter(
                          s => (s as HTMLElement).textContent?.trim().toLowerCase() === 'comprobantes de pago'
                        )[1];
                      if (el) (el as HTMLElement).click();
                    });
                    await new Promise(r => setTimeout(r, 1500));
                    
                    await browserPage.evaluate(() => {
                      const el =
                        document.querySelector('li[data-id2="11_38_1"] span.spanNivelDescripcion') ||
                        Array.from(document.querySelectorAll('span.spanNivelDescripcion')).find(
                          s => (s as HTMLElement).textContent?.trim() === 'Consulta de Comprobantes de Pago'
                        );
                      if (el) (el as HTMLElement).click();
                    });
                    await new Promise(r => setTimeout(r, 1500));
                    
                    await browserPage.evaluate(() => {
                      const el =
                        document.querySelector('li[data-id2="11_38_1_1"] span.spanNivelDescripcion') ||
                        Array.from(document.querySelectorAll('span.spanNivelDescripcion')).find(
                          s => (s as HTMLElement).textContent?.trim() === 'Nueva Consulta de comprobantes de pago'
                        );
                      if (el) (el as HTMLElement).click();
                    });
                    await new Promise(r => setTimeout(r, 4000));
                    
                    browserAuthenticated = true;
                    console.log('[BULK] Browser autenticado y navegado al formulario');
                  }
                  
                  // Usar el browser ya autenticado para descargar este documento
                  console.log(`[BULK] Usando browser compartido para ${docId}...`);
                  
                  // BUSCAR FORMULARIO EN IFRAME
                  let targetFrame = browserPage.mainFrame();
                  for (const frame of browserPage.frames()) {
                    try {
                      const hasForm = await frame.evaluate(
                        () =>
                          !!(
                            document.querySelector('input[formcontrolname="rucEmisor"]') ||
                            document.querySelector('input[name="rucEmisor"]')
                          )
                      );
                      if (hasForm) {
                        targetFrame = frame;
                        break;
                      }
                    } catch {}
                  }
                  
                  // LLENAR FORMULARIO
                  await targetFrame.evaluate(() => {
                    const r =
                      (document.querySelector('input[type="radio"][value="RBR"]') as HTMLInputElement) ||
                      (document.querySelector('input[id="recibido"]') as HTMLInputElement);
                    if (r) {
                      r.click();
                      r.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                  });
                  await new Promise(r => setTimeout(r, 500));
                  
                  // RUC EMISOR
                  await targetFrame.evaluate((ruc: string) => {
                    const input =
                      (document.querySelector('input[formcontrolname="rucEmisor"]') as HTMLInputElement) ||
                      (document.querySelector('input[name="rucEmisor"]') as HTMLInputElement);
                    if (!input) return;
                    input.focus();
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
                    setter.call(input, ruc);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('blur', { bubbles: true }));
                  }, doc.rucEmisor);
                  await new Promise(r => setTimeout(r, 500));
                  
                  // DROPDOWN FACTURA
                  await targetFrame.evaluate(() => {
                    const trigger =
                      (document.querySelector('div[role="button"][aria-haspopup="listbox"]') as HTMLElement) ||
                      (document.querySelector('p-dropdown div.p-dropdown-trigger') as HTMLElement);
                    if (trigger) trigger.click();
                  });
                  await new Promise(r => setTimeout(r, 800));
                  
                  await targetFrame.evaluate(() => {
                    const items = Array.from(
                      document.querySelectorAll('li[role="option"], .p-dropdown-item, li.p-dropdown-item')
                    );
                    const factura = items.find(i => (i as HTMLElement).textContent?.trim() === 'Factura');
                    if (factura) (factura as HTMLElement).click();
                  });
                  await new Promise(r => setTimeout(r, 500));
                  
                  // SERIE
                  await targetFrame.evaluate((serie: string) => {
                    const input =
                      (document.querySelector('input[formcontrolname="serieComprobante"]') as HTMLInputElement) ||
                      (document.querySelector('input[name="serieComprobante"]') as HTMLInputElement);
                    if (!input) return;
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
                    setter.call(input, serie);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                  }, doc.serie);
                  await new Promise(r => setTimeout(r, 500));
                  
                  // NÚMERO
                  await targetFrame.evaluate((numero: string) => {
                    const input =
                      (document.querySelector('input[formcontrolname="numeroComprobante"]') as HTMLInputElement) ||
                      (document.querySelector('input[name="numeroComprobante"]') as HTMLInputElement);
                    if (!input) return;
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
                    setter.call(input, numero);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                  }, doc.numero);
                  await new Promise(r => setTimeout(r, 500));
                  
                  // CONSULTAR
                  await targetFrame.evaluate(() => {
                    const btn =
                      (document.querySelector('button.btn.boton-primary') as HTMLElement) ||
                      (document.querySelector('button[type="submit"]') as HTMLElement) ||
                      (Array.from(document.querySelectorAll('button')).find(b =>
                        (b as HTMLElement).textContent?.trim().toLowerCase().includes('consultar')
                      ) as HTMLElement);
                    if (btn) btn.click();
                  });
                  await new Promise(r => setTimeout(r, 5000));
                  
                  // ESPERAR MODAL
                  await targetFrame.waitForSelector('ngb-modal-window, .modal-dialog, control-cpe-factura', {
                    timeout: 15000,
                  });
                  await new Promise(r => setTimeout(r, 2000));
                  
                  // INTERCEPTAR XML
                  const xmlContent = await new Promise<string | null>(resolve => {
                    const timeout = setTimeout(() => resolve(null), 15000);
                    
                    browserPage.on('response', async (response: any) => {
                      const url = response.url();
                      const ct = response.headers()['content-type'] || '';
                      if (url.includes('.xml') || ct.includes('xml') || ct.includes('octet-stream')) {
                        try {
                          const text = await response.text();
                          if (text.includes('<?xml') || text.includes('<Invoice') || text.includes('<CreditNote')) {
                            clearTimeout(timeout);
                            resolve(text);
                          }
                        } catch {}
                      }
                    });
                    
                    // Click en botón XML
                    targetFrame
                      .evaluate(() => {
                        const container = document.querySelector('div.button-container, .button-container');
                        if (container) {
                          const buttons = container.querySelectorAll('button');
                          if (buttons[1]) {
                            (buttons[1] as HTMLElement).click();
                            return true;
                          }
                        }
                        
                        const allBtns = Array.from(document.querySelectorAll('button'));
                        const xmlBtn = allBtns.find(b => {
                          const title = ((b as HTMLElement).title || b.getAttribute('aria-label') || '').toLowerCase();
                          const cls = ((b as HTMLElement).className || '').toLowerCase();
                          return title.includes('xml') || cls.includes('xml');
                        });
                        
                        if (xmlBtn) {
                          (xmlBtn as HTMLElement).click();
                          return true;
                        }
                        
                        const ngxBtns = Array.from(
                          document.querySelectorAll('ngb-modal-window button, .modal button')
                        );
                        if (ngxBtns.length >= 2) {
                          (ngxBtns[1] as HTMLElement).click();
                          return true;
                        }
                        
                        return false;
                      })
                      .catch(() => {});
                  });

                  if (xmlContent) {
                    xmlForLines = xmlContent;
                    console.log(`[BULK] XML scrapeado para ${docId}: ${xmlForLines.length} bytes`);
                    hasXml = true;
                    await updateDocument(docId, { hasXml: true });
                  } else {
                    console.log(`[BULK] Scraping falló para ${docId}: sin XML`);
                  }
                } catch (scraperErr) {
                  console.log(`[BULK] Error scraping para ${docId}: ${(scraperErr as Error).message}`);
                }
              }

              // 4. Parsear XML y guardar líneas
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
                await updateDocument(docId, { parserStatus: 'SIN_XML' });
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
    } finally {
      // Cerrar browser compartido si fue inicializado
      if (browser) {
        try {
          await browser.close();
          console.log('[BULK] Browser compartido cerrado');
        } catch (e) {
          console.error('[BULK] Error cerrando browser:', (e as Error).message);
        }
      }
    }
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
// Datos que devuelve el polling cuando el ticket está listo
interface TicketResult {
  nomArchivo: string;
  codTipoArchivo: string;
  codProceso: string;
  ticket: string;
}

async function esperarTicket(ticket: string, periodo: string, tipo: 'RVIE'|'RCE', token: string, maxIntentos = 60, intervaloMs = 5000): Promise<TicketResult> {
  // Manual SIRE v25 sección 5.31 — mismo endpoint para RCE y RVIE, distinto codLibro
  const codLibro = tipo === 'RCE' ? '080000' : '140000';
  const url = `${SIRE_BASE}/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets`
    + `?perIni=${periodo}&perFin=${periodo}&page=1&perPage=20&numTicket=${ticket}&codLibro=${codLibro}&codOrigenEnvio=2`;

  console.log(`[POLLING] URL polling ${tipo} (codLibro=${codLibro}): ${url}`);

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
      console.log(`[POLLING] Respuesta intento ${i}: ${raw.substring(0, 500)}`);

      let data: Record<string,unknown>;
      try { data = JSON.parse(raw); } catch { continue; }

      const registros = (data.registros as Record<string,unknown>[]) ?? [data];
      const reg = registros.find(r => String(r.numTicket) === ticket) ?? registros[0];
      if (!reg) { console.log(`[POLLING] Sin registro para ticket ${ticket}`); continue; }

      // SUNAT devuelve codEstadoProceso="06" cuando termina (codProceso="10" es el tipo de proceso)
      const codEstadoProc = String(reg.codEstadoProceso ?? '');
      const codProceso    = String(reg.codProceso ?? '');
      const archivoArr    = reg.archivoReporte as Record<string,unknown>[] | undefined;

      // OJO: SUNAT tiene typo en el campo — es "codTipoAchivoReporte" (sin r)
      const nomArchivo = String(
        archivoArr?.[0]?.nomArchivoReporte
        ?? ''
      );
      const codTipoArchivo = String(
        archivoArr?.[0]?.codTipoAchivoReporte   // typo oficial SUNAT
        ?? archivoArr?.[0]?.codTipoArchivoReporte  // fallback con ortografía correcta
        ?? ''
      );

      console.log(`[POLLING] codEstadoProceso=${codEstadoProc} codProceso=${codProceso} archivo=${nomArchivo} codTipo=${codTipoArchivo}`);

      // Terminado: codEstadoProceso="06" (Terminado según SUNAT)
      const terminado = codEstadoProc === '06';
      const error     = codEstadoProc === '07';

      if (terminado) {
        if (!nomArchivo) throw new Error(`Ticket listo (codEstado=06) pero sin nombre de archivo`);
        return { nomArchivo, codTipoArchivo, codProceso, ticket };
      }
      if (error) throw new Error(`SIRE reportó error en ticket (codEstado=${codEstadoProc})`);
      // Otros estados: seguir esperando
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('error en ticket') || msg.includes('sin nombre de archivo')) throw e;
      console.log(`[POLLING] Error en intento ${i}: ${msg}`);
    }
  }
  throw new Error(`Timeout: ticket ${ticket} no completó en ${maxIntentos * intervaloMs / 1000}s`);
}

/** Descarga el ZIP usando los parámetros exactos del manual SIRE v25 sección 5.32 */
async function descargarZip(result: TicketResult, periodo: string, tipo: 'RVIE'|'RCE', token: string): Promise<Buffer> {
  const codLibro = tipo === 'RCE' ? '080000' : '140000';

  // URL principal según manual v25 sección 5.32 con todos los parámetros requeridos
  const params = new URLSearchParams({
    nomArchivoReporte:     result.nomArchivo,
    codTipoArchivoReporte: result.codTipoArchivo || 'null',
    perTributario:         periodo,
    codProceso:            result.codProceso,
    numTicket:             result.ticket,
    codLibro,
  });
  const urlPrincipal = `https://apisire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte?${params}`;

  // Fallbacks con api-sire (con guion) y sin parámetros extra
  const urlFallback1 = `${SIRE_BASE}/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte?${params}`;
  const urlFallback2 = `${SIRE_BASE}/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte`
    + `?nomArchivoReporte=${encodeURIComponent(result.nomArchivo)}&codLibro=${codLibro}`;

  const dlHeaders = { ...sireHeaders(token), 'Accept': 'application/octet-stream, application/zip, */*' };

  for (const url of [urlPrincipal, urlFallback1, urlFallback2]) {
    console.log(`[POLLING] Intentando descarga ZIP ${tipo}: ${url}`);
    try {
      const res = await fetch(url, { headers: dlHeaders, signal: AbortSignal.timeout(60000) });
      if (!res.ok) {
        const body = await res.text();
        console.log(`[POLLING] HTTP ${res.status}: ${body.substring(0, 300)}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      console.log(`[POLLING] ZIP ${tipo} descargado OK: ${buf.length} bytes`);
      return buf;
    } catch (e) {
      console.log(`[POLLING] Error fetch: ${(e as Error).message}`);
    }
  }
  throw new Error(`No se pudo descargar ZIP ${tipo} — todos los endpoints fallaron`);
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
    console.log(`[PARSE] v3 — ${pendientes.length} docs pendientes en ${period}`);
    if (pendientes.length === 0) return ok({ parsed: 0, errors: 0, sinXml: 0, total: 0, message: 'No hay documentos pendientes' });

    const compras = pendientes.filter(d => d.operation === 'COMPRA');
    const ventas  = pendientes.filter(d => d.operation === 'VENTA');
    console.log(`[PARSE] v3 — Compras: ${compras.length} (SIN_XML) | Ventas: ${ventas.length} (CPE API)`);

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

    // ── COMPRAS: XMLs NO disponibles via SIRE API ───────────────────
    // SUNAT no expone XMLs de comprobantes recibidos al receptor.
    // El ZIP de propuesta RCE contiene un TXT de resumen, no XMLs individuales.
    if (compras.length > 0) {
      console.log(`[PARSE] COMPRAS: ${compras.length} docs — XMLs de compras recibidas no disponibles via API SUNAT`);
      for (const doc of compras as Record<string,unknown>[]) {
        await updateDocument(doc.id as string, { parserStatus: 'SIN_XML' });
        sinXml++;
      }
    }

    // ── VENTAS: XMLs via CPE API (comprobantes que nosotros emitimos) ─
    if (ventas.length > 0) {
      try {
        if (!clientId || !clientSecret) {
          console.log('[PARSE] Sin clientId/clientSecret para CPE API');
          for (const doc of ventas as Record<string,unknown>[]) {
            await updateDocument(doc.id as string, { parserStatus: 'SIN_XML' });
            sinXml++;
          }
        } else {
          const cpeToken = await getCpeToken(
            company.ruc as string, cred.solUser as string, solPass, clientId, clientSecret
          );
          console.log(`[PARSE] Token CPE OK — procesando ${ventas.length} ventas`);

          for (const doc of ventas as Record<string,unknown>[]) {
            const docId    = doc.id as string;
            const serie    = doc.serie as string;
            const numero   = doc.number as string;
            const tipo     = doc.docType as string;
            const rucEmisor = company.ruc as string; // ventas: emisor = la empresa

            console.log(`[PARSE] Venta ${docId} — CPE ${tipo}/${serie}/${numero}/${rucEmisor}`);
            try {
              const cpeResult = await downloadCpeFile(cpeToken, tipo, serie, numero, rucEmisor, 'xml');
              if (!cpeResult.ok || cpeResult.content.length === 0) {
                console.log(`[PARSE] ${docId}: XML CPE no disponible — ${cpeResult.error}`);
                sinXml++;
                await updateDocument(docId, { parserStatus: 'SIN_XML' });
                continue;
              }
              const xmlContent = cpeResult.content.toString('utf8');
              const { parseXmlUbl } = await import('@/lib/xml-parser');
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
              console.error(`[PARSE] Error en ${docId}:`, (e as Error).message);
              await updateDocument(docId, { parserStatus: 'ERROR' });
              errors++;
            }
          }
        }
      } catch (e) {
        console.error('[PARSE] Error procesando ventas via CPE:', (e as Error).message);
        console.error('[PARSE] Stack ventas:', (e as Error).stack?.split('\n').slice(0,3).join(' | '));
        for (const doc of ventas as Record<string,unknown>[]) {
          await updateDocument(doc.id as string, { parserStatus: 'ERROR' });
        }
        errors += ventas.length;
      }
    }

    await createAuditLog({
      userId: user.sub, userEmail: user.email, userRole: user.role,
      action: 'PARSE_XML_SIRE_ZIP',
      object: `${companyId} ${period} parsed=${parsed} errors=${errors} sinXml=${sinXml}`,
      ip: getIP(req),
    });

    return ok({ parsed, errors, sinXml, total: pendientes.length, version: 'v3-cpe' });
  } catch(e) { return err(`Error: ${(e as Error).message}`, 500); }
}
