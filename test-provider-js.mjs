// Test del provider - versión JavaScript pura
import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';

const testInvoice = {
  ruc: '20610169849',
  solUser: 'SHERMAN1',
  solPass: 'Pepe2024',
  rucEmisor: '20508565934', // Tottus
  tipoComprobante: '01',
  serie: 'FJ88',
  numero: '30587',
};

async function testProviderLogic() {
  console.log('=== Test Provider Logic ===\n');
  console.log(`Buscando: ${testInvoice.serie}-${testInvoice.numero}`);
  console.log(`RUC Emisor: ${testInvoice.rucEmisor}\n`);

  let browser;
  const downloadPath = path.join(process.cwd(), 'temp-downloads');
  
  try {
    await fs.mkdir(downloadPath, { recursive: true });
    
    const chromiumPath = process.env.CHROMIUM_PATH || 
                        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: false,
      args: ['--no-sandbox', '--start-maximized'],
      defaultViewport: null,
    });
    
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // 1. Login
    console.log('[1/8] Login...');
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    await page.type('#txtRuc', testInvoice.ruc, { delay: 100 });
    await page.type('#txtUsuario', testInvoice.solUser, { delay: 100 });
    await page.type('#txtContrasena', testInvoice.solPass, { delay: 100 });
    await page.click('#btnAceptar');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const menuLoaded = await page.$('#divContainerMenu');
    if (!menuLoaded) {
      throw new Error('Login falló - no se cargó el menú');
    }
    console.log('✅ Login exitoso\n');
    
    // 2. Empresas
    console.log('[2/8] Seleccionando Empresas...');
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
    
    if (empresasClicked) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('✅ Empresas seleccionado\n');
    } else {
      console.log('⚠️  Empresas no encontrado, continuando...\n');
    }
    
    // 3. Consulta de Facturas
    console.log('[3/8] Click en Consulta de Facturas...');
    const consultaClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, div, span, li'));
      const consultaEl = elements.find(el => {
        const text = el.textContent?.trim();
        return text?.includes('Consulta de Facturas') && text?.includes('Electrónicas');
      });
      
      if (consultaEl) {
        consultaEl.click();
        return true;
      }
      return false;
    });
    
    if (!consultaClicked) {
      throw new Error('No se pudo hacer clic en "Consulta de Facturas"');
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ En página de consulta\n');
    
    // 4. Seleccionar "Recibido"
    console.log('[4/8] Seleccionando filtro "Recibido"...');
    await page.evaluate(() => {
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
    
    // 5. Llenar formulario
    console.log('[5/8] Llenando formulario...');
    
    const formFilled = await page.evaluate((data) => {
      // RUC Emisor - múltiples selectores
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
    }, testInvoice);
    
    if (!formFilled.success) {
      throw new Error(`No se pudo llenar el campo: ${formFilled.field}`);
    }
    
    console.log(`  ✅ RUC Emisor: ${testInvoice.rucEmisor}`);
    console.log(`  ✅ Tipo: ${testInvoice.tipoComprobante}`);
    console.log(`  ✅ Serie: ${testInvoice.serie}`);
    console.log(`  ✅ Número: ${testInvoice.numero}\n`);
    
    await page.screenshot({ path: 'test-1-filled.png', fullPage: true });
    
    // 6. Consultar
    console.log('[6/8] Consultando...');
    
    const consultarClicked2 = await page.evaluate(() => {
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
    
    if (!consultarClicked2) {
      throw new Error('No se pudo hacer clic en "Consultar"');
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    await page.screenshot({ path: 'test-2-results.png', fullPage: true });
    console.log('✅ Consulta realizada\n');
    
    // 7. Verificar resultados
    console.log('[7/8] Verificando resultados...');
    
    const hasResults = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const noResults = bodyText.toLowerCase().includes('no se encontraron') ||
                       bodyText.toLowerCase().includes('sin resultados') ||
                       bodyText.toLowerCase().includes('no existen');
      
      return !noResults;
    });
    
    if (!hasResults) {
      console.log('⚠️  Comprobante no encontrado en SUNAT\n');
      throw new Error('Comprobante no encontrado en SUNAT');
    }
    
    console.log('✅ Comprobante encontrado\n');
    
    // 8. Configurar y descargar XML
    console.log('[8/8] Descargando XML...');
    
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath,
    });
    
    const downloadClicked = await page.evaluate(() => {
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
    
    console.log('  ✅ Click en botón de descarga\n');
    console.log('Esperando descarga...');
    
    // Esperar descarga
    let downloaded = false;
    let attempts = 0;
    let fileName = '';
    const maxAttempts = 30;
    
    while (!downloaded && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const files = await fs.readdir(downloadPath);
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
    const filePath = path.join(downloadPath, fileName);
    const buffer = await fs.readFile(filePath);
    
    console.log(`Tamaño: ${buffer.length} bytes`);
    
    // Guardar copia
    await fs.writeFile(`downloaded-${fileName}`, buffer);
    
    console.log('\n========================================');
    console.log('✅ DESCARGA COMPLETA Y EXITOSA');
    console.log('========================================');
    console.log(`\nArchivo guardado como: downloaded-${fileName}`);
    console.log('\nScreenshots:');
    console.log('  - test-1-filled.png');
    console.log('  - test-2-results.png');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testProviderLogic();
