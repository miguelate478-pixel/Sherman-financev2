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
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    );

    // LOGIN
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

    // INTERCEPTAR JWT TOKEN - MÚLTIPLES ESTRATEGIAS
    let formToken: string | null = null;

    // Estrategia 1: Interceptar responses JSON que contengan token
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('sunat.gob.pe') && !formToken) {
        try {
          const ct = response.headers()['content-type'] || '';
          if (ct.includes('json')) {
            const text = await response.text();
            const data = JSON.parse(text);
            // El token puede estar en diferentes campos
            const token = data?.token || data?.access_token || data?.data?.token || data?.idToken;
            if (token && token.includes('.')) {
              // JWT tiene puntos
              formToken = token;
              console.log('[SCRAPER] Token desde response JSON capturado');
            }
          }
        } catch {}
      }
    });

    // Estrategia 2: Interceptar redirects que contengan el token en URL
    page.on('request', request => {
      const url = request.url();
      if (url.includes('nuevaconsulta') && url.includes('token=')) {
        const match = url.match(/[?&]token=([^&]+)/);
        if (match) {
          formToken = match[1];
          console.log('[SCRAPER] Token desde URL de request capturado');
        }
      }
    });

    // CLICKS MENÚ PARA QUE SUNAT GENERE EL TOKEN
    console.log('[SCRAPER] Haciendo clicks en el menú...');
    await page.evaluate(() => {
      (document.querySelector('div[data-id="2"]') as HTMLElement)?.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    await page.evaluate(() => {
      (document.querySelector('li[data-id2="11"] span.spanNivelDescripcion') as HTMLElement)?.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
      const matches = spans.filter(
        (s): s is HTMLElement =>
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

    await new Promise(r => setTimeout(r, 3000));

    // Estrategia 3: Buscar token en sessionStorage/localStorage
    if (!formToken) {
      console.log('[SCRAPER] Buscando token en storage...');
      const solToken = await page.evaluate(() => {
        return (
          sessionStorage.getItem('SUNAT.token') ||
          sessionStorage.getItem('token') ||
          localStorage.getItem('SUNAT.token') ||
          localStorage.getItem('token')
        );
      });
      if (solToken) {
        formToken = solToken;
        console.log('[SCRAPER] Token desde sessionStorage:', solToken.substring(0, 30));
      }
    }

    // Debug: Log todos los frames y sus URLs
    const allFrames = page.frames().map(f => ({ url: f.url(), name: f.name() }));
    console.log('[SCRAPER] Frames actuales:', JSON.stringify(allFrames));

    // Debug: Log el iframe ifrVCE src actual
    const ifrSrc = await page.evaluate(() => {
      const ifr = document.querySelector('#ifrVCE') as HTMLIFrameElement;
      return { src: ifr?.src, contentSrc: ifr?.contentWindow?.location?.href };
    });
    console.log('[SCRAPER] ifrVCE estado:', JSON.stringify(ifrSrc));

    if (!formToken) {
      return { xmlContent: null, error: 'JWT token no capturado - ver logs para debug' };
    }

    // NAVEGAR DIRECTO AL FORMULARIO CON TOKEN
    const formUrl = `https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/loader/nuevaconsulta.html?token=${formToken}`;
    console.log('[SCRAPER] Navegando al formulario con JWT...');
    await page.goto(formUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // ESPERAR FORMULARIO ANGULAR
    await page.waitForFunction(() => !!document.querySelector('input[formcontrolname="rucEmisor"]'), {
      timeout: 15000,
    });
    console.log('[SCRAPER] Formulario Angular cargado');

    // CLICK RECIBIDO
    await page.evaluate(() => {
      const r = document.querySelector('input[type="radio"][value="RBR"]') as HTMLInputElement;
      r?.click();
      r?.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 1000));

    // RUC EMISOR
    await page.evaluate((ruc: string) => {
      const input = document.querySelector('input[formcontrolname="rucEmisor"]') as HTMLInputElement;
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, ruc);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    }, factura.rucEmisor);
    await new Promise(r => setTimeout(r, 800));

    // DROPDOWN FACTURA
    await page.evaluate(() => {
      const trigger = document.querySelector('div[role="button"][aria-haspopup="listbox"]') as HTMLElement;
      trigger?.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('li[role="option"], .p-dropdown-item'));
      (items.find(i => i.textContent?.trim() === 'Factura') as HTMLElement)?.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // SERIE
    await page.evaluate((serie: string) => {
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
    await page.evaluate((numero: string) => {
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
    await page.evaluate(() => {
      const btn =
        (document.querySelector('button.btn.boton-primary') as HTMLElement) ||
        (Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent?.trim().toLowerCase().includes('consultar')
        ) as HTMLElement);
      btn?.click();
    });
    await new Promise(r => setTimeout(r, 5000));

    // ESPERAR MODAL
    await page.waitForSelector('ngb-modal-window, control-cpe-factura', { timeout: 15000 });
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

      page
        .evaluate(() => {
          const container = document.querySelector('div.button-container');
          const buttons = container?.querySelectorAll('button');
          if (buttons?.[1]) (buttons[1] as HTMLElement).click();
          else {
            const modalBtns = Array.from(document.querySelectorAll('ngb-modal-window button'));
            if (modalBtns[1]) (modalBtns[1] as HTMLElement).click();
          }
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
