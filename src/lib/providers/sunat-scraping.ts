import puppeteer, { Browser, Page, Frame } from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';

export interface XMLDownloadParams {
  ruc: string;
  solUser: string;
  solPass: string;
  rucEmisor: string;
  tipoComprobante: string;
  serie: string;
  numero: string;
}

export interface XMLDownloadResult {
  comprobante: string;
  success: boolean;
  fileName?: string;
  buffer?: Buffer;
  error?: string;
}

export class SunatScrapingProvider {
  private browser: Browser | null = null;
  private downloadPath: string;

  constructor() {
    this.downloadPath = path.join(process.cwd(), 'temp-downloads');
  }

  async init() {
    if (this.browser) return;

    console.log('[Scraping] Inicializando navegador...');

    this.browser = await puppeteer.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--start-maximized',
      ],
    });

    await fs.mkdir(this.downloadPath, { recursive: true });
    console.log('[Scraping] Navegador inicializado');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[Scraping] Navegador cerrado');
    }
  }

  async downloadXML(params: XMLDownloadParams): Promise<{ fileName: string; buffer: Buffer }> {
    await this.init();

    if (!this.browser) {
      throw new Error('Navegador no inicializado');
    }

    const page = await this.browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    );

    try {
      // PASO 1: LOGIN
      console.log('[Scraping] Login en SUNAT...');
      await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await page.waitForSelector('#txtRuc', { timeout: 10000 });
      await page.type('#txtRuc', params.ruc, { delay: 80 });
      await page.type('#txtUsuario', params.solUser, { delay: 80 });
      await page.type('#txtContrasena', params.solPass, { delay: 80 });
      await page.click('#btnAceptar');
      await page.waitForSelector('#divContainerMenu', { timeout: 15000 });
      console.log('[Scraping] Login exitoso');

      // PASO 2: CLICK EN EMPRESAS (data-id="2")
      console.log('[Scraping] Click en Empresas...');
      await page.evaluate(() => {
        const empresasDiv = (document.querySelector('div[data-id="2"]') ||
          document.querySelector('#divOpcionServicio2')) as HTMLElement;

        if (empresasDiv) {
          empresasDiv.click();
          return;
        }

        const allDivs = Array.from(document.querySelectorAll('div.list-group-item'));
        const empresasItem = allDivs.find(d => {
          const h4 = d.querySelector('h4');
          return h4?.textContent?.trim().toLowerCase().includes('empresa');
        });

        if (empresasItem) {
          (empresasItem as HTMLElement).click();
        }
      });
      await new Promise(r => setTimeout(r, 2000));

      const enEmpresas = await page.evaluate(() => {
        const active = document.querySelector('div.divOpcionServicioActivo, div.list-group-item.active');
        return active?.getAttribute('data-id');
      });
      console.log(`[Scraping] Opción activa data-id: ${enEmpresas} (debe ser 2 = Empresas)`);

      // PASO 3: Click 1 - Comprobantes de pago (data-id2="11")
      console.log('[Scraping] Click 1: Comprobantes de pago...');
      await page.evaluate(() => {
        const el = (document.querySelector('li[data-id2="11"] span.spanNivelDescripcion') ||
          Array.from(document.querySelectorAll('span.spanNivelDescripcion')).find(
            s => s.textContent?.trim() === 'Comprobantes de pago'
          )) as HTMLElement;
        if (el) el.click();
      });
      await new Promise(r => setTimeout(r, 1500));

      // PASO 4: Click 2 - Comprobantes de Pago nivel 2 (data-id2="11_38")
      console.log('[Scraping] Click 2: Comprobantes de Pago (nivel 2)...');
      await page.evaluate(() => {
        const el = (document.querySelector('li[data-id2="11_38"] span.spanNivelDescripcion') ||
          Array.from(document.querySelectorAll('span.spanNivelDescripcion')).filter(
            s => s.textContent?.trim().toLowerCase() === 'comprobantes de pago'
          )[1]) as HTMLElement;
        if (el) el.click();
      });
      await new Promise(r => setTimeout(r, 1500));

      // PASO 5: Click 3 - Consulta de Comprobantes de Pago (data-id2="11_38_1")
      console.log('[Scraping] Click 3: Consulta de Comprobantes de Pago...');
      await page.evaluate(() => {
        const el = (document.querySelector('li[data-id2="11_38_1"] span.spanNivelDescripcion') ||
          Array.from(document.querySelectorAll('span.spanNivelDescripcion')).find(
            s => s.textContent?.trim() === 'Consulta de Comprobantes de Pago'
          )) as HTMLElement;
        if (el) el.click();
      });
      await new Promise(r => setTimeout(r, 1500));

      // PASO 6: Click 4 - Nueva Consulta (data-id2="11_38_1_1")
      console.log('[Scraping] Click 4: Nueva Consulta de comprobantes de pago...');
      await page.evaluate(() => {
        const el = (document.querySelector('li[data-id2="11_38_1_1"] span.spanNivelDescripcion') ||
          Array.from(document.querySelectorAll('span.spanNivelDescripcion')).find(
            s => s.textContent?.trim() === 'Nueva Consulta de comprobantes de pago'
          )) as HTMLElement;
        if (el) el.click();
      });
      await new Promise(r => setTimeout(r, 4000));

      // PASO 7: BUSCAR FORMULARIO EN IFRAME
      console.log('[Scraping] Buscando formulario Angular en iframe...');
      let targetFrame: Frame = page.mainFrame();

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
            break;
          }
        } catch {}
      }

      console.log(`[Scraping] Frame encontrado: ${targetFrame.url()}`);

      // PASO 8: SELECCIONAR "RECIBIDO"
      console.log('[Scraping] Seleccionando filtro "Recibido"...');
      await targetFrame.evaluate(() => {
        const radio = (document.querySelector('input[type="radio"][value="RBR"]') ||
          document.querySelector('input[id="recibido"]')) as HTMLInputElement;
        if (radio) {
          radio.click();
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      await new Promise(r => setTimeout(r, 1000));

      // PASO 9: LLENAR FORMULARIO
      console.log(`[Scraping] Llenando formulario para ${params.serie}-${params.numero}...`);

      // RUC Emisor
      await targetFrame.evaluate(ruc => {
        const input = (document.querySelector('input[formcontrolname="rucEmisor"]') ||
          document.querySelector('input[name="rucEmisor"]')) as HTMLInputElement;
        if (input) {
          input.focus();
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
          )!.set!;
          nativeInputValueSetter.call(input, ruc);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }, params.rucEmisor);
      await new Promise(r => setTimeout(r, 800));

      // Tipo de comprobante (PrimeNG dropdown)
      await targetFrame.evaluate(() => {
        const trigger = document.querySelector(
          'div[role="button"][aria-haspopup="listbox"], p-dropdown div.p-dropdown-trigger'
        ) as HTMLElement;
        if (trigger) trigger.click();
      });
      await new Promise(r => setTimeout(r, 1000));

      await targetFrame.evaluate(() => {
        const items = Array.from(
          document.querySelectorAll('li[role="option"], .p-dropdown-item, li.p-dropdown-item')
        );
        const factura = items.find(i => i.textContent?.trim() === 'Factura') as HTMLElement;
        if (factura) factura.click();
      });
      await new Promise(r => setTimeout(r, 800));

      // Serie
      await targetFrame.evaluate(serie => {
        const input = (document.querySelector('input[formcontrolname="serieComprobante"]') ||
          document.querySelector('input[name="serieComprobante"]')) as HTMLInputElement;
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
          setter.call(input, serie);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, params.serie);
      await new Promise(r => setTimeout(r, 500));

      // Número
      await targetFrame.evaluate(numero => {
        const input = (document.querySelector('input[formcontrolname="numeroComprobante"]') ||
          document.querySelector('input[name="numeroComprobante"]')) as HTMLInputElement;
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
          setter.call(input, numero);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, params.numero);
      await new Promise(r => setTimeout(r, 500));

      // PASO 10: CONSULTAR
      console.log('[Scraping] Consultando...');
      await targetFrame.evaluate(() => {
        const btn = (document.querySelector('button.btn.boton-primary') ||
          document.querySelector('button[type="submit"]') ||
          Array.from(document.querySelectorAll('button')).find(b =>
            b.textContent?.trim().toLowerCase().includes('consultar')
          )) as HTMLElement;
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 5000));

      // PASO 11: ESPERAR MODAL Y DESCARGAR XML
      console.log('[Scraping] Esperando modal con factura...');
      await targetFrame.waitForSelector('ngb-modal-window, .modal-dialog, control-cpe-factura', {
        timeout: 10000,
      });
      await new Promise(r => setTimeout(r, 2000));
      console.log('[Scraping] Modal con factura abierto');

      // Configurar descarga
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: this.downloadPath,
      });

      // Click en botón XML
      console.log('[Scraping] Descargando XML...');
      const xmlClicked = await targetFrame.evaluate(() => {
        const container = document.querySelector('div.button-container, .button-container');
        if (container) {
          const buttons = container.querySelectorAll('button');
          if (buttons[1]) {
            (buttons[1] as HTMLElement).click();
            return { clicked: true, method: 'button-container index 1' };
          }
        }

        const allBtns = Array.from(document.querySelectorAll('button'));
        const xmlBtn = allBtns.find(b => {
          const title = ((b as HTMLElement).title || b.getAttribute('aria-label') || '').toLowerCase();
          const cls = (b.className || '').toLowerCase();
          return title.includes('xml') || cls.includes('xml');
        });

        if (xmlBtn) {
          (xmlBtn as HTMLElement).click();
          return { clicked: true, method: 'aria-label/title' };
        }

        const ngxBtns = Array.from(document.querySelectorAll('ngb-modal-window button, .modal button'));
        if (ngxBtns.length >= 2) {
          (ngxBtns[1] as HTMLElement).click();
          return { clicked: true, method: 'modal button index 1' };
        }

        return { clicked: false };
      });

      if (!xmlClicked.clicked) {
        throw new Error('No se pudo hacer click en botón XML');
      }

      await new Promise(r => setTimeout(r, 3000));

      // Esperar descarga
      console.log('[Scraping] Esperando descarga...');
      let downloaded = false;
      let fileName = '';

      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));

        const files = await fs.readdir(this.downloadPath);
        const xmlFile = files.find(
          f =>
            (f.endsWith('.xml') || f.endsWith('.zip')) && !f.endsWith('.crdownload') && !f.endsWith('.tmp')
        );

        if (xmlFile) {
          fileName = xmlFile;
          downloaded = true;
          break;
        }
      }

      if (!downloaded) {
        throw new Error('Timeout esperando descarga');
      }

      console.log(`[Scraping] XML descargado: ${fileName}`);

      // Leer archivo
      const filePath = path.join(this.downloadPath, fileName);
      const buffer = await fs.readFile(filePath);

      // Limpiar archivo temporal
      await fs.unlink(filePath).catch(() => {});

      return {
        fileName,
        buffer,
      };
    } catch (error) {
      console.error('[Scraping] Error:', error);
      throw error;
    } finally {
      await page.close();
    }
  }

  async downloadXMLBatch(comprobantes: XMLDownloadParams[]): Promise<XMLDownloadResult[]> {
    const results: XMLDownloadResult[] = [];

    for (const comp of comprobantes) {
      try {
        const result = await this.downloadXML(comp);
        results.push({
          comprobante: `${comp.serie}-${comp.numero}`,
          success: true,
          fileName: result.fileName,
          buffer: result.buffer,
        });

        console.log(`[Scraping] ✅ ${comp.serie}-${comp.numero} descargado`);
      } catch (error) {
        results.push({
          comprobante: `${comp.serie}-${comp.numero}`,
          success: false,
          error: (error as Error).message,
        });

        console.error(`[Scraping] ❌ ${comp.serie}-${comp.numero} falló:`, (error as Error).message);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.init();
      return true;
    } catch (error) {
      console.error('[Scraping] Health check falló:', error);
      return false;
    }
  }
}
