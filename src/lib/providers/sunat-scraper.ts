import puppeteer from 'puppeteer-core';

export interface ScraperCredentials {
  ruc: string;
  solUser: string;
  solPass: string;
}

export interface FacturaQuery {
  rucEmisor: string;
  serie: string;
  numero: string;
  tipoComprobante?: string;
}

/**
 * Descarga el XML de una factura desde el portal SUNAT usando web scraping.
 * Este método es un fallback cuando la API CPE no está disponible o falla.
 * 
 * @param creds - Credenciales SOL (RUC, usuario, contraseña)
 * @param factura - Datos de la factura a buscar
 * @returns XML content como string o null si falla
 */
export async function downloadXmlFromSunat(
  creds: ScraperCredentials,
  factura: FacturaQuery
): Promise<{ xmlContent: string | null; error?: string }> {
  const chromiumPath = process.env.CHROMIUM_PATH || 
    '/usr/bin/chromium-browser' || 
    '/usr/bin/chromium' ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  let browser;

  try {
    console.log(`[SCRAPER] Iniciando descarga XML para ${factura.serie}-${factura.numero}`);

    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: true, // INVISIBLE para el cliente
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    );

    // ============================================
    // PASO 1: LOGIN
    // ============================================
    console.log('[SCRAPER] Login en SUNAT...');
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    await page.type('#txtRuc', creds.ruc, { delay: 50 });
    await page.type('#txtUsuario', creds.solUser, { delay: 50 });
    await page.type('#txtContrasena', creds.solPass, { delay: 50 });
    await page.click('#btnAceptar');
    await page.waitForSelector('#divContainerMenu', { timeout: 15000 });

    // ============================================
    // PASO 2: CLICK EN EMPRESAS
    // ============================================
    console.log('[SCRAPER] Seleccionando Empresas...');
    await page.evaluate(() => {
      const empresasDiv = document.querySelector('div[data-id="2"]') as HTMLElement;
      if (empresasDiv) empresasDiv.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // ============================================
    // PASO 3: NAVEGACIÓN POR MENÚ (4 CLICKS)
    // ============================================
    const menuSelectors = [
      'li[data-id2="11"] span.spanNivelDescripcion',      // Comprobantes de pago
      'li[data-id2="11_38"] span.spanNivelDescripcion',   // Comprobantes de Pago (nivel 2)
      'li[data-id2="11_38_1"] span.spanNivelDescripcion', // Consulta de Comprobantes de Pago
      'li[data-id2="11_38_1_1"] span.spanNivelDescripcion', // Nueva Consulta
    ];

    for (const selector of menuSelectors) {
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        if (el) el.click();
      }, selector);
      await new Promise(r => setTimeout(r, 1500));
    }

    await new Promise(r => setTimeout(r, 3000));

    // ============================================
    // PASO 4: BUSCAR FORMULARIO EN IFRAME
    // ============================================
    console.log('[SCRAPER] Buscando formulario en iframe...');
    let targetFrame = page.mainFrame();

    for (const frame of page.frames()) {
      try {
        const hasForm = await frame.evaluate(() =>
          !!(document.querySelector('input[formcontrolname="rucEmisor"]'))
        );
        if (hasForm) {
          targetFrame = frame;
          break;
        }
      } catch {
        // Frame no accesible
      }
    }

    // ============================================
    // PASO 5: SELECCIONAR "RECIBIDO"
    // ============================================
    await targetFrame.evaluate(() => {
      const radio = document.querySelector('input[type="radio"][value="RBR"]') as HTMLInputElement;
      if (radio) {
        radio.click();
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 800));

    // ============================================
    // PASO 6: LLENAR FORMULARIO
    // ============================================
    console.log(`[SCRAPER] Llenando formulario para ${factura.serie}-${factura.numero}...`);

    // Helper para setear valores en inputs Angular
    const setterCode = `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set`;

    // RUC Emisor
    await targetFrame.evaluate((ruc, setter) => {
      const input = document.querySelector('input[formcontrolname="rucEmisor"]') as HTMLInputElement;
      if (input) {
        eval(setter).call(input, ruc);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    }, factura.rucEmisor, setterCode);
    await new Promise(r => setTimeout(r, 800));

    // Tipo de comprobante (dropdown PrimeNG)
    await targetFrame.evaluate(() => {
      const trigger = document.querySelector('div[role="button"][aria-haspopup="listbox"]') as HTMLElement;
      if (trigger) trigger.click();
    });
    await new Promise(r => setTimeout(r, 800));

    await targetFrame.evaluate(() => {
      const items = Array.from(document.querySelectorAll('li[role="option"]'));
      const factura = items.find(i => i.textContent?.trim() === 'Factura') as HTMLElement;
      if (factura) factura.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Serie
    await targetFrame.evaluate((serie, setter) => {
      const input = document.querySelector('input[formcontrolname="serieComprobante"]') as HTMLInputElement;
      if (input) {
        eval(setter).call(input, serie);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, factura.serie, setterCode);
    await new Promise(r => setTimeout(r, 300));

    // Número
    await targetFrame.evaluate((numero, setter) => {
      const input = document.querySelector('input[formcontrolname="numeroComprobante"]') as HTMLInputElement;
      if (input) {
        eval(setter).call(input, numero);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, factura.numero, setterCode);
    await new Promise(r => setTimeout(r, 300));

    // ============================================
    // PASO 7: CONSULTAR
    // ============================================
    console.log('[SCRAPER] Consultando...');
    await targetFrame.evaluate(() => {
      const btn = document.querySelector('button.btn.boton-primary') as HTMLElement;
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 5000));

    // ============================================
    // PASO 8: ESPERAR MODAL
    // ============================================
    console.log('[SCRAPER] Esperando modal con factura...');
    await targetFrame.waitForSelector('ngb-modal-window, control-cpe-factura', {
      timeout: 10000,
    });
    await new Promise(r => setTimeout(r, 2000));

    // ============================================
    // PASO 9: INTERCEPTAR DESCARGA XML
    // ============================================
    console.log('[SCRAPER] Interceptando descarga XML...');

    // Interceptar respuestas de red para capturar el XML
    let xmlContent: string | null = null;

    const responseHandler = async (response: any) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      // Detectar respuesta XML
      if (
        url.includes('.xml') ||
        url.includes('xml') ||
        contentType.includes('xml') ||
        contentType.includes('zip')
      ) {
        try {
          const buffer = await response.buffer();

          // Si es ZIP, extraer el XML
          if (contentType.includes('zip') || url.endsWith('.zip')) {
            console.log('[SCRAPER] Descarga es ZIP, extrayendo XML...');
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(buffer);
            const entries = zip.getEntries();

            for (const entry of entries) {
              if (entry.entryName.toLowerCase().endsWith('.xml')) {
                xmlContent = entry.getData().toString('utf8');
                console.log(`[SCRAPER] XML extraído del ZIP: ${entry.entryName}`);
                break;
              }
            }
          } else {
            // Es XML directo
            const text = buffer.toString('utf8');
            if (text.includes('<?xml') || text.includes('<Invoice')) {
              xmlContent = text;
              console.log('[SCRAPER] XML capturado directamente');
            }
          }
        } catch (e) {
          console.log('[SCRAPER] Error procesando respuesta:', (e as Error).message);
        }
      }
    };

    page.on('response', responseHandler);

    // Click en botón XML (segundo botón en container)
    const xmlClicked = await targetFrame.evaluate(() => {
      const container = document.querySelector('div.button-container');
      const buttons = container?.querySelectorAll('button');
      if (buttons && buttons[1]) {
        (buttons[1] as HTMLElement).click();
        return true;
      }
      return false;
    });

    if (!xmlClicked) {
      throw new Error('No se pudo hacer click en botón XML');
    }

    // Esperar a que se capture el XML (máximo 10 segundos)
    const maxWait = 10000;
    const startTime = Date.now();

    while (!xmlContent && Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, 500));
    }

    if (!xmlContent) {
      throw new Error('No se pudo capturar el contenido XML');
    }

    // En este punto xmlContent es definitivamente string (no null)
    const xmlSize = (xmlContent as string).length;
    console.log(`[SCRAPER] ✅ XML descargado exitosamente (${xmlSize} bytes)`);

    return { xmlContent };
  } catch (error) {
    console.error('[SCRAPER] Error:', (error as Error).message);
    return { xmlContent: null, error: (error as Error).message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
