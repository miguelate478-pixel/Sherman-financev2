import { execSync } from 'child_process';

export interface ScraperCreds {
  ruc: string;
  solUser: string;
  solPass: string;
}

export interface ScraperFactura {
  rucEmisor: string;
  tipoComprobante: string; // '01','03','07','08'
  serie: string;
  numero: string;
}

export interface ScraperResult {
  xmlContent: string | null;
  error?: string;
  logs: string[];
}

// ── Xvfb ─────────────────────────────────────────────────
let xvfbStarted = false;
function startXvfb(): void {
  if (xvfbStarted) return;
  try {
    try { execSync('pkill -f "Xvfb :99"', { stdio: 'ignore' }); } catch {}
    execSync('Xvfb :99 -screen 0 1280x900x24 -ac +extension GLX +render -noreset &', { stdio: 'ignore' });
    execSync('sleep 1', { stdio: 'ignore' });
    process.env.DISPLAY = ':99';
    xvfbStarted = true;
    console.log('[XVFB] Display virtual :99 iniciado');
  } catch (e) {
    console.warn('[XVFB] No disponible (desarrollo local):', (e as Error).message);
  }
}

function getChromiumPath(): string {
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    process.env.PUPPETEER_EXECUTABLE_PATH || '',
  ];
  for (const p of candidates) {
    if (!p) continue;
    try { execSync(`test -f "${p}"`, { stdio: 'ignore' }); return p; } catch {}
  }
  return '';
}

