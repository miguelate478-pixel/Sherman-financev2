import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export interface ScraperCredentials {
  ruc: string;
  solUser: string;
  solPass: string;
}

export interface FacturaQuery {
  rucEmisor: string;
  serie: string;
  numero: string;
}

export async function downloadXmlFromSunat(
  creds: ScraperCredentials,
  factura: FacturaQuery
): Promise<{ xmlContent: string | null; error?: string }> {
  // Prioridad de búsqueda de Chromium:
  // 1. Variable de entorno CHROMIUM_PATH (desarrollo local o Dockerfile)
  // 2. Chromium del sistema en rutas conocidas (Railway con Dockerfile)
  // 3. @sparticuz/chromium como último recurso (serverless sin Dockerfile)
  
  let chromiumPath: string;
  
  if (process.env.CHROMIUM_PATH) {
    // Desarrollo local o configurado explícitamente
    chromiumPath = process.env.CHROMIUM_PATH;
    console.log(`[SCRAPER] Usando CHROMIUM_PATH: ${chromiumPath}`);
  } else {
    // Buscar en rutas del sistema (Railway con Dockerfile)
    const systemPaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
    ];
    
    const fs = await import('fs');
    const foundPath = systemPaths.find(p => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });
    
    if (foundPath) {
      chromiumPath = foundPath;
      console.log(`[SCRAPER] Chromium del sistema encontrado: ${chromiumPath}`);
    } else {
      // Último recurso: @sparticuz/chromium
      chromiumPath = await chromium.executablePath();
      console.log(`[SCRAPER] Usando @sparticuz/chromium: ${chromiumPath}`);
    }
  }

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

  try {
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    );

    // LOGIN
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', 
      { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    await page.type('#txtRuc', creds.ruc, { delay: 50 });
    await page.type('#txtUsuario', creds.solUser, { delay: 50 });
    await page.type('#txtContrasena', creds.solPass, { delay: 50 });
    await page.click('#btnAceptar');
    await page.waitForSelector('#divContainerMenu', { timeout: 15000 });

    // CLICK EMPRESAS (data-id="2")
    await page.evaluate(() => {
      (document.querySelector('div[data-id="2"]') as HTMLElement)?.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // NAVEGACIÓN 4 CLICKS
    await page.evaluate(() => {
      (document.querySelector('li[data-id2="11"] span.spanNivelDescripcion') as HTMLElement)?.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
      const matches = spans.filter((s): s is HTMLElement => 
        s instanceof HTMLElement && s.textContent?.trim().toLowerCase() === 'comprobantes de pago'
      );
      if (matches.length > 1) matches[1].click();
      else matches[0]?.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    await page.evaluate(() => {
      (document.querySelector('li[data-id2="11_38_1"] span.spanNivelDescripcion') as HTMLElement)?.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    await page.evaluate(() => {
      (document.querySelector('li[data-id2="11_38_1_1"] span.spanNivelDescripcion') as HTMLElement)?.click();
    });
    await new Promise(r => setTimeout(r, 4000));

    // BUSCAR FRAME CON FORMULARIO
    let targetFrame = page.mainFrame();
    for (const frame of page.frames()) {
      try {
        const hasForm = await frame.evaluate(() => 
          !!(document.querySelector('input[formcontrolname="rucEmisor"]'))
        );
        if (hasForm) { targetFrame = frame; break; }
      } catch { /* frame no accesible */ }
    }

    // CLICK RECIBIDO
    await targetFrame.evaluate(() => {
      const r = document.querySelector('input[type="radio"][value="RBR"]') as HTMLInputElement;
      r?.click();
      r?.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 1000));

    // RUC EMISOR
    await targetFrame.evaluate((ruc: string) => {
      const input = document.querySelector('input[formcontrolname="rucEmisor"]') as HTMLInputElement;
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, ruc);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    }, factura.rucEmisor);
    await new Promise(r => setTimeout(r, 800));

    // DROPDOWN TIPO COMPROBANTE
    await targetFrame.evaluate(() => {
      const trigger = document.querySelector('div[role="button"][aria-haspopup="listbox"], p-dropdown div.p-dropdown-trigger') as HTMLElement;
      trigger?.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    await targetFrame.evaluate(() => {
      const items = Array.from(document.querySelectorAll('li[role="option"], .p-dropdown-item'));
      const f = items.find(i => i.textContent?.trim() === 'Factura') as HTMLElement;
      f?.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // SERIE
    await targetFrame.evaluate((serie: string) => {
      const input = document.querySelector('input[formcontrolname="serieComprobante"]') as HTMLInputElement;
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, serie);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    }, factura.serie);
    await new Promise(r => setTimeout(r, 500));

    // NÚMERO
    await targetFrame.evaluate((numero: string) => {
      const input = document.querySelector('input[formcontrolname="numeroComprobante"]') as HTMLInputElement;
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, numero);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    }, factura.numero);
    await new Promise(r => setTimeout(r, 500));

    // CONSULTAR
    await targetFrame.evaluate(() => {
      const btn = document.querySelector('button.btn.boton-primary') as HTMLElement 
        || (Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim().toLowerCase().includes('consultar')) as HTMLElement);
      btn?.click();
    });
    await new Promise(r => setTimeout(r, 5000));

    // ESPERAR MODAL
    await targetFrame.waitForSelector('ngb-modal-window, control-cpe-factura', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    // INTERCEPTAR XML AL HACER CLICK EN BOTÓN XML
    const xmlContent = await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 15000);

      page.on('response', async (response) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';
        
        if (url.includes('.xml') || contentType.includes('xml') || contentType.includes('octet-stream')) {
          try {
            const text = await response.text();
            if (text.includes('<?xml') || text.includes('<Invoice') || text.includes('<CreditNote')) {
              clearTimeout(timeout);
              resolve(text);
            }
          } catch { /* ignore */ }
        }
      });

      // Click botón XML (segundo botón del modal)
      targetFrame.evaluate(() => {
        const container = document.querySelector('div.button-container');
        const buttons = container?.querySelectorAll('button');
        if (buttons && buttons[1]) {
          (buttons[1] as HTMLElement).click();
        } else {
          const modalBtns = Array.from(document.querySelectorAll('ngb-modal-window button'));
          if (modalBtns[1]) (modalBtns[1] as HTMLElement).click();
        }
      }).catch(() => { /* ignore */ });
    });

    console.log(`[SCRAPER] ${factura.serie}-${factura.numero}: XML ${xmlContent ? (xmlContent as string).length + ' bytes' : 'no obtenido'}`);
    return { xmlContent: xmlContent as string | null };

  } catch (error) {
    const msg = (error as Error).message;
    console.error(`[SCRAPER] Error ${factura.serie}-${factura.numero}: ${msg}`);
    return { xmlContent: null, error: msg };
  } finally {
    if (browser) await browser.close();
  }
}
