import puppeteer from 'puppeteer';

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
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
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
    await new Promise(r => setTimeout(r, 8000)); // Aumentado para dar tiempo a que cargue el formulario Angular

    // El formulario carga en el mainFrame, no en iframe
    // Solo necesitamos esperar que Angular cargue el componente
    console.log(`[SCRAPER] ${factura.serie}-${factura.numero}: Esperando formulario Angular...`);
    
    let formFound = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(r => setTimeout(r, 1000));
      
      try {
        formFound = await page.mainFrame().evaluate(() => {
          // Buscar el input de RUC que aparece cuando carga el formulario
          return !!(
            document.querySelector('input[formcontrolname="rucEmisor"]') ||
            document.querySelector('input[name="rucEmisor"]') ||
            // También puede estar en un shadow DOM
            document.querySelector('control-cpe-consulta input') ||
            document.querySelector('app-nueva-consulta input')
          );
        });
        
        if (formFound) {
          console.log(`[SCRAPER] ${factura.serie}-${factura.numero}: Formulario encontrado en intento ${attempt + 1}`);
          break;
        }
        
        // Cada 5 intentos, loguear qué hay en el DOM para debug
        if (attempt % 5 === 4) {
          const domInfo = await page.mainFrame().evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
              name: i.name,
              formcontrolname: i.getAttribute('formcontrolname'),
              type: i.type,
              id: i.id,
            }));
            return {
              inputCount: inputs.length,
              inputs: inputs.slice(0, 5),
              bodyPreview: document.body.innerHTML.substring(0, 200),
            };
          });
          console.log(`[SCRAPER] ${factura.serie}-${factura.numero}: DOM intento ${attempt + 1}:`, JSON.stringify(domInfo));
        }
      } catch (e) {
        console.log(`[SCRAPER] intento ${attempt + 1} error:`, (e as Error).message);
      }
    }
    
    if (!formFound) {
      return { xmlContent: null, error: 'Formulario Angular no cargó en 30 segundos' };
    }
    
    // Usar mainFrame para todo
    const targetFrame = page.mainFrame();

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
    const btnClicked = await targetFrame.evaluate(() => {
      const btn = document.querySelector('button.btn.boton-primary') as HTMLElement 
        || (Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim().toLowerCase().includes('consultar')) as HTMLElement);
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    
    if (!btnClicked) {
      return { xmlContent: null, error: 'Botón Consultar no encontrado' };
    }
    
    await new Promise(r => setTimeout(r, 5000));

    // ESPERAR MODAL
    try {
      await targetFrame.waitForSelector('ngb-modal-window, control-cpe-factura, .modal-dialog', { timeout: 15000 });
    } catch (e) {
      return { xmlContent: null, error: 'Modal no apareció - comprobante no encontrado' };
    }
    
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
