import { execSync } from 'child_process';

// ── Tipos ─────────────────────────────────────────────────
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

// ── Iniciar Xvfb (display virtual) ───────────────────────
let xvfbStarted = false;

function startXvfb(): void {
  if (xvfbStarted) return;
  try {
    // Matar instancias previas
    try { execSync('pkill -f "Xvfb :99"', { stdio: 'ignore' }); } catch {}
    execSync('Xvfb :99 -screen 0 1280x900x24 -ac +extension GLX +render -noreset &', { stdio: 'ignore' });
    // Esperar a que arranque
    execSync('sleep 1', { stdio: 'ignore' });
    process.env.DISPLAY = ':99';
    xvfbStarted = true;
    console.log('[XVFB] Display virtual :99 iniciado');
  } catch (e) {
    console.warn('[XVFB] No se pudo iniciar Xvfb:', (e as Error).message);
    // En desarrollo (Windows/Mac) no hay Xvfb — usar headless normal
  }
}

// ── Obtener ejecutable de Chromium ────────────────────────
function getChromiumPath(): string {
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    process.env.PUPPETEER_EXECUTABLE_PATH || '',
  ];
  for (const p of candidates) {
    if (!p) continue;
    try {
      execSync(`test -f "${p}"`, { stdio: 'ignore' });
      return p;
    } catch {}
  }
  return ''; // Puppeteer usará su propio Chromium
}

