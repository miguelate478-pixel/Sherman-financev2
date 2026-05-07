// Test siguiendo EXACTAMENTE el flujo de las imágenes correct-*
import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

const testInvoice = {
  rucEmisor: '20508565934',
  tipoComprobante: '01',
  serie: 'FJ88',
  numero: '30587',
};

async function testExactFlow() {
  console.log('=== Test Flujo Exacto ===\n');

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
    console.log('[1] Login en SUNAT...');
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
    await page.screenshot({ path: 'exact-1-after-login.png', fullPage: true });
    console.log('✅ Login - Screenshot: exact-1-after-login.png\n');
    
    // PASO 2: Click en EMPRESAS (debe expandir el menú)
    console.log('[2] Click en EMPRESAS...');
    
    // Buscar y hacer click en el elemento EMPRESAS
    const empresasResult = await page.evaluate(() => {
      // Buscar todos los elementos que contengan "Empresas"
      const allElements = Array.from(document.querySelectorAll('*'));
      const empresasElements = allElements.filter(el => {
        const text = el.textContent?.trim();
        return text === 'Empresas' || text === 'EMPRESAS';
      });
      
      console.log('Elementos con "Empresas" encontrados:', empresasElements.length);
      
      // Intentar con el primero que sea clickeable
      for (const el of empresasElements) {
        const tag = el.tagName.toLowerCase();
        const isClickable = tag === 'a' || tag === 'button' || tag === 'div' || tag === 'li';
        
        if (isClickable) {
          console.log('Haciendo click en:', tag, el.className, el.id);
          el.click();
          return {
            success: true,
            tag: tag,
            class: el.className,
            id: el.id,
          };
        }
      }
      
      return { success: false };
    });
    
    console.log('Resultado click Empresas:', empresasResult);
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.screenshot({ path: 'exact-2-after-empresas.png', fullPage: true });
    console.log('✅ Empresas - Screenshot: exact-2-after-empresas.png\n');
    
    // PASO 3: Buscar el menú expandido de Comprobantes Electrónicos
    console.log('[3] Buscando menú de Comprobantes Electrónicos...');
    
    const menuOptions = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, div, span, li'));
      return allElements
        .filter(el => {
          const text = el.textContent?.trim();
          return text && text.length > 5 && text.length < 150;
        })
        .map(el => ({
          text: el.textContent?.trim(),
          tag: el.tagName,
          visible: el.offsetParent !== null,
        }))
        .filter(el => el.visible);
    });
    
    console.log('Opciones de menú visibles:');
    menuOptions.slice(0, 30).forEach((opt, i) => {
      const relevant = opt.text.toLowerCase().includes('comprobante') ||
                      opt.text.toLowerCase().includes('factura') ||
                      opt.text.toLowerCase().includes('consulta') ||
                      opt.text.toLowerCase().includes('electrónic');
      const marker = relevant ? '✅' : '  ';
      console.log(`${marker} ${i + 1}. [${opt.tag}] ${opt.text}`);
    });
    console.log('');
    
    // PASO 4: Click en "Comprobantes Electrónicos" para expandir
    console.log('[4] Click en Comprobantes Electrónicos...');
    
    const comprobantesClicked = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, div, span, li'));
      const comprobantesEl = allElements.find(el => {
        const text = el.textContent?.trim();
        return text?.includes('Comprobantes') && text?.includes('Electrónicos');
      });
      
      if (comprobantesEl) {
        comprobantesEl.click();
        return {
          success: true,
          text: comprobantesEl.textContent?.trim(),
        };
      }
      return { success: false };
    });
    
    console.log('Click en Comprobantes:', comprobantesClicked);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: 'exact-3-after-comprobantes.png', fullPage: true });
    console.log('✅ Comprobantes - Screenshot: exact-3-after-comprobantes.png\n');
    
    // PASO 5: Click en "Consulta de Facturas y Notas Electrónicas"
    console.log('[5] Click en Consulta de Facturas...');
    
    const consultaClicked = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, div, span, li'));
      const consultaEl = allElements.find(el => {
        const text = el.textContent?.trim();
        return text?.includes('Consulta de Facturas') && text?.includes('Electrónicas');
      });
      
      if (consultaEl) {
        consultaEl.click();
        return {
          success: true,
          text: consultaEl.textContent?.trim(),
        };
      }
      return { success: false };
    });
    
    console.log('Click en Consulta:', consultaClicked);
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    await page.screenshot({ path: 'exact-4-consulta-page.png', fullPage: true });
    console.log('✅ Consulta - Screenshot: exact-4-consulta-page.png\n');
    
    // PASO 6: Verificar si el formulario está visible
    console.log('[6] Verificando formulario...');
    
    const formInfo = await page.evaluate(() => {
      const rucInput = document.querySelector('input[name="rucEmisor"]') ||
                      document.querySelector('input[formcontrolname="rucEmisor"]') ||
                      document.querySelector('#rucEmisor');
      
      const serieInput = document.querySelector('input[name="serieComprobante"]') ||
                        document.querySelector('input[formcontrolname="serieComprobante"]') ||
                        document.querySelector('#serieComprobante');
      
      const allInputs = Array.from(document.querySelectorAll('input'));
      const inputNames = allInputs.map(i => ({
        name: i.name,
        id: i.id,
        type: i.type,
        placeholder: i.placeholder,
      })).filter(i => i.name || i.id);
      
      return {
        hasRucInput: !!rucInput,
        hasSerieInput: !!serieInput,
        totalInputs: allInputs.length,
        inputNames: inputNames.slice(0, 20),
      };
    });
    
    console.log('Formulario:');
    console.log('  RUC Input:', formInfo.hasRucInput);
    console.log('  Serie Input:', formInfo.hasSerieInput);
    console.log('  Total Inputs:', formInfo.totalInputs);
    console.log('\nInputs encontrados:');
    formInfo.inputNames.forEach((inp, i) => {
      console.log(`  ${i + 1}. name="${inp.name}" id="${inp.id}" type="${inp.type}" placeholder="${inp.placeholder}"`);
    });
    
    if (!formInfo.hasRucInput) {
      console.log('\n⚠️  FORMULARIO NO ENCONTRADO - Esperando 30 segundos para inspección manual...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      throw new Error('Formulario no encontrado');
    }
    
    console.log('\n✅ Formulario encontrado');
    
    console.log('\n========================================');
    console.log('Revisa los screenshots:');
    console.log('  - exact-1-after-login.png');
    console.log('  - exact-2-after-empresas.png');
    console.log('  - exact-3-after-comprobantes.png');
    console.log('  - exact-4-consulta-page.png');
    console.log('========================================');
    
    console.log('\nEsperando 20 segundos...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testExactFlow();
