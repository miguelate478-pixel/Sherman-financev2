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
    
    // ============================================
    // PASO 1: INICIAR NAVEGADOR
    // ============================================
    console.log('[1/12] Iniciando navegador...');
    browser = await puppeteer.launch({
      executablePath: CONFIG.chromiumPath,
      headless: CONFIG.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--start-maximized'
      ],
      defaultViewport: null,
    });
    
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    );
    console.log('✅ Navegador iniciado\n');
    
    // ============================================
    // PASO 2: LOGIN
    // ============================================
    console.log('[2/12] Login en SUNAT...');
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    await page.type('#txtRuc', CONFIG.ruc, { delay: 80 });
    await page.type('#txtUsuario', CONFIG.solUser, { delay: 80 });
    await page.type('#txtContrasena', CONFIG.solPass, { delay: 80 });
    await page.click('#btnAceptar');
    await page.waitForSelector('#divContainerMenu', { timeout: 15000 });
    console.log('✅ Login exitoso\n');
    
    // ============================================
    // PASO 3: CLICK EN EMPRESAS
    // ============================================
    console.log('[3/12] Click en Empresas...');
    await page.evaluate(() => {
      // Empresas tiene data-id="2" en el HTML:
      // <div id="divOpcionServicio2" class="list-group-item backPlom1 sinBorde sinRadio divOpcionServicioActivo" data-id="2">
      const empresasDiv = document.querySelector('div[data-id="2"]')
        || document.querySelector('#divOpcionServicio2');
      
      if (empresasDiv) {
        empresasDiv.click();
        return true;
      }
      
      // Fallback: buscar el h4 o span dentro del div de Empresas
      const allDivs = Array.from(document.querySelectorAll('div.list-group-item'));
      const empresasItem = allDivs.find(d => {
        const h4 = d.querySelector('h4');
        return h4?.textContent?.trim().toLowerCase().includes('empresa');
      });
      
      if (empresasItem) {
        empresasItem.click();
        return true;
      }
      
      return false;
    });
    await new Promise(r => setTimeout(r, 2000));
    
    // VERIFICAR que quedó en modo Empresas
    const enEmpresas = await page.evaluate(() => {
      const active = document.querySelector('div.divOpcionServicioActivo, div.list-group-item.active');
      return active?.getAttribute('data-id');
    });
    
    console.log(`✅ Opción activa data-id: ${enEmpresas} (debe ser 2 = Empresas)\n`);
    
    // ============================================
    // PASOS 4-7: NAVEGACIÓN POR MENÚ (4 CLICKS)
    // ============================================
    
    // Click 1: Comprobantes de pago (data-id2="11")
    console.log('[4/12] Click 1: Comprobantes de pago...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11"] span.spanNivelDescripcion')
        || Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
          .find(s => s.textContent.trim() === 'Comprobantes de pago');
      if (el) el.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    console.log('✅ Click 1 realizado\n');
    
    // Click 2: Comprobantes de Pago nivel 2 (data-id2="11_38")
    console.log('[5/12] Click 2: Comprobantes de Pago (nivel 2)...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11_38"] span.spanNivelDescripcion')
        || Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
          .filter(s => s.textContent.trim().toLowerCase() === 'comprobantes de pago')[1];
      if (el) el.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    console.log('✅ Click 2 realizado\n');
    
    // Click 3: Consulta de Comprobantes de Pago (data-id2="11_38_1")
    console.log('[6/12] Click 3: Consulta de Comprobantes de Pago...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11_38_1"] span.spanNivelDescripcion')
        || Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
          .find(s => s.textContent.trim() === 'Consulta de Comprobantes de Pago');
      if (el) el.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    console.log('✅ Click 3 realizado\n');
    
    // Click 4: Nueva Consulta de comprobantes de pago (data-id2="11_38_1_1")
    console.log('[7/12] Click 4: Nueva Consulta de comprobantes de pago...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11_38_1_1"] span.spanNivelDescripcion')
        || Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
          .find(s => s.textContent.trim() === 'Nueva Consulta de comprobantes de pago');
      if (el) el.click();
    });
    await new Promise(r => setTimeout(r, 4000));
    console.log('✅ Click 4 realizado\n');
    
    // ============================================
    // PASO 8: BUSCAR FORMULARIO EN IFRAME
    // ============================================
    console.log('[8/12] Buscando formulario Angular en iframe...');
    let targetFrame = page.mainFrame();
    
    for (const frame of page.frames()) {
      try {
        const hasForm = await frame.evaluate(() =>
          !!(document.querySelector('input[formcontrolname="rucEmisor"]') ||
             document.querySelector('input[name="rucEmisor"]'))
        );
        if (hasForm) {
          targetFrame = frame;
          break;
        }
      } catch {}
    }
    
    console.log(`✅ Frame encontrado: ${targetFrame.url()}\n`);
    
    // ============================================
    // PASO 9: SELECCIONAR "RECIBIDO"
    // ============================================
    console.log('[9/12] Seleccionando filtro "Recibido"...');
    await targetFrame.evaluate(() => {
      const radio = document.querySelector('input[type="radio"][value="RBR"]')
        || document.querySelector('input[id="recibido"]');
      if (radio) {
        radio.click();
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log('✅ Recibido seleccionado\n');
    
    // ============================================
    // PASO 10: LLENAR FORMULARIO
    // ============================================
    console.log('[10/12] Llenando formulario...');
    
    // RUC Emisor
    await targetFrame.evaluate((ruc) => {
      const input = document.querySelector('input[formcontrolname="rucEmisor"]')
        || document.querySelector('input[name="rucEmisor"]');
      if (input) {
        input.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        ).set;
        nativeInputValueSetter.call(input, ruc);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    }, factura.rucEmisor);
    await new Promise(r => setTimeout(r, 800));
    console.log(`  ✅ RUC Emisor: ${factura.rucEmisor}`);
    
    // Tipo de comprobante (PrimeNG dropdown)
    await targetFrame.evaluate(() => {
      const trigger = document.querySelector(
        'div[role="button"][aria-haspopup="listbox"], p-dropdown div.p-dropdown-trigger'
      );
      if (trigger) trigger.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    
    await targetFrame.evaluate(() => {
      const items = Array.from(document.querySelectorAll(
        'li[role="option"], .p-dropdown-item, li.p-dropdown-item'
      ));
      const factura = items.find(i => i.textContent.trim() === 'Factura');
      if (factura) factura.click();
    });
    await new Promise(r => setTimeout(r, 800));
    console.log(`  ✅ Tipo: ${factura.tipoComprobante} (Factura)`);
    
    // Serie
    await targetFrame.evaluate((serie) => {
      const input = document.querySelector('input[formcontrolname="serieComprobante"]')
        || document.querySelector('input[name="serieComprobante"]');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        ).set;
        setter.call(input, serie);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, factura.serie);
    await new Promise(r => setTimeout(r, 500));
    console.log(`  ✅ Serie: ${factura.serie}`);
    
    // Número
    await targetFrame.evaluate((numero) => {
      const input = document.querySelector('input[formcontrolname="numeroComprobante"]')
        || document.querySelector('input[name="numeroComprobante"]');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        ).set;
        setter.call(input, numero);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, factura.numero);
    await new Promise(r => setTimeout(r, 500));
    console.log(`  ✅ Número: ${factura.numero}\n`);
    
    // ============================================
    // PASO 11: CONSULTAR
    // ============================================
    console.log('[11/12] Consultando...');
    await targetFrame.evaluate(() => {
      const btn = document.querySelector('button.btn.boton-primary')
        || document.querySelector('button[type="submit"]')
        || Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent.trim().toLowerCase().includes('consultar'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 5000));
    console.log('✅ Consulta enviada\n');
    
    // ============================================
    // PASO 12: ESPERAR MODAL Y DESCARGAR XML
    // ============================================
    console.log('[12/12] Esperando modal con factura...');
    await targetFrame.waitForSelector('ngb-modal-window, .modal-dialog, control-cpe-factura', {
      timeout: 10000
    });
    await new Promise(r => setTimeout(r, 2000));
    console.log('✅ Modal con factura abierto\n');
    
    // Configurar descarga
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: CONFIG.downloadPath,
    });
    
    // Click en botón XML (segundo botón en container)
    console.log('Descargando XML...');
    const xmlClicked = await targetFrame.evaluate(() => {
      // Buscar el botón XML en el contenedor de botones
      const container = document.querySelector('div.button-container, .button-container');
      if (container) {
        const buttons = container.querySelectorAll('button');
        // El segundo botón (índice 1) es el XML (verde)
        if (buttons[1]) {
          buttons[1].click();
          return { clicked: true, method: 'button-container index 1' };
        }
      }
      
      // Fallback: buscar por título o aria-label
      const allBtns = Array.from(document.querySelectorAll('button'));
      const xmlBtn = allBtns.find(b => {
        const title = (b.title || b.getAttribute('aria-label') || '').toLowerCase();
        const cls = (b.className || '').toLowerCase();
        return title.includes('xml') || cls.includes('xml');
      });
      
      if (xmlBtn) {
        xmlBtn.click();
        return { clicked: true, method: 'aria-label/title' };
      }
      
      // Fallback 2: el botón verde (segundo en modal)
      const ngxBtns = Array.from(document.querySelectorAll('ngb-modal-window button, .modal button'));
      if (ngxBtns.length >= 2) {
        ngxBtns[1].click();
        return { clicked: true, method: 'modal button index 1' };
      }
      
      return { clicked: false };
    });
    
    console.log(`Click XML: ${xmlClicked.method || 'fallido'}`);
    
    if (!xmlClicked.clicked) {
      throw new Error('No se pudo hacer click en botón XML');
    }
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Esperar descarga
    console.log('Esperando descarga...');
    let downloaded = false;
    let fileName = '';
    
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      
      const files = await fs.readdir(CONFIG.downloadPath);
      const xmlFile = files.find(f =>
        (f.endsWith('.xml') || f.endsWith('.zip')) &&
        !f.endsWith('.crdownload') &&
        !f.endsWith('.tmp')
      );
      
      if (xmlFile) {
        fileName = xmlFile;
        downloaded = true;
        break;
      }
      
      if (i % 5 === 0 && i > 0) {
        console.log(`  Esperando... ${i}s`);
      }
    }
    
    if (!downloaded) {
      await page.screenshot({ path: 'error-no-download.png', fullPage: true });
      throw new Error('Timeout esperando descarga - ver error-no-download.png');
    }
    
    // Leer archivo
    const filePath = path.join(CONFIG.downloadPath, fileName);
    const buffer = await fs.readFile(filePath);
    
    console.log('\n========================================');
    console.log('✅ DESCARGA EXITOSA');
    console.log('========================================');
    console.log(`Archivo: ${fileName}`);
    console.log(`Tamaño: ${buffer.length} bytes`);
    console.log(`Ubicación: ${filePath}`);
    
    // Guardar copia con nombre descriptivo
    const newFileName = `${factura.rucEmisor}-${factura.serie}-${factura.numero}.${fileName.endsWith('.zip') ? 'zip' : 'xml'}`;
    const newFilePath = path.join(process.cwd(), newFileName);
    await fs.writeFile(newFilePath, buffer);
    console.log(`\nCopia guardada: ${newFileName}`);
    
    // Esperar un poco antes de cerrar si no es headless
    if (!CONFIG.headless) {
      console.log('\nEsperando 5 segundos antes de cerrar...');
      await new Promise(r => setTimeout(r, 5000));
    }
    
    return {
      success: true,
      fileName: newFileName,
      size: buffer.length,
      path: newFilePath,
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
const FACTURA_PRUEBA = {
  rucEmisor: '20508565934', // Tottus
  tipoComprobante: '01', // Factura
  serie: 'FJ88',
  numero: '30587',
};

descargarXMLDeSUNAT(FACTURA_PRUEBA).then(result => {
  if (result.success) {
    console.log('\n✅ Proceso completado exitosamente');
    console.log(`Archivo: ${result.fileName}`);
  } else {
    console.log('\n❌ Proceso falló');
    console.log(`Error: ${result.error}`);
  }
  process.exit(result.success ? 0 : 1);
});