// ── Scraper principal ─────────────────────────────────────
export async function downloadXmlFromSunat(
  creds: ScraperCreds,
  factura: ScraperFactura
): Promise<ScraperResult> {
  const logs: string[] = [];
  const log = (m: string) => { console.log(`[SCRAPER] ${m}`); logs.push(m); };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require('puppeteer-extra');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());

  startXvfb();
  const chromiumPath = getChromiumPath();
  const useXvfb = xvfbStarted && !!process.env.DISPLAY;

  log(`Chromium: ${chromiumPath || 'bundled'} | Display: ${useXvfb ? ':99 (Xvfb)' : 'headless'}`);

  let browser: import('puppeteer').Browser | undefined;
  let capturedXml = '';

  try {
    browser = await puppeteer.launch({
      headless: !useXvfb,
      executablePath: chromiumPath || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--start-maximized',
        ...(useXvfb ? ['--display=:99'] : []),
      ],
      defaultViewport: null,
    });

    if (!browser) throw new Error('Browser no iniciado');
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Interceptar respuestas XML
    page.on('response', async res => {
      const url = res.url();
      const ct  = res.headers()['content-type'] || '';
      if ((url.includes('/xml') || url.includes('comprobante')) &&
          (ct.includes('xml') || ct.includes('octet') || ct.includes('zip'))) {
        try {
          const body = await res.text();
          if (body.trim().startsWith('<') && body.length > 200) {
            capturedXml = body;
            log(`XML interceptado de ${url.substring(0, 80)}: ${body.length} bytes`);
          }
        } catch {}
      }
    });

    // ── PASO 1: LOGIN ─────────────────────────────────────
    log(`Login en SUNAT para RUC ${creds.ruc}...`);
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2', timeout: 30000,
    });
    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    await page.type('#txtRuc',        creds.ruc,     { delay: 80 });
    await page.type('#txtUsuario',    creds.solUser, { delay: 80 });
    await page.type('#txtContrasena', creds.solPass, { delay: 80 });
    await page.click('#btnAceptar');
    await page.waitForSelector('#divContainerMenu', { timeout: 15000 });
    log('Login OK');

    // ── PASO 2: CLICK EN EMPRESAS (data-id="2") ───────────
    log('Seleccionando Empresas...');
    await page.evaluate(() => {
      const el = document.querySelector('div[data-id="2"]') ||
        document.querySelector('#divOpcionServicio2') ||
        Array.from(document.querySelectorAll('div.list-group-item'))
          .find(d => d.querySelector('h4')?.textContent?.trim().toLowerCase().includes('empresa'));
      if (el) (el as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 2000));
    log('Empresas seleccionado');

    // ── PASO 3: 4 CLICKS EN EL MENÚ ──────────────────────
    // Click 1: Comprobantes de pago (data-id2="11")
    log('Click 1: Comprobantes de pago...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11"] span.spanNivelDescripcion') ||
        Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
          .find(s => s.textContent?.trim() === 'Comprobantes de pago');
      if (el) (el as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Click 2: Comprobantes de Pago nivel 2 (data-id2="11_38")
    log('Click 2: Comprobantes de Pago nivel 2...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11_38"] span.spanNivelDescripcion') ||
        Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
          .filter(s => s.textContent?.trim().toLowerCase() === 'comprobantes de pago')[1];
      if (el) (el as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Click 3: Consulta de Comprobantes de Pago (data-id2="11_38_1")
    log('Click 3: Consulta de Comprobantes de Pago...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11_38_1"] span.spanNivelDescripcion') ||
        Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
          .find(s => s.textContent?.trim() === 'Consulta de Comprobantes de Pago');
      if (el) (el as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Click 4: Nueva Consulta (data-id2="11_38_1_1")
    log('Click 4: Nueva Consulta de comprobantes de pago...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11_38_1_1"] span.spanNivelDescripcion') ||
        Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
          .find(s => s.textContent?.trim() === 'Nueva Consulta de comprobantes de pago');
      if (el) (el as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 4000));
    log('Menú navegado OK');

    // ── PASO 4: BUSCAR IFRAME CON FORMULARIO ──────────────
    log('Buscando formulario Angular en iframe...');
    let targetFrame = page.mainFrame();
    for (const frame of page.frames()) {
      try {
        const hasForm = await frame.evaluate(() =>
          !!(document.querySelector('input[formcontrolname="rucEmisor"]') ||
             document.querySelector('input[name="rucEmisor"]'))
        );
        if (hasForm) { targetFrame = frame; break; }
      } catch {}
    }
    log(`Frame: ${targetFrame.url().substring(0, 80)}`);

    // ── PASO 5: SELECCIONAR "RECIBIDO" ────────────────────
    log('Seleccionando filtro Recibido...');
    await targetFrame.evaluate(() => {
      const radio = document.querySelector('input[type="radio"][value="RBR"]') ||
        document.querySelector('input[id="recibido"]') ||
        Array.from(document.querySelectorAll('input[type="radio"]'))
          .find(r => document.querySelector(`label[for="${r.id}"]`)?.textContent?.toLowerCase().includes('recibido'));
      if (radio) {
        (radio as HTMLInputElement).click();
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1000));

    // ── PASO 6: LLENAR FORMULARIO ─────────────────────────
    log(`Llenando formulario: ${factura.rucEmisor} ${factura.serie}-${factura.numero}`);

    // RUC Emisor — usar nativeInputValueSetter para Angular
    await targetFrame.evaluate((rucEmisor: string) => {
      const input = document.querySelector('input[formcontrolname="rucEmisor"]') ||
        document.querySelector('input[name="rucEmisor"]') as HTMLInputElement | null;
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, rucEmisor);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    }, factura.rucEmisor);
    await new Promise(r => setTimeout(r, 800));

    // Tipo comprobante — PrimeNG dropdown
    await targetFrame.evaluate(() => {
      const trigger = document.querySelector('div[role="button"][aria-haspopup="listbox"]') ||
        document.querySelector('p-dropdown div.p-dropdown-trigger');
      if (trigger) (trigger as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await targetFrame.evaluate(() => {
      const items = Array.from(document.querySelectorAll('li[role="option"], .p-dropdown-item'));
      const factura = items.find(i => i.textContent?.trim() === 'Factura');
      if (factura) (factura as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Serie
    await targetFrame.evaluate((serie: string) => {
      const input = document.querySelector('input[formcontrolname="serieComprobante"]') ||
        document.querySelector('input[name="serieComprobante"]') as HTMLInputElement | null;
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, serie);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, factura.serie);
    await new Promise(r => setTimeout(r, 500));

    // Número
    await targetFrame.evaluate((numero: string) => {
      const input = document.querySelector('input[formcontrolname="numeroComprobante"]') ||
        document.querySelector('input[name="numeroComprobante"]') as HTMLInputElement | null;
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, numero);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, factura.numero);
    await new Promise(r => setTimeout(r, 500));
    log('Formulario llenado OK');

    // ── PASO 7: CLICK CONSULTAR ───────────────────────────
    log('Consultando...');
    await targetFrame.evaluate(() => {
      const btn = document.querySelector('button.btn.boton-primary') ||
        document.querySelector('button[type="submit"]') ||
        Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent?.trim().toLowerCase().includes('consultar'));
      if (btn) (btn as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 5000));

    // Verificar resultados
    const hasResults = await targetFrame.evaluate(() => {
      const body = document.body.textContent || '';
      return !body.toLowerCase().includes('no se encontraron') &&
             !body.toLowerCase().includes('sin resultados');
    });

    if (!hasResults) {
      return { xmlContent: null, error: 'Comprobante no encontrado en SUNAT', logs };
    }
    log('Comprobante encontrado');

    // ── PASO 8: ESPERAR MODAL Y CLICK XML ─────────────────
    log('Esperando modal...');
    try {
      await targetFrame.waitForSelector('ngb-modal-window, .modal-dialog, control-cpe-factura', {
        timeout: 10000,
      });
    } catch {
      log('Modal no apareció automáticamente — buscando botón de detalle...');
      // Puede que haya que hacer click en la fila primero
      await targetFrame.evaluate(() => {
        const row = document.querySelector('tr.ng-star-inserted, tbody tr');
        if (row) (row as HTMLElement).click();
      });
      await new Promise(r => setTimeout(r, 3000));
    }

    await new Promise(r => setTimeout(r, 2000));

    // Configurar descarga
    const downloadPath = '/tmp/sunat-downloads';
    try { execSync(`mkdir -p ${downloadPath}`, { stdio: 'ignore' }); } catch {}

    // Usar CDP para capturar descargas
    const cdpSession = await page.createCDPSession();
    await cdpSession.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath,
    });

    // Click en botón XML (segundo botón del modal — el verde)
    log('Haciendo click en botón XML...');
    const xmlClicked = await targetFrame.evaluate(() => {
      // Método 1: button-container, segundo botón
      const container = document.querySelector('div.button-container, .button-container');
      if (container) {
        const buttons = container.querySelectorAll('button');
        if (buttons[1]) { (buttons[1] as HTMLElement).click(); return 'button-container[1]'; }
      }
      // Método 2: por título/aria-label
      const allBtns = Array.from(document.querySelectorAll('button'));
      const xmlBtn = allBtns.find(b => {
        const t = (b.title || b.getAttribute('aria-label') || '').toLowerCase();
        return t.includes('xml');
      });
      if (xmlBtn) { (xmlBtn as HTMLElement).click(); return 'aria-label xml'; }
      // Método 3: segundo botón del modal
      const modalBtns = Array.from(document.querySelectorAll('ngb-modal-window button, .modal button'));
      if (modalBtns.length >= 2) { (modalBtns[1] as HTMLElement).click(); return 'modal[1]'; }
      return null;
    });

    if (!xmlClicked) {
      log('No se encontró botón XML — intentando fetch autenticado...');
    } else {
      log(`Click XML: ${xmlClicked}`);
      await new Promise(r => setTimeout(r, 5000));
    }

    // Verificar si se capturó XML via intercepción
    if (capturedXml) {
      log(`XML capturado via intercepción: ${capturedXml.length} bytes`);
      return { xmlContent: capturedXml, logs };
    }

    // Verificar descarga en disco
    try {
      const files = execSync(`ls ${downloadPath} 2>/dev/null || echo ""`, { encoding: 'utf8' })
        .trim().split('\n').filter(f => f.endsWith('.xml') || f.endsWith('.zip'));
      if (files.length > 0) {
        const { readFileSync } = await import('fs');
        const content = readFileSync(`${downloadPath}/${files[0]}`, 'utf8');
        if (content.trim().startsWith('<')) {
          log(`XML leído de disco: ${content.length} bytes`);
          return { xmlContent: content, logs };
        }
      }
    } catch {}

    // Último recurso: fetch autenticado desde el contexto del browser
    log('Último intento: fetch autenticado...');
    const fetchResult = await targetFrame.evaluate(
      async ({ rucEmisor, tipo, serie, numero, receptorRuc }: Record<string, string>) => {
        const url = `/cl-ti-itmrconsrecec/jaxrs/comprobante/xml` +
          `?numRuc=${receptorRuc}&codTipo=${tipo}&numSerie=${serie}&numCorrelativo=${numero}&numRucEmisor=${rucEmisor}`;
        try {
          const r = await fetch(url, { credentials: 'include' });
          const t = await r.text();
          if (t.trim().startsWith('<') && t.length > 200) return t;
        } catch {}
        return null;
      },
      { rucEmisor: factura.rucEmisor, tipo: factura.tipoComprobante,
        serie: factura.serie, numero: factura.numero, receptorRuc: creds.ruc }
    );

    if (fetchResult) {
      log(`XML via fetch autenticado: ${(fetchResult as string).length} bytes`);
      return { xmlContent: fetchResult as string, logs };
    }

    return { xmlContent: null, error: 'XML no disponible — SUNAT no expone XMLs de compras recibidas via API', logs };

  } catch (error) {
    const msg = (error as Error).message;
    log(`Error: ${msg}`);
    return { xmlContent: null, error: msg, logs };
  } finally {
    if (browser) { try { await browser.close(); } catch {} }
  }
}

// ── Sesión HTTP directa (fallback rápido) ─────────────────
export async function fetchXmlViaSolSession(
  serie: string, numero: string, tipoCodigo: string,
  emisorRuc: string, receptorRuc: string, creds: ScraperCreds
): Promise<string | null> {
  try {
    const loginRes = await fetch('https://www.sunat.gob.pe/sol.html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
      body: new URLSearchParams({ tipo: '2', ruc: creds.ruc, usuario: creds.solUser, password: creds.solPass }),
      redirect: 'manual', signal: AbortSignal.timeout(15000),
    });
    const cookies = (loginRes.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
    if (!cookies) return null;
    const url = `https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/comprobante/xml` +
      `?numRuc=${receptorRuc}&codTipo=${tipoCodigo}&numSerie=${serie}&numCorrelativo=${numero}&numRucEmisor=${emisorRuc}`;
    const res = await fetch(url, { headers: { Cookie: cookies, 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
    if (res.ok) { const t = await res.text(); if (t.trim().startsWith('<') && t.length > 100) return t; }
    return null;
  } catch { return null; }
}
