// Test del provider actualizado con manejo de iframes
import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

// Factura de prueba - usar una real de tu base de datos
const testInvoice = {
  rucEmisor: '20508565934', // Tottus
  tipoComprobante: '01',
  serie: 'FJ88',
  numero: '30587',
};

async function testProviderWithIframe() {
  console.log('=== Test Provider con Iframe ===\n');
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
    console.log('[1/7] Login...');
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    await page.waitForSelector('#txtRuc');
    await page.type('#txtRuc', ruc, { delay: 100 });
    await page.type('#txtUsuario', solUser, { delay: 100 });
    await page.type('#txtContrasena', solPass, { delay: 100 });
    await page.click('#btnAceptar');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const menuLoaded = await page.$('#divContainerMenu');
    if (!menuLoaded) {
      throw new Error('Login falló');
    }
    console.log('✅ Login exitoso\n');
    
    // 2. Empresas
    console.log('[2/7] Seleccionando Empresas...');
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
    console.log('[3/7] Click en Consulta de Facturas...');
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
    
    // 4. BUSCAR FORMULARIO EN IFRAMES
    console.log('[4/7] Buscando formulario en iframes...');
    
    const frames = page.frames();
    console.log(`Total frames: ${frames.length}`);
    
    let formFrame = null;
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      
      try {
        const hasForm = await frame.evaluate(() => {
          const rucInput = document.querySelector('input[name="rucEmisor"]');
          const serieInput = document.querySelector('input[name="serieComprobante"]');
          return !!(rucInput && serieInput);
        });
        
        if (hasForm) {
          console.log(`✅ Formulario encontrado en frame ${i}\n`);
          formFrame = frame;
          break;
        }
      } catch (error) {
        // Frame no accesible
      }
    }
    
    if (!formFrame) {
      throw new Error('Formulario no encontrado en ningún frame');
    }
    
    // 5. Seleccionar "Recibido"
    console.log('[5/7] Seleccionando filtro "Recibido"...');
    await formFrame.evaluate(() => {
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
    
    // 6. Llenar formulario
    console.log('[6/7] Llenando formulario...');
    
    const formFilled = await formFrame.evaluate((data) => {
      // RUC Emisor
      const rucInput = document.querySelector('input[name="rucEmisor"]');
      if (!rucInput) return { success: false, field: 'rucEmisor' };
      rucInput.value = data.rucEmisor;
      rucInput.dispatchEvent(new Event('input', { bubbles: true }));
      rucInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Tipo de comprobante
      const tipoSelect = document.querySelector('select[name="tipoComprobante"]');
      if (tipoSelect) {
        tipoSelect.value = data.tipoComprobante;
        tipoSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Serie
      const serieInput = document.querySelector('input[name="serieComprobante"]');
      if (!serieInput) return { success: false, field: 'serieComprobante' };
      serieInput.value = data.serie;
      serieInput.dispatchEvent(new Event('input', { bubbles: true }));
      serieInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Número
      const numeroInput = document.querySelector('input[name="numeroComprobante"]');
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
    
    await page.screenshot({ path: 'provider-1-filled.png', fullPage: true });
    
    // 7. Consultar
    console.log('[7/7] Consultando...');
    
    const consultarClicked2 = await formFrame.evaluate(() => {
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
    await page.screenshot({ path: 'provider-2-results.png', fullPage: true });
    
    // Verificar resultados
    const hasResults = await formFrame.evaluate(() => {
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
      
      // Buscar botón de descarga
      const downloadButtons = await formFrame.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
        return allButtons
          .filter(btn => {
            const text = (btn.textContent || btn.value || '').toLowerCase();
            const title = (btn.title || '').toLowerCase();
            return text.includes('xml') || text.includes('descargar') || 
                   title.includes('xml') || title.includes('descargar');
          })
          .map(btn => ({
            text: btn.textContent?.trim() || btn.value,
            title: btn.title,
          }));
      });
      
      if (downloadButtons.length > 0) {
        console.log('Botones de descarga encontrados:');
        downloadButtons.forEach((btn, i) => {
          console.log(`  ${i + 1}. "${btn.text}"`);
        });
      } else {
        console.log('⚠️  No se encontraron botones de descarga XML');
      }
    }
    
    console.log('\n========================================');
    console.log('✅ TEST COMPLETADO CON IFRAME');
    console.log('========================================');
    console.log('\nScreenshots generados:');
    console.log('  - provider-1-filled.png');
    console.log('  - provider-2-results.png');
    
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

testProviderWithIframe();
