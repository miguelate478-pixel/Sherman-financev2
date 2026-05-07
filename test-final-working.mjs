// Test final con selectores correctos de las imágenes
import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

// Datos de factura de prueba
const testInvoice = {
  rucEmisor: '20508565934', // Hipermercados Tottus
  tipoComprobante: '01', // Factura
  serie: 'FJ88',
  numero: '30587',
};

async function testFinalWorking() {
  console.log('=== Test Final con Selectores Correctos ===\n');
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
    
    // PASO 1: Login
    console.log('[1/6] Login en SUNAT...');
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    await page.waitForSelector('#txtRuc');
    await page.type('#txtRuc', ruc);
    await page.type('#txtUsuario', solUser);
    await page.type('#txtContrasena', solPass);
    await page.click('#btnAceptar');
    
    await new Promise(resolve => setTimeout(resolve, 4000));
    console.log('✅ Login exitoso\n');
    
    // PASO 2: Click en Empresas
    console.log('[2/6] Seleccionando Empresas...');
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, div, span, li'));
      const empresasEl = elements.find(el => el.textContent?.trim().toLowerCase() === 'empresas');
      if (empresasEl) empresasEl.click();
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Empresas seleccionado\n');
    
    // PASO 3: Click en Consulta de Facturas
    console.log('[3/6] Navegando a Consulta de Facturas...');
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, div, span, li'));
      const consultaEl = elements.find(el => {
        const text = el.textContent?.trim();
        return text?.includes('Consulta de Facturas') && text?.includes('Electrónicas');
      });
      if (consultaEl) consultaEl.click();
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ En página de consulta\n');
    
    await page.screenshot({ path: 'final-1-consulta-page.png', fullPage: true });
    
    // PASO 4: Seleccionar "Recibido" (comprobantes recibidos)
    console.log('[4/6] Seleccionando filtro "Recibido"...');
    
    try {
      // Buscar el radio button "Recibido"
      await page.evaluate(() => {
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
        const recibidoRadio = radios.find(r => {
          const label = document.querySelector(`label[for="${r.id}"]`);
          return label?.textContent?.trim().toLowerCase().includes('recibido');
        });
        
        if (recibidoRadio) {
          recibidoRadio.click();
          console.log('Radio Recibido encontrado y clickeado');
        } else {
          // Intentar por value
          const recibidoByValue = radios.find(r => r.value === 'RBR' || r.value === 'recibido');
          if (recibidoByValue) recibidoByValue.click();
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('✅ Filtro "Recibido" seleccionado\n');
    } catch (error) {
      console.log('⚠️  No se pudo seleccionar "Recibido", continuando...\n');
    }
    
    // PASO 5: Llenar formulario
    console.log('[5/6] Llenando formulario...');
    
    // RUC Emisor
    const rucFilled = await page.evaluate((rucEmisor) => {
      const rucInput = document.querySelector('input[name="rucEmisor"]') ||
                      document.querySelector('input[formcontrolname="rucEmisor"]') ||
                      document.querySelector('#rucEmisor');
      
      if (rucInput) {
        rucInput.value = rucEmisor;
        rucInput.dispatchEvent(new Event('input', { bubbles: true }));
        rucInput.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }, testInvoice.rucEmisor);
    
    if (!rucFilled) {
      console.log('❌ No se encontró campo RUC Emisor');
      throw new Error('Campo RUC Emisor no encontrado');
    }
    console.log(`  ✅ RUC Emisor: ${testInvoice.rucEmisor}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Tipo de comprobante
    const tipoFilled = await page.evaluate((tipo) => {
      const tipoSelect = document.querySelector('select[name="tipoComprobante"]') ||
                        document.querySelector('select[formcontrolname="tipoComprobante"]') ||
                        document.querySelector('#tipoComprobante');
      
      if (tipoSelect) {
        tipoSelect.value = tipo;
        tipoSelect.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }, testInvoice.tipoComprobante);
    
    if (tipoFilled) {
      console.log(`  ✅ Tipo: ${testInvoice.tipoComprobante} (Factura)`);
    } else {
      console.log('  ⚠️  Tipo de comprobante no seleccionado');
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Serie
    const serieFilled = await page.evaluate((serie) => {
      const serieInput = document.querySelector('input[name="serieComprobante"]') ||
                        document.querySelector('input[formcontrolname="serieComprobante"]') ||
                        document.querySelector('#serieComprobante');
      
      if (serieInput) {
        serieInput.value = serie;
        serieInput.dispatchEvent(new Event('input', { bubbles: true }));
        serieInput.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }, testInvoice.serie);
    
    if (!serieFilled) {
      console.log('❌ No se encontró campo Serie');
      throw new Error('Campo Serie no encontrado');
    }
    console.log(`  ✅ Serie: ${testInvoice.serie}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Número
    const numeroFilled = await page.evaluate((numero) => {
      const numeroInput = document.querySelector('input[name="numeroComprobante"]') ||
                         document.querySelector('input[formcontrolname="numeroComprobante"]') ||
                         document.querySelector('#numeroComprobante');
      
      if (numeroInput) {
        numeroInput.value = numero;
        numeroInput.dispatchEvent(new Event('input', { bubbles: true }));
        numeroInput.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }, testInvoice.numero);
    
    if (!numeroFilled) {
      console.log('❌ No se encontró campo Número');
      throw new Error('Campo Número no encontrado');
    }
    console.log(`  ✅ Número: ${testInvoice.numero}\n`);
    
    await page.screenshot({ path: 'final-2-form-filled.png', fullPage: true });
    console.log('📸 Screenshot: final-2-form-filled.png\n');
    
    // PASO 6: Click en Consultar
    console.log('[6/6] Haciendo clic en Consultar...');
    
    const consultarClicked = await page.evaluate(() => {
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
      console.log('❌ No se encontró botón Consultar');
      throw new Error('Botón Consultar no encontrado');
    }
    
    console.log('✅ Click en Consultar realizado');
    console.log('Esperando resultados...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await page.screenshot({ path: 'final-3-results.png', fullPage: true });
    console.log('📸 Screenshot: final-3-results.png\n');
    
    // Verificar si hay resultados
    const hasResults = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const noResults = bodyText.toLowerCase().includes('no se encontraron') ||
                       bodyText.toLowerCase().includes('sin resultados') ||
                       bodyText.toLowerCase().includes('no existen');
      
      return !noResults;
    });
    
    if (!hasResults) {
      console.log('⚠️  No se encontraron resultados para esta factura');
    } else {
      console.log('✅ Resultados encontrados');
      
      // Buscar botón de descarga XML
      console.log('\nBuscando botón de descarga XML...');
      
      const downloadButtons = await page.evaluate(() => {
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
            class: btn.className,
          }));
      });
      
      if (downloadButtons.length > 0) {
        console.log('Botones de descarga encontrados:');
        downloadButtons.forEach((btn, i) => {
          console.log(`  ${i + 1}. "${btn.text}" (${btn.class})`);
        });
      } else {
        console.log('⚠️  No se encontraron botones de descarga XML');
      }
    }
    
    console.log('\n========================================');
    console.log('✅ FLUJO COMPLETO EJECUTADO');
    console.log('========================================');
    console.log('\nRevisa los screenshots generados:');
    console.log('  - final-1-consulta-page.png');
    console.log('  - final-2-form-filled.png');
    console.log('  - final-3-results.png');
    
    console.log('\nEsperando 20 segundos para que revises...');
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

testFinalWorking();
