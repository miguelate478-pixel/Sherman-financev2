/**
 * sunat-browser.ts
 * Automatiza el portal e-factura.sunat.gob.pe para descargar XMLs
 * de comprobantes recibidos (compras) usando Puppeteer + Chromium.
 */

export interface BrowserXmlResult {
  docId:      string;
  serie:      string;
  numero:     string;
  tipo:       string;
  xmlContent: string;
  error?:     string;
}

export interface BrowserDownloadOptions {
  ruc:         string;
  solUser:     string;
  solPass:     string;
  period:      string;   // "2025-12"
  maxDocs?:    number;
  onProgress?: (msg: string) => void;
}

// ── Lanzar browser ──────────────────────────────────────────────────
async function getBrowser() {
  const puppeteer = await import('puppeteer');

  console.log('[BROWSER] Lanzando Chromium incluido con Puppeteer...');

  const browser = await puppeteer.default.launch({
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
    headless: true,
    timeout: 30000,
    ignoreHTTPSErrors: true,
  });

  return browser;
}

// ── Login SOL ───────────────────────────────────────────────────────
async function loginSol(
  page: import('puppeteer').Page,
  ruc: string,
  solUser: string,
  solPass: string,
  log: (m: string) => void
): Promise<boolean> {
  log('Navegando al portal SOL de SUNAT...');

  // Ir al menú principal de SUNAT (igual que el código que funciona)
  await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  // Esperar formulario de login
  await page.waitForSelector('#txtRuc', { timeout: 10000 });
  log('Formulario de login encontrado, ingresando credenciales...');

  // Llenar credenciales
  await page.type('#txtRuc', ruc, { delay: 80 });
  await page.type('#txtUsuario', solUser, { delay: 80 });
  await page.type('#txtContrasena', solPass, { delay: 80 });
  
  // Click en aceptar
  await page.click('#btnAceptar');
  
  // Esperar que cargue el menú principal
  await page.waitForSelector('#divContainerMenu', { timeout: 15000 });
  
  log('Login exitoso');
  return true;
}

