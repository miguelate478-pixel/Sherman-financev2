// AUTOMATIZACIÓN COMPLETA DE DESCARGA DE XML DESDE SUNAT
// Este código hace login, navega por el menú de Empresas, busca una factura y descarga el XML

import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';

// ============================================
// CONFIGURACIÓN
// ============================================
const CONFIG = {
  ruc: '20610169849',
  solUser: 'SHERMAN1',
  solPass: 'Pepe2024',
  chromiumPath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  downloadPath: path.join(process.cwd(), 'temp-downloads'),
  headless: false, // Cambiar a true para producción
};

// Factura de prueba
const FACTURA = {
  rucEmisor: '20508565934', // Tottus
  tipoComprobante: '01', // 01 = Factura
  serie: 'FJ88',
  numero: '30587',
};

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================
async function descargarXMLDeSUNAT(factura) {
  console.log('=== AUTOMATIZACIÓN SUNAT - DESCARGA DE XML ===\n');
  console.log(`Factura: ${factura.serie}-${factura.numero}`);
  console.log(`RUC Emisor: ${factura.rucEmisor}\n`);

  let browser;
  
  try {
    // Crear directorio de descargas
    await fs.mkdir(CONFIG.downloadPath, { recursive: true });
    
    // Iniciar navegador
    console.log('[1/12] Iniciando navegador...');
    browser = await puppeteer.launch({
      executablePath: CONFIG.chromiumPath,
      headless: CONFIG.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--start-maximized',
      ],
      defaultViewport: null,
    });
    
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    console.log('✅ Navegador iniciado\n');
    
    // ============================================
    // PASO 1: LOGIN
    // ============================================
    console.log('[2/12] Login en SUNAT...');
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    await page.type('#txtRuc', CONFIG.ruc, { delay: 100 });
    await page.type('#txtUsuario', CONFIG.solUser, { delay: 100 });
    await page.type('#txtContrasena', CONFIG.solPass, { delay: 100 });
    await page.click('#btnAceptar');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const menuLoaded = await page.$('#divContainerMenu');
    if (!menuLoaded) {
      throw new Error('Login falló - no se cargó el menú');
    }
    console.log('✅ Login exitoso\n');
    
    // ============================================
    // PASO 2: CLICK EN EMPRESAS
    // ============================================
    console.log('[3/12] Seleccionando Empresas...');
    const empresasClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, div, span, li'));
      const empresasEl = elements.find(el => {
        const text = el.textContent?.trim().toLowerCase();
        return text === 'empresas' || text?.includes('empresa');
      });
      
      if (empresasEl) {
        empresasEl.click();
        return true;
      }
      return false;
    });
    
    if (!empresasClicked) {
      throw new Error('No se encontró la opción "Empresas"');
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Empresas seleccionado\n');
    
    // ============================================
    // PASOS 3-6: NAVEGACIÓN POR MENÚ (4 CLICKS)
    // ============================================
    
    // Click 1: Comprobantes de pago (data-id2="11")
    console.log('[4/12] Click 1: Comprobantes de pago...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11"] span.spanNivelDescripcion');
      if (el) {
        el.click();
      } else {
        const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
        const target = spans.find(s => s.textContent?.trim() === 'Comprobantes de pago');
        if (target) target.click();
      }
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('✅ Click 1 realizado\n');
    
    // Click 2: Comprobantes de Pago nivel 2 (data-id2="11_38")
    console.log('[5/12] Click 2: Comprobantes de Pago (nivel 2)...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11_38"] span.spanNivelDescripcion');
      if (el) {
        el.click();
      } else {
        const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
        const matches = spans.filter(s => {
          const text = s.textContent?.trim().toLowerCase();
          return text?.includes('comprobantes de pago');
        });
        if (matches.length > 1) {
          matches[1].click();
        } else if (matches[0]) {
          matches[0].click();
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('✅ Click 2 realizado\n');
    
    // Click 3: Consulta de Comprobantes de Pago (data-id2="11_38_1")
    console.log('[6/12] Click 3: Consulta de Comprobantes de Pago...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11_38_1"] span.spanNivelDescripcion');
      if (el) {
        el.click();
      } else {
        const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
        const target = spans.find(s => s.textContent?.trim() === 'Consulta de Comprobantes de Pago');
        if (target) target.click();
      }
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('✅ Click 3 realizado\n');
    
    // Click 4: Nueva Consulta de comprobantes de pago (data-id2="11_38_1_1")
    console.log('[7/12] Click 4: Nueva Consulta de comprobantes de pago...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11_38_1_1"] span.spanNivelDescripcion');
      if (el) {
        el.click();
      } else {
        const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
        const target = spans.find(s => s.textContent?.trim() === 'Nueva Consulta de comprobantes de pago');
        if (target) target.click();
      }
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Click 4 realizado\n');
    
    // ============================================
    // PASO 7: BUSCAR FORMULARIO EN IFRAME
    // ============================================
    console.log('[8/12] Buscando formulario...');
    
    const frames = page.frames();
    console.log(`Total frames: ${frames.length}`);
    
    let targetFrame = page.mainFrame();
    
    // Buscar frame por URL
    for (const frame of frames) {
      const url = frame.url();
      if (url.includes('ConsultaComprobante') || url.includes('comprobante') || url.includes('e-factura')) {
        console.log(`Frame encontrado: ${url}`);
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
            console.log(`Formulario encontrado en frame: ${frame.url()}`);
            targetFrame = frame;
            break;
          }
        } catch (error) {
          // Frame no accesible
        }
      }
    }
    
    console.log(`✅ Usando frame: ${targetFrame.url()}\n`);
    
    // ============================================
    // PASO 8: SELECCIONAR "RECIBIDO"
    // ============================================
    console.log('[9/12] Seleccionando filtro "Recibido"...');
    await targetFrame.evaluate(() => {
      const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
      const recibidoRadio = radios.find(r => {
        const label = document.querySelector(`label[for="${r.id}"]`);
        return label?.textContent?.trim().toLowerCase().includes('recibido');
      });
      
      if (recibidoRadio) {
        recibidoRadio.click();
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Filtro "Recibido" seleccionado\n');
    
    // ============================================
    // PASO 9: LLENAR FORMULARIO
    // ============================================
    console.log('[10/12] Llenando formulario...');
    
    const formFilled = await targetFrame.evaluate((data) => {
      // RUC Emisor
      const rucInput = document.querySelector('input[name="rucEmisor"]') ||
                      document.querySelector('input[formcontrolname="rucEmisor"]') ||
                      document.querySelector('#rucEmisor');
      
      if (!rucInput) return { success: false, field: 'rucEmisor' };
      rucInput.value = data.rucEmisor;
      rucInput.dispatchEvent(new Event('input', { bubbles: true }));
      rucInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Tipo de comprobante
      const tipoSelect = document.querySelector('select[name="tipoComprobante"]') ||
                        document.querySelector('select[formcontrolname="tipoComprobante"]') ||
                        document.querySelector('#tipoComprobante');
      
      if (tipoSelect) {
        tipoSelect.value = data.tipoComprobante;
        tipoSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Serie
      const serieInput = document.querySelector('input[name="serieComprobante"]') ||
                        document.querySelector('input[formcontrolname="serieComprobante"]') ||
                        document.querySelector('#serieComprobante');
      
      if (!serieInput) return { success: false, field: 'serieComprobante' };
      serieInput.value = data.serie;
      serieInput.dispatchEvent(new Event('input', { bubbles: true }));
      serieInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Número
      const numeroInput = document.querySelector('input[name="numeroComprobante"]') ||
                         document.querySelector('input[formcontrolname="numeroComprobante"]') ||
                         document.querySelector('#numeroComprobante');
      
      if (!numeroInput) return { success: false, field: 'numeroComprobante' };
      numeroInput.value = data.numero;
      numeroInput.dispatchEvent(new Event('input', { bubbles: true }));
      numeroInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      return { success: true };
    }, factura);
    
    if (!formFilled.success) {
      throw new Error(`No se pudo llenar el campo: ${formFilled.field}`);
    }
    
    console.log(`  ✅ RUC Emisor: ${factura.rucEmisor}`);
    console.log(`  ✅ Tipo: ${factura.tipoComprobante}`);
    console.log(`  ✅ Serie: ${factura.serie}`);
    console.log(`  ✅ Número: ${factura.numero}\n`);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // ============================================
    // PASO 10: CONSULTAR
    // ============================================
    console.log('[11/12] Consultando...');
    
    const consultarClicked = await targetFrame.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const consultarBtn = buttons.find(btn => {
        const text = btn.textContent?.trim().toLowerCase() || btn.value?.toLowerCase();
        return text?.includes('consultar') || text?.includes('buscar');
      });
      
      if (consultarBtn) {
        consultarBtn.click();
        return true;
      }
      return false;
    });
    
    if (!consultarClicked) {
      throw new Error('No se pudo hacer clic en "Consultar"');
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ Consulta realizada\n');
    
    // Verificar resultados
    const hasResults = await targetFrame.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const noResults = bodyText.toLowerCase().includes('no se encontraron') ||
                       bodyText.toLowerCase().includes('sin resultados') ||
                       bodyText.toLowerCase().includes('no existen');
      
      return !noResults;
    });
    
    if (!hasResults) {
      throw new Error('Comprobante no encontrado en SUNAT');
    }
    
    console.log('✅ Comprobante encontrado\n');
    
    // ============================================
    // PASO 11: DESCARGAR XML
    // ============================================
    console.log('[12/12] Descargando XML...');
    
    // Configurar descarga
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: CONFIG.downloadPath,
    });
    
    // Click en botón de descarga
    const downloadClicked = await targetFrame.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
      const xmlButton = allButtons.find(btn => {
        const text = (btn.textContent || btn.value || '').toLowerCase();
        const title = (btn.title || '').toLowerCase();
        return text.includes('xml') || text.includes('descargar') || 
               title.includes('xml') || title.includes('descargar');
      });
      
      if (xmlButton) {
        xmlButton.click();
        return true;
      }
      return false;
    });
    
    if (!downloadClicked) {
      throw new Error('Botón de descarga XML no encontrado');
    }
    
    console.log('  ✅ Click en botón de descarga');
    console.log('  Esperando descarga...');
    
    // Esperar a que se descargue el archivo
    let downloaded = false;
    let attempts = 0;
    let fileName = '';
    const maxAttempts = 30;
    
    while (!downloaded && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const files = await fs.readdir(CONFIG.downloadPath);
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
      if (attempts % 5 === 0) {
        console.log(`  Esperando... (${attempts}s)`);
      }
    }
    
    if (!downloaded) {
      throw new Error('Timeout esperando descarga del XML');
    }
    
    console.log(`\n✅ XML descargado: ${fileName}`);
    
    // Leer archivo
    const filePath = path.join(CONFIG.downloadPath, fileName);
    const buffer = await fs.readFile(filePath);
    
    console.log(`Tamaño: ${buffer.length} bytes`);
    
    // Guardar copia con nombre descriptivo
    const newFileName = `${factura.rucEmisor}-${factura.serie}-${factura.numero}.xml`;
    await fs.writeFile(newFileName, buffer);
    
    console.log('\n========================================');
    console.log('✅ DESCARGA COMPLETA Y EXITOSA');
    console.log('========================================');
    console.log(`\nArchivo guardado como: ${newFileName}`);
    console.log(`Ubicación: ${path.join(process.cwd(), newFileName)}`);
    
    // Esperar un poco antes de cerrar
    if (!CONFIG.headless) {
      console.log('\nEsperando 5 segundos antes de cerrar...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    return {
      success: true,
      fileName: newFileName,
      size: buffer.length,
    };
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    if (browser) {
      await browser.close();
      console.log('\nNavegador cerrado');
    }
  }
}

// ============================================
// EJECUTAR
// ============================================
descargarXMLDeSUNAT(FACTURA).then(result => {
  if (result.success) {
    console.log('\n✅ Proceso completado exitosamente');
  } else {
    console.log('\n❌ Proceso falló');
  }
  process.exit(result.success ? 0 : 1);
});
