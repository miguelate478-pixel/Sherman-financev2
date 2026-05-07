// Test del provider con los data-ids correctos
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

async function testProviderConDataIds() {
  console.log('=== Test Provider con Data-IDs Correctos ===\n');
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
    console.log('[1/10] Login...');
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
      throw new Error('Login falló');
    }
    console.log('✅ Login exitoso\n');
    
    // 2. Empresas
    console.log('[2/10] Seleccionando Empresas...');
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
      throw new Error('No se encontró Empresas');
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Empresas seleccionado\n');
    
    // 3-6: Los 4 clicks con data-ids
    console.log('[3/10] Click 1: Comprobantes de pago (data-id="11")...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id="11"] span.spanNivelDescripcion');
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
    
    console.log('[4/10] Click 2: Comprobantes de Pago (data-id="11.38")...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id="11.38"] span.spanNivelDescripcion');
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
    
    console.log('[5/10] Click 3: Consulta de Comprobantes de Pago (data-id="11.38.1")...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id="11.38.1"] span.spanNivelDescripcion');
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
    
    console.log('[6/10] Click 4: Nueva Consulta de comprobantes de pago (data-id="11.38.1.1")...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id="11.38.1.1"] span.spanNivelDescripcion');
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
    
    // 7. Buscar formulario en frames
    console.log('[7/10] Buscando formulario en frames...');
    
    const frames = page.frames();
    console.log(`Total frames: ${frames.length}`);
    
    let targetFrame = page.mainFrame();
    
    for (const frame of frames) {
      const url = frame.url();
      console.log(`  Frame: ${url.substring(0, 80)}`);
      
      if (url.includes('ConsultaComprobante') || url.includes('comprobante') || url.includes('e-factura')) {
        console.log(`  ✅ Frame del formulario: ${url}`);
        targetFrame = frame;
        break;
      }
    }
    
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
            console.log(`  ✅ Formulario encontrado en frame: ${frame.url()}`);
            targetFrame = frame;
            break;
          }
        } catch (error) {
          // Frame no accesible
        }
      }
    }
    
    console.log(`✅ Usando frame: ${targetFrame.url()}\n`);
    
    await page.screenshot({ path: 'test-data-ids-1-form.png', fullPage: true });
    
    // 8. Seleccionar "Recibido"
    console.log('[8/10] Seleccionando filtro "Recibido"...');
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
    
    // 9. Llenar formulario
    console.log('[9/10] Llenando formulario...');
    
    const formFilled = await targetFrame.evaluate((data) => {
      const rucInput = document.querySelector('input[name="rucEmisor"]') ||
                      document.querySelector('input[formcontrolname="rucEmisor"]') ||
                      document.querySelector('#rucEmisor');
      
      if (!rucInput) return { success: false, field: 'rucEmisor' };
      rucInput.value = data.rucEmisor;
      rucInput.dispatchEvent(new Event('input', { bubbles: true }));
      rucInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      const tipoSelect = document.querySelector('select[name="tipoComprobante"]') ||
                        document.querySelector('select[formcontrolname="tipoComprobante"]') ||
                        document.querySelector('#tipoComprobante');
      
      if (tipoSelect) {
        tipoSelect.value = data.tipoComprobante;
        tipoSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      const serieInput = document.querySelector('input[name="serieComprobante"]') ||
                        document.querySelector('input[formcontrolname="serieComprobante"]') ||
                        document.querySelector('#serieComprobante');
      
      if (!serieInput) return { success: false, field: 'serieComprobante' };
      serieInput.value = data.serie;
      serieInput.dispatchEvent(new Event('input', { bubbles: true }));
      serieInput.dispatchEvent(new Event('change', { bubbles: true }));
      
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
    
    await page.screenshot({ path: 'test-data-ids-2-filled.png', fullPage: true });
    
    // 10. Consultar
    console.log('[10/10] Consultando...');
    
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
    await page.screenshot({ path: 'test-data-ids-3-results.png', fullPage: true });
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
      console.log('⚠️  Comprobante no encontrado en SUNAT\n');
    } else {
      console.log('✅ Comprobante encontrado\n');
    }
    
    console.log('\n========================================');
    console.log('✅ TEST COMPLETADO CON DATA-IDS');
    console.log('========================================');
    console.log('\nScreenshots generados:');
    console.log('  - test-data-ids-1-form.png');
    console.log('  - test-data-ids-2-filled.png');
    console.log('  - test-data-ids-3-results.png');
    
    console.log('\nEsperando 20 segundos...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testProviderConDataIds();