// ── Navegar y descargar XMLs de comprobantes recibidos ──────────────
async function downloadReceivedXmls(
  page: import('puppeteer').Page,
  ruc: string,
  period: string,
  maxDocs: number,
  log: (m: string) => void
): Promise<BrowserXmlResult[]> {
  const results: BrowserXmlResult[] = [];
  const [year, month] = period.split('-');

  // Interceptar respuestas XML del portal
  const interceptedXmls: { url: string; content: string }[] = [];
  await page.setRequestInterception(true);

  page.on('request', req => {
    req.continue();
  });

  page.on('response', async (response) => {
    try {
      const url = response.url();
      const ct  = response.headers()['content-type'] || '';
      if (ct.includes('xml') || url.includes('.xml') || url.includes('descargar')) {
        const body = await response.text().catch(() => '');
        if (body.length > 100 && (body.includes('<?xml') || body.includes('<Invoice') || body.includes('<CreditNote'))) {
          interceptedXmls.push({ url, content: body });
          log(`XML interceptado: ${url.split('/').pop()} (${body.length} bytes)`);
        }
      }
    } catch {}
  });

  // ============================================
  // NAVEGACIÓN POR MENÚ (igual que código que funciona)
  // ============================================
  
  // PASO 1: Click en "Empresas" (data-id="2")
  log('Click en Empresas...');
  await page.evaluate(() => {
    const empresasDiv = document.querySelector('div[data-id="2"]') as HTMLElement
      || document.querySelector('#divOpcionServicio2') as HTMLElement;
    
    if (empresasDiv) {
      empresasDiv.click();
      return true;
    }
    
    // Fallback: buscar por texto
    const allDivs = Array.from(document.querySelectorAll('div.list-group-item'));
    const empresasItem = allDivs.find(d => {
      const h4 = d.querySelector('h4');
      return h4?.textContent?.trim().toLowerCase().includes('empresa');
    }) as HTMLElement;
    
    if (empresasItem) {
      empresasItem.click();
      return true;
    }
    
    return false;
  });
  await new Promise(r => setTimeout(r, 2000));
  log('Empresas seleccionado');

  // PASO 2: Click 1 - Comprobantes de pago (data-id2="11")
  log('Navegando menú: Comprobantes de pago...');
  await page.evaluate(() => {
    const el = document.querySelector('li[data-id2="11"] span.spanNivelDescripcion') as HTMLElement
      || Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
        .find(s => s.textContent?.trim() === 'Comprobantes de pago') as HTMLElement;
    if (el) el.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // PASO 3: Click 2 - Comprobantes de Pago nivel 2 (data-id2="11_38")
  log('Navegando menú: Comprobantes de Pago (nivel 2)...');
  await page.evaluate(() => {
    const el = document.querySelector('li[data-id2="11_38"] span.spanNivelDescripcion') as HTMLElement
      || Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
        .filter(s => s.textContent?.trim().toLowerCase() === 'comprobantes de pago')[1] as HTMLElement;
    if (el) el.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // PASO 4: Click 3 - Consulta de Comprobantes de Pago (data-id2="11_38_1")
  log('Navegando menú: Consulta de Comprobantes de Pago...');
  await page.evaluate(() => {
    const el = document.querySelector('li[data-id2="11_38_1"] span.spanNivelDescripcion') as HTMLElement
      || Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
        .find(s => s.textContent?.trim() === 'Consulta de Comprobantes de Pago') as HTMLElement;
    if (el) el.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // PASO 5: Click 4 - Nueva Consulta de comprobantes de pago (data-id2="11_38_1_1")
  log('Navegando menú: Nueva Consulta de comprobantes de pago...');
  await page.evaluate(() => {
    const el = document.querySelector('li[data-id2="11_38_1_1"] span.spanNivelDescripcion') as HTMLElement
      || Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
        .find(s => s.textContent?.trim() === 'Nueva Consulta de comprobantes de pago') as HTMLElement;
    if (el) el.click();
  });
  await new Promise(r => setTimeout(r, 4000));
  log('Formulario de consulta cargado');

  // ============================================
  // BUSCAR FORMULARIO EN IFRAME
  // ============================================
  log('Buscando formulario Angular en iframe...');
  let targetFrame = page.mainFrame();
  
  for (const frame of page.frames()) {
    try {
      const hasForm = await frame.evaluate(() =>
        !!(document.querySelector('input[formcontrolname="rucEmisor"]') ||
           document.querySelector('input[name="rucEmisor"]'))
      );
      if (hasForm) {
        targetFrame = frame;
        break;
      }
    } catch {}
  }
  
  log(`Frame encontrado: ${targetFrame.url()}`);

  // ============================================
  // SELECCIONAR "RECIBIDO"
  // ============================================
  log('Seleccionando filtro "Recibido"...');
  await targetFrame.evaluate(() => {
    const radio = document.querySelector('input[type="radio"][value="RBR"]') as HTMLInputElement
      || document.querySelector('input[id="recibido"]') as HTMLInputElement;
    if (radio) {
      radio.click();
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 1000));

  // ============================================
  // NOTA: El formulario está listo para consultas individuales
  // ============================================
  log(`Formulario listo para consultas de comprobantes del período ${year}-${month}`);
  log('NOTA: Este módulo está configurado para consultas individuales por RUC/Serie/Número');
  log('Para descarga masiva por período, usar SIRE API o CPE API cuando estén disponibles');

  // Si no obtuvimos XMLs via clicks, usar los interceptados
  if (results.length === 0 && interceptedXmls.length > 0) {
    log(`Usando ${interceptedXmls.length} XMLs interceptados de las respuestas HTTP`);
    for (const { url, content } of interceptedXmls) {
      const filename = url.split('/').pop() || '';
      const match = filename.match(/([A-Z]\d{3})-(\d+)/);
      results.push({
        docId:      match ? `${match[1]}-${match[2]}` : filename,
        serie:      match?.[1] || 'UNK',
        numero:     match?.[2] || '0',
        tipo:       '01',
        xmlContent: content,
      });
    }
  }

  log(`Total XMLs obtenidos: ${results.length}`);
  return results;
}

// ── Función principal exportada ─────────────────────────────────────
export async function downloadXmlsViaBrowser(opts: BrowserDownloadOptions): Promise<BrowserXmlResult[]> {
  const log = opts.onProgress ?? ((m: string) => console.log(`[BROWSER] ${m}`));
  const maxDocs = opts.maxDocs ?? 50;

  log(`Iniciando browser automation para ${opts.ruc} período ${opts.period}`);

  let browser: import('puppeteer').Browser | null = null;
  try {
    browser = await getBrowser();
    log('Chromium iniciado OK');

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const loggedIn = await loginSol(page, opts.ruc, opts.solUser, opts.solPass, log);
    if (!loggedIn) throw new Error('Login SOL fallido — verificar credenciales');

    const results = await downloadReceivedXmls(page, opts.ruc, opts.period, maxDocs, log);
    return results;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
      log('Browser cerrado');
    }
  }
}
