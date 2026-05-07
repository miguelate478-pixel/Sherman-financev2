import puppeteer, { Browser, Page } from 'puppeteer-core';
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

    // Crear directorio de descargas
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

  private async loginSunat(page: Page, ruc: string, usuario: string, clave: string): Promise<void> {
    console.log('[Scraping] Iniciando sesión en SUNAT...');

    try {
      // Ir al portal de SUNAT (Menú SOL)
      await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Esperar a que cargue el formulario
      await page.waitForSelector('#txtRuc', { timeout: 10000 });

      // Llenar formulario
      await page.type('#txtRuc', ruc, { delay: 100 });
      await page.type('#txtUsuario', usuario, { delay: 100 });
      await page.type('#txtContrasena', clave, { delay: 100 });

      // Hacer clic en ingresar (sin esperar navegación porque no siempre navega)
      await page.click('#btnAceptar');

      // Esperar 3 segundos para que procese el login
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verificar si el login fue exitoso buscando elementos del menú
      const menuLoaded = await page.$('#divContainerMenu');
      if (!menuLoaded) {
        // Buscar mensaje de error
        const loginError = await page.$('.mensajeError, .error');
        if (loginError) {
          const errorText = await page.evaluate(el => el?.textContent, loginError);
          throw new Error(`Error de login: ${errorText}`);
        }
        throw new Error('Login falló - no se cargó el menú');
      }

      console.log('[Scraping] Login exitoso');
    } catch (error) {
      console.error('[Scraping] Error en login:', error);
      throw new Error(`Error al iniciar sesión en SUNAT: ${(error as Error).message}`);
    }
  }

  private async selectEmpresas(page: Page): Promise<void> {
    console.log('[Scraping] Seleccionando opción "Empresas"...');

    try {
      // Empresas tiene data-id="2" en el HTML
      const empresasClicked = await page.evaluate(() => {
        // Buscar por data-id="2" o id="divOpcionServicio2"
        const empresasDiv = document.querySelector('div[data-id="2"]') ||
                           document.querySelector('#divOpcionServicio2');
        
        if (empresasDiv) {
          (empresasDiv as HTMLElement).click();
          return true;
        }
        
        // Fallback: buscar por contenido del h4
        const allDivs = Array.from(document.querySelectorAll('div.list-group-item'));
        const empresasItem = allDivs.find(d => {
          const h4 = d.querySelector('h4');
          return h4?.textContent?.trim().toLowerCase().includes('empresa');
        });
        
        if (empresasItem) {
          (empresasItem as HTMLElement).click();
          return true;
        }
        
        return false;
      });

      if (empresasClicked) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verificar que quedó en modo Empresas
        const enEmpresas = await page.evaluate(() => {
          const active = document.querySelector('div.divOpcionServicioActivo, div.list-group-item.active');
          return active?.getAttribute('data-id');
        });
        
        console.log(`[Scraping] Opción activa data-id: ${enEmpresas} (debe ser 2 = Empresas)`);
        console.log('[Scraping] Opción "Empresas" seleccionada');
      } else {
        console.log('[Scraping] ⚠️  Opción "Empresas" no encontrada, continuando...');
      }
    } catch (error) {
      console.log('[Scraping] ⚠️  Error al seleccionar "Empresas":', (error as Error).message);
    }
  }

  private async tryMultipleSelectors(
    page: Page,
    selectors: string[],
    action: 'click' | 'type' | 'select',
    value?: string
  ): Promise<boolean> {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          if (action === 'click') {
            await element.click();
          } else if (action === 'type' && value) {
            await element.type(value, { delay: 100 });
          } else if (action === 'select' && value) {
            await page.select(selector, value);
          }
          console.log(`[Scraping] ✅ Selector funcionó: ${selector}`);
          return true;
        }
      } catch (error) {
        // Continuar con el siguiente selector
      }
    }
    return false;
  }

  async downloadXML(params: XMLDownloadParams): Promise<{ fileName: string; buffer: Buffer }> {
    await this.init();

    if (!this.browser) {
      throw new Error('Navegador no inicializado');
    }

    const page = await this.browser.newPage();

    // Configurar viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Configurar user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    try {
      // 1. Login
      await this.loginSunat(page, params.ruc, params.solUser, params.solPass);

      // 1.5. Seleccionar "Empresas"
      await this.selectEmpresas(page);

      // 2. Navegar por el menú usando data-ids (4 clicks exactos)
      console.log('[Scraping] Navegando por el menú...');

      // Click 1: "Comprobantes de pago" - nivel 1 (data-id2="11")
      console.log('[Scraping] Click 1: Comprobantes de pago (nivel 1)...');
      await page.evaluate(() => {
        const el = document.querySelector('li[data-id2="11"] span.spanNivelDescripcion');
        if (el) {
          (el as HTMLElement).click();
        } else {
          const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
          const target = spans.find(s => s.textContent?.trim() === 'Comprobantes de pago');
          if (target) (target as HTMLElement).click();
        }
      });
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Click 2: "Comprobantes de Pago" - nivel 2 (data-id2="11_38")
      console.log('[Scraping] Click 2: Comprobantes de Pago (nivel 2)...');
      await page.evaluate(() => {
        const el = document.querySelector('li[data-id2="11_38"] span.spanNivelDescripcion');
        if (el) {
          (el as HTMLElement).click();
        } else {
          const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
          const matches = spans.filter(s => {
            const text = s.textContent?.trim().toLowerCase();
            return text?.includes('comprobantes de pago');
          });
          if (matches.length > 1) {
            (matches[1] as HTMLElement).click();
          } else if (matches[0]) {
            (matches[0] as HTMLElement).click();
          }
        }
      });
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Click 3: "Consulta de Comprobantes de Pago" - nivel 3 (data-id2="11_38_1")
      console.log('[Scraping] Click 3: Consulta de Comprobantes de Pago (nivel 3)...');
      await page.evaluate(() => {
        const el = document.querySelector('li[data-id2="11_38_1"] span.spanNivelDescripcion');
        if (el) {
          (el as HTMLElement).click();
        } else {
          const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
          const target = spans.find(s => s.textContent?.trim() === 'Consulta de Comprobantes de Pago');
          if (target) (target as HTMLElement).click();
        }
      });
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Click 4: "Nueva Consulta de comprobantes de pago" - nivel 4 (data-id2="11_38_1_1")
      console.log('[Scraping] Click 4: Nueva Consulta de comprobantes de pago (nivel 4)...');
      await page.evaluate(() => {
        const el = document.querySelector('li[data-id2="11_38_1_1"] span.spanNivelDescripcion');
        if (el) {
          (el as HTMLElement).click();
        } else {
          const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
          const target = spans.find(s => s.textContent?.trim() === 'Nueva Consulta de comprobantes de pago');
          if (target) (target as HTMLElement).click();
        }
      });
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('[Scraping] Menú navegado, buscando formulario...');

      // 3. Buscar el formulario - puede estar en un iframe
      const frames = page.frames();
      console.log(`[Scraping] Total frames: ${frames.length}`);

      let targetFrame = page.mainFrame();
      
      // Buscar frame que contenga el formulario
      for (const frame of frames) {
        const url = frame.url();
        if (url.includes('ConsultaComprobante') || url.includes('comprobante') || url.includes('e-factura')) {
          console.log(`[Scraping] Frame del formulario encontrado: ${url}`);
          targetFrame = frame;
          break;
        }
      }

      // Si no encontramos por URL, buscar por contenido
      if (targetFrame === page.mainFrame()) {
        for (const frame of frames) {
          try {
            const hasForm = await frame.evaluate(() => {
              const rucInput = document.querySelector('input[name="rucEmisor"]') ||
                              document.querySelector('input[formcontrolname="rucEmisor"]') ||
                              document.querySelector('#rucEmisor');
              return !!rucInput;
            });
            
            if (hasForm) {
              console.log(`[Scraping] Formulario encontrado en frame: ${frame.url()}`);
              targetFrame = frame;
              break;
            }
          } catch (error) {
            // Frame no accesible, continuar
          }
        }
      }

      console.log('[Scraping] Usando frame:', targetFrame.url());

      // 4. Seleccionar filtro "Recibido" (comprobantes recibidos)
      console.log('[Scraping] Seleccionando filtro "Recibido"...');
      
      await targetFrame.evaluate(() => {
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
        const recibidoRadio = radios.find(r => {
          const label = document.querySelector(`label[for="${r.id}"]`);
          return label?.textContent?.trim().toLowerCase().includes('recibido');
        });

        if (recibidoRadio) {
          (recibidoRadio as HTMLInputElement).click();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // 5. Llenar formulario de búsqueda
      console.log(`[Scraping] Buscando factura ${params.serie}-${params.numero}...`);

      const formFilled = await targetFrame.evaluate((data) => {
        // RUC Emisor - múltiples selectores
        const rucInput = (document.querySelector('input[name="rucEmisor"]') ||
                        document.querySelector('input[formcontrolname="rucEmisor"]') ||
                        document.querySelector('#rucEmisor')) as HTMLInputElement | null;
        
        if (!rucInput) return { success: false, field: 'rucEmisor' };
        rucInput.value = data.rucEmisor;
        rucInput.dispatchEvent(new Event('input', { bubbles: true }));
        rucInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Tipo de comprobante
        const tipoSelect = (document.querySelector('select[name="tipoComprobante"]') ||
                          document.querySelector('select[formcontrolname="tipoComprobante"]') ||
                          document.querySelector('#tipoComprobante')) as HTMLSelectElement | null;
        
        if (tipoSelect) {
          tipoSelect.value = data.tipoComprobante;
          tipoSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        // Serie
        const serieInput = (document.querySelector('input[name="serieComprobante"]') ||
                          document.querySelector('input[formcontrolname="serieComprobante"]') ||
                          document.querySelector('#serieComprobante')) as HTMLInputElement | null;
        
        if (!serieInput) return { success: false, field: 'serieComprobante' };
        serieInput.value = data.serie;
        serieInput.dispatchEvent(new Event('input', { bubbles: true }));
        serieInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Número
        const numeroInput = (document.querySelector('input[name="numeroComprobante"]') ||
                           document.querySelector('input[formcontrolname="numeroComprobante"]') ||
                           document.querySelector('#numeroComprobante')) as HTMLInputElement | null;
        
        if (!numeroInput) return { success: false, field: 'numeroComprobante' };
        numeroInput.value = data.numero;
        numeroInput.dispatchEvent(new Event('input', { bubbles: true }));
        numeroInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        return { success: true };
      }, {
        rucEmisor: params.rucEmisor,
        tipoComprobante: params.tipoComprobante,
        serie: params.serie,
        numero: params.numero,
      });

      if (!formFilled.success) {
        throw new Error(`No se pudo llenar el campo: ${formFilled.field}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // 6. Hacer clic en "Consultar"
      const consultarClicked = await targetFrame.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        const consultarBtn = buttons.find(btn => {
          const text = (btn.textContent?.trim().toLowerCase() || (btn as HTMLInputElement).value?.toLowerCase());
          return text?.includes('consultar') || text?.includes('buscar');
        });

        if (consultarBtn) {
          (consultarBtn as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (!consultarClicked) {
        throw new Error('No se pudo hacer clic en "Consultar"');
      }

      // Esperar resultados
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 7. Esperar que aparezca el modal con la factura
      console.log('[Scraping] Esperando modal con factura...');
      await targetFrame.waitForSelector('ngb-modal-window, .modal-dialog, control-cpe-factura', {
        timeout: 10000
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('[Scraping] Modal con factura abierto');

      // 8. Configurar descarga
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: this.downloadPath,
      });

      // 9. Buscar y hacer clic en botón de descarga XML
      // Los botones están en div.button-container dentro del modal
      // El botón XML es el segundo (índice 1)
      const downloadClicked = await targetFrame.evaluate(() => {
        // Buscar el botón XML en el contenedor de botones
        const container = document.querySelector('div.button-container, .button-container');
        if (container) {
          const buttons = container.querySelectorAll('button');
          // El segundo botón (índice 1) es el XML (verde)
          if (buttons[1]) {
            (buttons[1] as HTMLElement).click();
            return true;
          }
        }
        
        // Fallback: buscar por título o aria-label
        const allBtns = Array.from(document.querySelectorAll('button'));
        const xmlBtn = allBtns.find(b => {
          const title = ((b as HTMLElement).title || b.getAttribute('aria-label') || '').toLowerCase();
          const cls = (b.className || '').toLowerCase();
          return title.includes('xml') || cls.includes('xml');
        });
        
        if (xmlBtn) {
          (xmlBtn as HTMLElement).click();
          return true;
        }
        
        // Fallback 2: el botón verde (segundo en modal)
        const ngxBtns = Array.from(document.querySelectorAll('ngb-modal-window button, .modal button'));
        if (ngxBtns.length >= 2) {
          (ngxBtns[1] as HTMLElement).click();
          return true;
        }
        
        return false;
      });

      if (!downloadClicked) {
        throw new Error('Botón de descarga XML no encontrado');
      }

      console.log('[Scraping] Click en botón XML realizado');

      // 10. Esperar a que se descargue (polling del archivo)
      console.log('[Scraping] Esperando descarga...');

      let downloaded = false;
      let attempts = 0;
      let fileName = '';
      const maxAttempts = 30;

      while (!downloaded && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const files = await fs.readdir(this.downloadPath);
        const xmlFile = files.find(
          f =>
            (f.endsWith('.xml') || f.endsWith('.zip')) &&
            !f.endsWith('.crdownload') &&
            !f.endsWith('.tmp')
        );

        if (xmlFile) {
          fileName = xmlFile;
          downloaded = true;
        }

        attempts++;
      }

      if (!downloaded) {
        throw new Error('Timeout esperando descarga del XML');
      }

      console.log(`[Scraping] XML descargado: ${fileName}`);

      // 7. Leer archivo
      const filePath = path.join(this.downloadPath, fileName);
      const buffer = await fs.readFile(filePath);

      // 8. Limpiar archivo temporal
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

      // Esperar entre descargas para no saturar
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
