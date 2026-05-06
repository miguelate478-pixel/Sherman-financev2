/**
 * sunat-browser.ts
 * Automatiza el portal e-factura.sunat.gob.pe para descargar XMLs
 * de comprobantes recibidos (compras) usando Puppeteer + Chromium.
 *
 * Flujo:
 *  1. Login con credenciales SOL (RUC + usuario + clave)
 *  2. Navegar a "Mis Comprobantes Recibidos"
 *  3. Filtrar por período
 *  4. Descargar XML de cada comprobante
 *  5. Retornar mapa { docId: xmlContent }
 */

export interface BrowserXmlResult {
  docId:      string;   // serie-numero
  serie:      string;
  numero:     string;
  tipo:       string;
  xmlContent: string;
  error?:     string;
}

export interface BrowserDownloadOptions {
  ruc:        string;
  solUser:    string;
  solPass:    string;
  period:     string;   // "2025-12"
  maxDocs?:   number;   // límite de docs a descargar (default 50)
  onProgress?: (msg: string) => void;
}

// ── Lazy-load puppeteer para no romper el build si no está disponible ──
async function getBrowser() {
  try {
    // En producción (Railway/Linux): usar chromium del sistema via @sparticuz/chromium
    // En desarrollo (Windows/Mac): usar puppeteer-core con Chrome local
    const puppeteer = await import('puppeteer-core');

    let executablePath: string;
    let args: string[];

    if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
      // Railway: usar @sparticuz/chromium
      const chromium = await import('@sparticuz/chromium');
      executablePath = await chromium.default.executablePath();
      args = chromium.default.args;
    } else {
      // Desarrollo local: buscar Chrome instalado
      const os = await import('os');
      const platform = os.default.platform();
      if (platform === 'win32') {
        executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      } else if (platform === 'darwin') {
        executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      } else {
        executablePath = '/usr/bin/google-chrome';
      }
      args = ['--no-sandbox', '--disable-setuid-sandbox'];
    }

    const browser = await puppeteer.default.launch({
      executablePath,
      args: [
        ...args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1280,800',
      ],
      headless: true,
      timeout: 30000,
    });

    return browser;
  } catch (e) {
    throw new Error(`No se pudo iniciar Chromium: ${(e as Error).message}`);
  }
}

// ── Esperar a que un selector aparezca con timeout ──
async function waitFor(page: import('puppeteer-core').Page, selector: string, timeout = 15000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

// ── Login en el portal SOL de SUNAT ──
async function loginSol(
  page: import('puppeteer-core').Page,
  ruc: string,
  solUser: string,
  solPass: string,
  log: (m: string) => void
): Promise<boolean> {
  log('Navegando al portal SOL...');
  await page.goto('https://e-factura.sunat.gob.pe/', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  // Esperar formulario de login
  const loginOk = await waitFor(page, 'input[name="txtRuc"], input[id="txtRuc"], #txtRuc', 10000);
  if (!loginOk) {
    // Intentar con el portal SOL directo
    log('Intentando portal SOL directo...');
    await page.goto('https://ww1.sunat.gob.pe/ol-ti-itconsultaunificadalibre/consultaUnificadaLibre/login', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
  }

  log('Ingresando credenciales SOL...');

  // Intentar diferentes selectores para el formulario de login
  const selectors = {
    ruc:  ['#txtRuc', 'input[name="txtRuc"]', 'input[placeholder*="RUC"]'],
    user: ['#txtUsuario', 'input[name="txtUsuario"]', 'input[placeholder*="usuario"]'],
    pass: ['#txtContrasena', 'input[name="txtContrasena"]', 'input[type="password"]'],
    btn:  ['#btnAceptar', 'button[type="submit"]', 'input[type="submit"]'],
  };

  const findAndFill = async (sels: string[], value: string): Promise<boolean> => {
    for (const sel of sels) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click({ clickCount: 3 });
          await el.type(value, { delay: 50 });
          return true;
        }
      } catch {}
    }
    return false;
  };

  const rucOk   = await findAndFill(selectors.ruc,  ruc);
  const userOk  = await findAndFill(selectors.user, solUser);
  const passOk  = await findAndFill(selectors.pass, solPass);

  if (!rucOk || !userOk || !passOk) {
    log('No se encontró el formulario de login');
    return false;
  }

  // Click en botón de login
  for (const sel of selectors.btn) {
    try {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); break; }
    } catch {}
  }

  // Esperar navegación post-login
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});

  // Verificar si el login fue exitoso
  const url = page.url();
  const title = await page.title();
  log(`Post-login URL: ${url.substring(0, 80)}`);
  log(`Post-login title: ${title}`);

  // Si hay mensaje de error de login
  const errorEl = await page.$('.error, .alert-danger, [class*="error"]');
  if (errorEl) {
    const errorText = await page.evaluate(el => el.textContent, errorEl);
    log(`Error de login: ${errorText?.trim()}`);
    return false;
  }

  return true;
}