// ── Scraper principal con Xvfb + Stealth ─────────────────
export async function downloadXmlFromSunat(
  creds: ScraperCreds,
  factura: ScraperFactura
): Promise<ScraperResult> {
  const logs: string[] = [];
  const log = (m: string) => { console.log(`[SCRAPER] ${m}`); logs.push(m); };

  let browser: import('puppeteer').Browser | undefined;

  try {
    // 1. Iniciar display virtual
    startXvfb();

    // 2. Importar puppeteer-extra con stealth
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteerExtra = require('puppeteer-extra') as typeof import('puppeteer');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    (puppeteerExtra as unknown as { use: (p: unknown) => void }).use(StealthPlugin());

    const chromiumPath = getChromiumPath();
    const useXvfb = xvfbStarted && !!process.env.DISPLAY;

    log(`Modo: ${useXvfb ? 'Xvfb (display virtual)' : 'headless'} | Chromium: ${chromiumPath || 'bundled'}`);

    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--window-size=1280,900',
    ];

    if (useXvfb) {
      launchArgs.push(`--display=:99`);
    }

    browser = await (puppeteerExtra as unknown as {
      launch: (opts: Record<string, unknown>) => Promise<import('puppeteer').Browser>
    }).launch({
      headless: !useXvfb, // false con Xvfb, true sin él
      executablePath: chromiumPath || undefined,
      args: launchArgs,
      timeout: 30000,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Interceptar requests para capturar el JWT y el XML
    let jwtToken = '';
    let capturedXml = '';

    await page.setRequestInterception(true);
    page.on('request', req => {
      const auth = req.headers()['authorization'];
      if (auth && auth.startsWith('Bearer ') && !jwtToken) {
        jwtToken = auth.replace('Bearer ', '');
        log(`JWT interceptado: ${jwtToken.substring(0, 30)}...`);
      }
      req.continue();
    });

    page.on('response', async res => {
      const url = res.url();
      const ct  = res.headers()['content-type'] || '';
      // Capturar respuestas XML
      if ((url.includes('/xml') || url.includes('comprobante')) && (ct.includes('xml') || ct.includes('octet'))) {
        try {
          const body = await res.text();
          if (body.trim().startsWith('<') && body.length > 200) {
            capturedXml = body;
            log(`XML interceptado de ${url}: ${body.length} bytes`);
          }
        } catch {}
      }
    });

    // 3. LOGIN en e-menu SUNAT
    log(`Login en SUNAT para RUC ${creds.ruc}...`);
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    await page.type('#txtRuc',       creds.ruc,     { delay: 80 });
    await page.type('#txtUsuario',   creds.solUser, { delay: 80 });
    await page.type('#txtContrasena',creds.solPass, { delay: 80 });

    log('Credenciales ingresadas, haciendo click en Aceptar...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('#btnAceptar'),
    ]);

    log(`URL post-login: ${page.url()}`);

    // Verificar login exitoso
    const loginError = await page.$('#mensajeError');
    if (loginError) {
      const errText = await page.$eval('#mensajeError', el => el.textContent || '');
      throw new Error(`Login fallido: ${errText.trim()}`);
    }

    log('Login OK');

    // 4. Navegar al módulo de consulta de comprobantes recibidos
    log('Navegando al módulo de comprobantes recibidos...');

    // Intentar navegar directo al módulo
    await page.goto(
      'https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/web/itmConsultaRecepcion',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );

    // Si redirige al login, el JWT no se generó — intentar via menú
    if (page.url().includes('login') || page.url().includes('e-menu')) {
      log('Redirección al login — intentando via menú...');

      // Buscar el link al módulo en el menú
      await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
        waitUntil: 'networkidle2', timeout: 20000,
      });

      // Hacer click en "Comprobantes Recibidos" en el menú
      try {
        await page.waitForSelector('a[href*="itmrconsrecec"]', { timeout: 5000 });
        await page.click('a[href*="itmrconsrecec"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
        log(`URL tras click menú: ${page.url()}`);
      } catch {
        log('No se encontró link directo — buscando en iframe...');
        // El menú puede estar en un iframe
        const frames = page.frames();
        for (const frame of frames) {
          try {
            await frame.waitForSelector('a[href*="itmrconsrecec"]', { timeout: 2000 });
            await frame.click('a[href*="itmrconsrecec"]');
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
            log(`URL tras click iframe: ${page.url()}`);
            break;
          } catch {}
        }
      }
    }

    log(`Módulo cargado: ${page.url()}`);

    // 5. Si ya tenemos JWT interceptado, usarlo directamente
    if (jwtToken) {
      log('Usando JWT interceptado para descargar XML...');
      const tipoMap: Record<string, string> = { '01':'01','03':'03','07':'07','08':'08' };
      const tipo = tipoMap[factura.tipoComprobante] || '01';

      const xmlUrl = `https://api-cpe.sunat.gob.pe/v1/contribuyente/consultacpe/comprobantes/` +
        `${factura.rucEmisor}-${tipo}-${factura.serie}-${factura.numero}-${creds.ruc}/02`;

      log(`Descargando XML via API CPE con JWT: ${xmlUrl}`);

      const xmlRes = await fetch(xmlUrl, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Accept': 'application/json, */*',
          'Origin': 'https://e-factura.sunat.gob.pe',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (xmlRes.ok) {
        const data = await xmlRes.json() as Record<string, unknown>;
        const xmlContent = String(data.xml || data.content || data.data || '');
        if (xmlContent && xmlContent.length > 100) {
          log(`XML descargado via API CPE: ${xmlContent.length} bytes`);
          return { xmlContent, logs };
        }
      }
      log(`API CPE respondió ${xmlRes.status} — intentando via formulario...`);
    }

    // 6. Si ya capturamos XML via intercepción de respuestas
    if (capturedXml) {
      log(`XML capturado via intercepción: ${capturedXml.length} bytes`);
      return { xmlContent: capturedXml, logs };
    }

    // 7. Llenar el formulario de consulta
    log('Llenando formulario de consulta...');

    const tipoMap: Record<string, string> = {
      '01': '01', '03': '03', '07': '07', '08': '08',
    };
    const tipoVal = tipoMap[factura.tipoComprobante] || '01';

    try {
      // Esperar formulario
      await page.waitForSelector('input[name="rucEmisor"], #rucEmisor, input[placeholder*="RUC"]', { timeout: 10000 });

      // Llenar RUC emisor
      const rucInput = await page.$('input[name="rucEmisor"]') || await page.$('#rucEmisor');
      if (rucInput) {
        await rucInput.click({ clickCount: 3 });
        await rucInput.type(factura.rucEmisor, { delay: 50 });
      }

      // Seleccionar tipo
      const tipoSelect = await page.$('select[name="tipoComprobante"]') || await page.$('#tipoComprobante');
      if (tipoSelect) {
        await page.select('select[name="tipoComprobante"]', tipoVal);
      }

      // Serie
      const serieInput = await page.$('input[name="serie"]') || await page.$('#serie');
      if (serieInput) {
        await serieInput.click({ clickCount: 3 });
        await serieInput.type(factura.serie, { delay: 50 });
      }

      // Número
      const numInput = await page.$('input[name="numero"]') || await page.$('#numero') || await page.$('input[name="correlativo"]');
      if (numInput) {
        await numInput.click({ clickCount: 3 });
        await numInput.type(factura.numero, { delay: 50 });
      }

      log('Formulario llenado, haciendo click en Consultar...');

      // Click en botón consultar
      const btnConsultar = await page.$('button[type="submit"]') ||
        await page.$('input[type="submit"]') ||
        await page.$('button:contains("Consultar")');

      if (btnConsultar) {
        await Promise.all([
          page.waitForResponse(
            r => r.url().includes('comprobante') || r.url().includes('xml'),
            { timeout: 20000 }
          ).catch(() => null),
          btnConsultar.click(),
        ]);
      }

      await new Promise(r => setTimeout(r, 3000));

      // Verificar si se capturó XML
      if (capturedXml) {
        log(`XML capturado tras consulta: ${capturedXml.length} bytes`);
        return { xmlContent: capturedXml, logs };
      }

      // Buscar botón XML en modal
      log('Buscando botón XML en resultado...');
      const btnXml = await page.$('button[title*="XML"]') ||
        await page.$('a[href*=".xml"]') ||
        await page.$('button:nth-child(2)');

      if (btnXml) {
        log('Botón XML encontrado, descargando...');
        await Promise.all([
          page.waitForResponse(
            r => r.url().includes('xml') || (r.headers()['content-type'] || '').includes('xml'),
            { timeout: 15000 }
          ).catch(() => null),
          btnXml.click(),
        ]);
        await new Promise(r => setTimeout(r, 2000));
      }

    } catch (formErr) {
      log(`Error en formulario: ${(formErr as Error).message}`);
    }

    if (capturedXml) {
      return { xmlContent: capturedXml, logs };
    }

    // 8. Último intento: fetch autenticado desde el contexto del browser
    log('Último intento: fetch autenticado desde contexto browser...');
    const fetchResult = await page.evaluate(
      async ({ rucEmisor, tipo, serie, numero, receptorRuc }) => {
        const urls = [
          `/cl-ti-itmrconsrecec/jaxrs/comprobante/xml?numRuc=${receptorRuc}&codTipo=${tipo}&numSerie=${serie}&numCorrelativo=${numero}&numRucEmisor=${rucEmisor}`,
          `https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/comprobante/xml?numRuc=${receptorRuc}&codTipo=${tipo}&numSerie=${serie}&numCorrelativo=${numero}&numRucEmisor=${rucEmisor}`,
        ];
        for (const url of urls) {
          try {
            const r = await fetch(url, { credentials: 'include' });
            const t = await r.text();
            if (t.trim().startsWith('<') && t.length > 200) return { xml: t, url };
          } catch {}
        }
        return null;
      },
      { rucEmisor: factura.rucEmisor, tipo: tipoVal, serie: factura.serie, numero: factura.numero, receptorRuc: creds.ruc }
    );

    if (fetchResult?.xml) {
      log(`XML obtenido via fetch autenticado: ${fetchResult.xml.length} bytes`);
      return { xmlContent: fetchResult.xml, logs };
    }

    log('No se pudo obtener el XML por ningún método');
    return { xmlContent: null, error: 'XML no disponible — SUNAT no expone XMLs de compras recibidas via API', logs };

  } catch (error) {
    const msg = (error as Error).message;
    log(`Error fatal: ${msg}`);
    return { xmlContent: null, error: msg, logs };
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}

// ── Sesión HTTP directa (fallback rápido sin browser) ─────
export async function fetchXmlViaSolSession(
  serie: string,
  numero: string,
  tipoCodigo: string,
  emisorRuc: string,
  receptorRuc: string,
  creds: ScraperCreds
): Promise<string | null> {
  try {
    const loginRes = await fetch('https://www.sunat.gob.pe/sol.html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
      body: new URLSearchParams({ tipo: '2', ruc: creds.ruc, usuario: creds.solUser, password: creds.solPass }),
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    const cookies = (loginRes.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
    if (!cookies) return null;

    const url = `https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/comprobante/xml` +
      `?numRuc=${receptorRuc}&codTipo=${tipoCodigo}&numSerie=${serie}&numCorrelativo=${numero}&numRucEmisor=${emisorRuc}`;

    const res = await fetch(url, {
      headers: { Cookie: cookies, 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const text = await res.text();
      if (text.trim().startsWith('<') && text.length > 100) return text;
    }
    return null;
  } catch {
    return null;
  }
}
