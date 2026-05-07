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
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--safebrowsing-disable-auto-update',
      '--window-size=1280,800',
    ],
    headless: true,
    timeout: 30000,
    ignoreHTTPSErrors: true,
  });

  return browser;
}

// ── Esperar selector con timeout ────────────────────────────────────
async function waitFor(page: import('puppeteer').Page, selector: string, timeout = 15000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
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

  // Ir directamente al login del portal e-factura
  await page.goto('https://e-factura.sunat.gob.pe/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await new Promise(r => setTimeout(r, 3000));
  log(`URL actual: ${page.url()}`);

  // Intentar encontrar el formulario de login
  const loginSelectors = [
    { ruc: '#txtRuc',      user: '#txtUsuario',  pass: '#txtContrasena', btn: '#btnAceptar' },
    { ruc: '[name=txtRuc]', user: '[name=txtUsuario]', pass: '[name=txtContrasena]', btn: '[type=submit]' },
  ];

  for (const sel of loginSelectors) {
    const rucEl = await page.$(sel.ruc);
    if (!rucEl) continue;

    log('Formulario de login encontrado, ingresando credenciales...');
    await rucEl.click({ clickCount: 3 });
    await rucEl.type(ruc, { delay: 80 });

    const userEl = await page.$(sel.user);
    if (userEl) { await userEl.click({ clickCount: 3 }); await userEl.type(solUser, { delay: 80 }); }

    const passEl = await page.$(sel.pass);
    if (passEl) { await passEl.click({ clickCount: 3 }); await passEl.type(solPass, { delay: 80 }); }

    const btnEl = await page.$(sel.btn);
    if (btnEl) {
      await btnEl.click();
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
    }
    break;
  }

  const urlAfter = page.url();
  log(`URL post-login: ${urlAfter}`);

  // Verificar si hay error de login
  const pageText = await page.evaluate(() => document.body?.innerText || '');
  if (pageText.toLowerCase().includes('contraseña incorrecta') ||
      pageText.toLowerCase().includes('usuario incorrecto') ||
      pageText.toLowerCase().includes('datos incorrectos')) {
    log('Error: credenciales incorrectas');
    return false;
  }

  // Si redirigió fuera del login, asumimos éxito
  if (!urlAfter.includes('login') && !urlAfter.includes('Login')) {
    log('Login exitoso');
    return true;
  }

  // Verificar si hay elementos post-login
  const loggedIn = await waitFor(page, '.menu, nav, .navbar, #menu, [class*="menu"]', 5000);
  if (loggedIn) { log('Login exitoso (menú detectado)'); return true; }

  log('Login posiblemente exitoso (sin confirmación clara)');
  return true; // Intentar continuar de todas formas
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

  // Navegar al módulo de comprobantes recibidos
  log('Navegando a Mis Comprobantes Recibidos...');

  const moduleUrls = [
    `https://e-factura.sunat.gob.pe/ol-ti-itconsultaunificadalibre/consultaUnificadaLibre/consulta/comprobante`,
    `https://ww1.sunat.gob.pe/ol-ti-itconsultaunificadalibre/consultaUnificadaLibre/consulta/comprobante`,
    `https://e-factura.sunat.gob.pe/`,
  ];

  let pageLoaded = false;
  for (const url of moduleUrls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise(r => setTimeout(r, 2000));
      const found = await waitFor(page, 'select, input, form, table', 5000);
      if (found) {
        log(`Módulo cargado: ${url.substring(0, 70)}`);
        pageLoaded = true;
        break;
      }
    } catch (e) {
      log(`Error navegando a ${url.substring(0, 50)}: ${(e as Error).message}`);
    }
  }

  if (!pageLoaded) {
    log('No se pudo cargar el módulo de comprobantes');
    return results;
  }

  // Tomar screenshot para diagnóstico
  log(`Página actual: ${page.url()}`);
  const pageTitle = await page.title();
  log(`Título: ${pageTitle}`);

  // Intentar filtrar por período
  log(`Buscando comprobantes del período ${year}-${month}...`);

  // Buscar y llenar campos de fecha/período
  const allSelects = await page.$$('select');
  log(`Selects encontrados: ${allSelects.length}`);

  for (const sel of allSelects) {
    try {
      const opts = await page.evaluate(el => Array.from(el.options).map(o => ({ v: o.value, t: o.text })), sel);
      const yearOpt = opts.find(o => o.v === year || o.t === year);
      const monthOpt = opts.find(o => o.v === month || o.v === String(parseInt(month)));
      if (yearOpt) {
        await page.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, sel, yearOpt.v);
        log(`Año seleccionado: ${year}`);
      } else if (monthOpt) {
        await page.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, sel, monthOpt.v);
        log(`Mes seleccionado: ${month}`);
      }
    } catch {}
  }

  // Buscar inputs de fecha
  const dateInputs = await page.$$('input[type="date"], input[type="text"][name*="fecha"], input[name*="Fecha"]');
  if (dateInputs.length > 0) {
    const fechaInicio = `01/${month}/${year}`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const fechaFin = `${lastDay}/${month}/${year}`;
    try {
      await dateInputs[0].click({ clickCount: 3 });
      await dateInputs[0].type(fechaInicio);
      if (dateInputs[1]) {
        await dateInputs[1].click({ clickCount: 3 });
        await dateInputs[1].type(fechaFin);
      }
      log(`Fechas ingresadas: ${fechaInicio} - ${fechaFin}`);
    } catch {}
  }

  // Click en buscar
  const searchBtns = ['#btnBuscar', 'button[type="submit"]', '.btn-primary', 'input[value="Buscar"]', 'button:contains("Buscar")'];
  for (const sel of searchBtns) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        log('Botón buscar clickeado');
        await new Promise(r => setTimeout(r, 3000));
        break;
      }
    } catch {}
  }

  // Esperar resultados
  await waitFor(page, 'table tbody tr, .resultado, [class*="result"]', 10000);
  await new Promise(r => setTimeout(r, 2000));

  // Contar filas
  const rowCount = await page.$$eval('table tbody tr', rows => rows.length).catch(() => 0);
  log(`Filas en tabla: ${rowCount}`);

  // Intentar descargar XMLs de cada fila
  let processed = 0;
  for (let i = 0; i < Math.min(rowCount, maxDocs); i++) {
    try {
      const rows = await page.$$('table tbody tr');
      if (i >= rows.length) break;

      const row = rows[i];
      const cells = await row.$$eval('td', tds => tds.map(td => td.textContent?.trim() || ''));
      log(`Fila ${i + 1}: ${cells.slice(0, 5).join(' | ')}`);

      // Buscar botón/link de descarga XML
      const xmlLink = await row.$('a[href*="xml"], a[title*="XML"], button[title*="XML"], [onclick*="xml"]');
      if (xmlLink) {
        // Capturar nueva pestaña o descarga
        const [popup] = await Promise.all([
          new Promise<import('puppeteer').Page | null>(resolve => {
            const timeout = setTimeout(() => resolve(null), 5000);
            page.once('popup', p => { clearTimeout(timeout); resolve(p); });
          }),
          xmlLink.click(),
        ]);

        if (popup) {
          await new Promise(r => setTimeout(r, 2000));
          const content = await popup.content();
          if (content.includes('<?xml') || content.includes('<Invoice')) {
            // Extraer serie y número de las celdas
            const serieNum = cells.find(c => /[A-Z]\d{3}-\d+/.test(c)) || '';
            const [serie, numero] = serieNum.split('-');
            results.push({
              docId: serieNum,
              serie: serie || `DOC${i}`,
              numero: numero || String(i),
              tipo: '01',
              xmlContent: content,
            });
            log(`XML obtenido: ${serieNum}`);
          }
          await popup.close().catch(() => {});
        }
        processed++;
      }
    } catch (e) {
      log(`Error en fila ${i}: ${(e as Error).message}`);
    }
  }

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