// ── Navegar a Mis Comprobantes Recibidos y descargar XMLs ──
async function downloadReceivedXmls(
  page: import('puppeteer-core').Page,
  ruc: string,
  period: string,
  maxDocs: number,
  log: (m: string) => void
): Promise<BrowserXmlResult[]> {
  const results: BrowserXmlResult[] = [];
  const [year, month] = period.split('-');

  log('Navegando a Mis Comprobantes Recibidos...');

  // URL directa al módulo de comprobantes recibidos
  const urls = [
    `https://e-factura.sunat.gob.pe/ol-ti-itconsultaunificadalibre/consultaUnificadaLibre/consulta/comprobante`,
    `https://ww1.sunat.gob.pe/ol-ti-itconsultaunificadalibre/consultaUnificadaLibre/consulta/comprobante`,
  ];

  let navigated = false;
  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      const found = await waitFor(page, 'select, input[type="date"], .form-control', 5000);
      if (found) { navigated = true; log(`Módulo encontrado: ${url.substring(0, 60)}`); break; }
    } catch {}
  }

  if (!navigated) {
    log('No se pudo navegar al módulo de comprobantes recibidos');
    return results;
  }

  // Interceptar las respuestas de la API interna del portal
  // El portal hace llamadas XHR/fetch a APIs internas cuando busca comprobantes
  const xmlResponses: Map<string, string> = new Map();

  await page.setRequestInterception(true);
  page.on('request', req => req.continue());
  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';
    if (url.includes('sunat.gob.pe') && (contentType.includes('xml') || url.includes('.xml'))) {
      try {
        const body = await response.text();
        if (body.includes('<?xml') || body.includes('<Invoice') || body.includes('<CreditNote')) {
          const key = url.split('/').pop() || url;
          xmlResponses.set(key, body);
          log(`XML interceptado: ${key} (${body.length} bytes)`);
        }
      } catch {}
    }
  });

  // Intentar filtrar por período y buscar
  log(`Filtrando por período ${year}-${month}...`);

  // Seleccionar año y mes en los filtros
  const yearSelects = await page.$$('select');
  for (const sel of yearSelects) {
    try {
      const options = await page.evaluate(el => Array.from(el.options).map(o => o.value), sel);
      if (options.includes(year)) {
        await page.evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event('change')); }, sel, year);
        break;
      }
    } catch {}
  }

  // Buscar botón de consulta
  const searchBtns = ['#btnBuscar', 'button[type="submit"]', '.btn-primary', 'input[value="Buscar"]'];
  for (const sel of searchBtns) {
    try {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 2000)); break; }
    } catch {}
  }

  // Esperar resultados
  await waitFor(page, 'table tbody tr, .resultado, .comprobante-item', 10000);

  // Obtener lista de comprobantes de la tabla
  const rows = await page.$$('table tbody tr');
  log(`Filas encontradas en tabla: ${rows.length}`);

  let processed = 0;
  for (const row of rows.slice(0, maxDocs)) {
    if (processed >= maxDocs) break;
    try {
      // Buscar botón de descarga XML en la fila
      const xmlBtn = await row.$('a[href*=".xml"], button[title*="XML"], a[title*="XML"], .btn-xml');
      if (xmlBtn) {
        // Obtener datos del comprobante de la fila
        const cells = await row.$$('td');
        const cellTexts = await Promise.all(cells.map(c => page.evaluate(el => el.textContent?.trim() || '', c)));
        log(`Descargando XML de fila: ${cellTexts.slice(0, 4).join(' | ')}`);

        // Click en el botón XML — puede abrir una nueva pestaña o descargar
        const [newPage] = await Promise.all([
          new Promise<import('puppeteer-core').Page | null>(resolve => {
            page.once('popup', p => resolve(p));
            setTimeout(() => resolve(null), 3000);
          }),
          xmlBtn.click(),
        ]);

        if (newPage) {
          await new Promise(r => setTimeout(r, 2000));
          const content = await newPage.content();
          if (content.includes('<?xml') || content.includes('<Invoice')) {
            const serie  = cellTexts[2]?.split('-')[0] || '';
            const numero = cellTexts[2]?.split('-')[1] || '';
            results.push({ docId: `${serie}-${numero}`, serie, numero, tipo: '01', xmlContent: content });
            log(`XML obtenido: ${serie}-${numero}`);
          }
          await newPage.close();
        }
        processed++;
      }
    } catch (e) {
      log(`Error en fila: ${(e as Error).message}`);
    }
  }

  // Si no obtuvimos XMLs via clicks, usar los interceptados
  if (results.length === 0 && xmlResponses.size > 0) {
    log(`Usando ${xmlResponses.size} XMLs interceptados...`);
    for (const [key, xml] of xmlResponses) {
      const match = key.match(/(\w+)-(\d+)/);
      if (match) {
        results.push({ docId: key, serie: match[1], numero: match[2], tipo: '01', xmlContent: xml });
      }
    }
  }

  return results;
}

// ── Función principal exportada ──
export async function downloadXmlsViaBrowser(opts: BrowserDownloadOptions): Promise<BrowserXmlResult[]> {
  const log = opts.onProgress ?? ((m: string) => console.log(`[BROWSER] ${m}`));
  const maxDocs = opts.maxDocs ?? 50;

  log(`Iniciando browser automation para ${opts.ruc} período ${opts.period}`);

  let browser: import('puppeteer-core').Browser | null = null;
  try {
    browser = await getBrowser();
    log('Chromium iniciado OK');

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Login
    const loggedIn = await loginSol(page, opts.ruc, opts.solUser, opts.solPass, log);
    if (!loggedIn) {
      throw new Error('Login SOL fallido — verificar credenciales');
    }
    log('Login SOL exitoso');

    // Descargar XMLs
    const results = await downloadReceivedXmls(page, opts.ruc, opts.period, maxDocs, log);
    log(`Total XMLs obtenidos: ${results.length}`);

    return results;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
      log('Browser cerrado');
    }
  }
}
