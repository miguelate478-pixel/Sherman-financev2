import puppeteer from 'puppeteer';

export async function downloadXmlFromSunat(
  creds: {
    ruc: string;
    solUser: string;
    solPass: string;
  },
  factura: {
    rucEmisor: string;
    serie: string;
    numero: string;
  }
): Promise<{ xmlContent: string | null; error?: string }> {
  let browser;
  try {
    browser = await puppeteer.launch({
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

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    );

    // LOGIN
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
    console.log('[SCRAPER] Login OK');

    // CLICK EN EMPRESAS (data-id="2")
    console.log('[SCRAPER] Click en Empresas...');
    await page.evaluate(() => {
      const empresasDiv =
        document.querySelector('div[data-id="2"]') || document.querySelector('#divOpcionServicio2');
      if (empresasDiv) {
        (empresasDiv as HTMLElement).click();
      }
    });
    await new Promise(r => setTimeout(r, 2000));

    // NAVEGACIÓN POR MENÚ (4 CLICKS)
    console.log('[SCRAPER] Navegando por menú...');

    // Click 1: Comprobantes de pago (data-id2="11")
    await page.evaluate(() => {
      const el =
        document.querySelector('li[data-id2="11"] span.spanNivelDescripcion') ||
        Array.from(document.querySelectorAll('span.spanNivelDescripcion')).find(
          s => (s as HTMLElement).textContent?.trim() === 'Comprobantes de pago'
        );
      if (el) (el as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Click 2: Comprobantes de Pago nivel 2 (data-id2="11_38")
    await page.evaluate(() => {
      const el =
        document.querySelector('li[data-id2="11_38"] span.spanNivelDescripcion') ||
        Array.from(document.querySelectorAll('span.spanNivelDescripcion')).filter(
          s => (s as HTMLElement).textContent?.trim().toLowerCase() === 'comprobantes de pago'
        )[1];
      if (el) (el as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Click 3: Consulta de Comprobantes de Pago (data-id2="11_38_1")
    await page.evaluate(() => {
      const el =
        document.querySelector('li[data-id2="11_38_1"] span.spanNivelDescripcion') ||
        Array.from(document.querySelectorAll('span.spanNivelDescripcion')).find(
          s => (s as HTMLElement).textContent?.trim() === 'Consulta de Comprobantes de Pago'
        );
      if (el) (el as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Click 4: Nueva Consulta de comprobantes de pago (data-id2="11_38_1_1")
    await page.evaluate(() => {
      const el =
        document.querySelector('li[data-id2="11_38_1_1"] span.spanNivelDescripcion') ||
        Array.from(document.querySelectorAll('span.spanNivelDescripcion')).find(
          s => (s as HTMLElement).textContent?.trim() === 'Nueva Consulta de comprobantes de pago'
        );
      if (el) (el as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 4000));
    console.log('[SCRAPER] Navegación de menú completada');

    // BUSCAR FORMULARIO EN IFRAME
    console.log('[SCRAPER] Buscando formulario en iframe...');
    let targetFrame = page.mainFrame();

    for (const frame of page.frames()) {
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
          console.log('[SCRAPER] Formulario encontrado en iframe');
          break;
        }
      } catch {}
    }

    // ESPERAR FORMULARIO ANGULAR
    await targetFrame.waitForFunction(
      () =>
        !!(
          document.querySelector('input[formcontrolname="rucEmisor"]') ||
          document.querySelector('input[name="rucEmisor"]')
        ),
      { timeout: 15000 }
    );
    console.log('[SCRAPER] Formulario Angular cargado');

    // CLICK RECIBIDO
    await targetFrame.evaluate(() => {
      const r =
        (document.querySelector('input[type="radio"][value="RBR"]') as HTMLInputElement) ||
        (document.querySelector('input[id="recibido"]') as HTMLInputElement);
      if (r) {
        r.click();
        r.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1000));

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
    }, factura.rucEmisor);
    await new Promise(r => setTimeout(r, 800));

    // DROPDOWN FACTURA (PrimeNG)
    await targetFrame.evaluate(() => {
      const trigger =
        (document.querySelector('div[role="button"][aria-haspopup="listbox"]') as HTMLElement) ||
        (document.querySelector('p-dropdown div.p-dropdown-trigger') as HTMLElement);
      if (trigger) trigger.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    await targetFrame.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll('li[role="option"], .p-dropdown-item, li.p-dropdown-item')
      );
      const factura = items.find(i => (i as HTMLElement).textContent?.trim() === 'Factura');
      if (factura) (factura as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 800));

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
    }, factura.serie);
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
    }, factura.numero);
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
    console.log('[SCRAPER] Consulta enviada');

    // ESPERAR MODAL
    await targetFrame.waitForSelector('ngb-modal-window, .modal-dialog, control-cpe-factura', {
      timeout: 15000,
    });
    await new Promise(r => setTimeout(r, 2000));
    console.log('[SCRAPER] Modal con factura abierto');

    // INTERCEPTAR XML
    const xmlContent = await new Promise<string | null>(resolve => {
      const timeout = setTimeout(() => resolve(null), 15000);

      page.on('response', async response => {
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

      // Click en botón XML (segundo botón en container)
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

          // Fallback: buscar por título o aria-label
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

          // Fallback 2: el botón verde (segundo en modal)
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

    console.log(
      `[SCRAPER] ${factura.serie}-${factura.numero}: ${xmlContent ? (xmlContent as string).length + ' bytes' : 'sin XML'}`
    );

    return { xmlContent: xmlContent as string | null };
  } catch (error) {
    console.error(`[SCRAPER] Error:`, (error as Error).message);
    return { xmlContent: null, error: (error as Error).message };
  } finally {
    if (browser) await browser.close();
  }
}
