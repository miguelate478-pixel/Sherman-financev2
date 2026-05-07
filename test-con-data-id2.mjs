// Test con data-id2 (correcto para menú de Empresas)
import puppeteer from 'puppeteer-core';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

async function testConDataId2() {
  console.log('=== Test con data-id2 (Empresas) ===\n');

  let browser;
  
  try {
    const chromiumPath = process.env.CHROMIUM_PATH || 
                        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: false,
      args: ['--no-sandbox', '--start-maximized'],
      defaultViewport: null,
    });
    
    const page = await browser.newPage();
    
    // Login
    console.log('[1] Login...');
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
    console.log('✅ Login\n');
    
    // Empresas
    console.log('[2] Click en Empresas...');
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, div, span, li'));
      const empresasEl = elements.find(el => el.textContent?.trim().toLowerCase() === 'empresas');
      if (empresasEl) empresasEl.click();
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Empresas\n');
    
    await page.screenshot({ path: 'test-id2-1-empresas.png', fullPage: true });
    
    // Verificar qué data-id existe
    console.log('[3] Verificando data-ids disponibles...');
    const dataIds = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('[data-id], [data-id2]'));
      return elements.slice(0, 20).map(el => ({
        dataId: el.getAttribute('data-id'),
        dataId2: el.getAttribute('data-id2'),
        text: el.textContent?.trim().substring(0, 50),
      }));
    });
    
    console.log('Data-ids encontrados:');
    dataIds.forEach((item, i) => {
      console.log(`  ${i + 1}. data-id="${item.dataId}" data-id2="${item.dataId2}" - ${item.text}`);
    });
    console.log('');
    
    // Click 1 con data-id2
    console.log('[4] Click 1: Comprobantes de pago (data-id2="11")...');
    const click1 = await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11"] span.spanNivelDescripcion');
      if (el) {
        el.click();
        return { success: true, method: 'data-id2' };
      }
      
      // Fallback
      const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
      const target = spans.find(s => s.textContent?.trim() === 'Comprobantes de pago');
      if (target) {
        target.click();
        return { success: true, method: 'fallback' };
      }
      
      return { success: false };
    });
    
    if (!click1.success) {
      throw new Error('Click 1 falló');
    }
    console.log(`✅ Click 1 (método: ${click1.method})\n`);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    await page.screenshot({ path: 'test-id2-2-click1.png', fullPage: true });
    
    // Click 2
    console.log('[5] Click 2: Comprobantes de Pago (data-id2="11.38")...');
    const click2 = await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11.38"] span.spanNivelDescripcion');
      if (el) {
        el.click();
        return { success: true, method: 'data-id2' };
      }
      
      const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
      const matches = spans.filter(s => {
        const text = s.textContent?.trim().toLowerCase();
        return text?.includes('comprobantes de pago');
      });
      if (matches.length > 1) {
        matches[1].click();
        return { success: true, method: 'fallback-second' };
      } else if (matches[0]) {
        matches[0].click();
        return { success: true, method: 'fallback-first' };
      }
      
      return { success: false };
    });
    
    if (!click2.success) {
      throw new Error('Click 2 falló');
    }
    console.log(`✅ Click 2 (método: ${click2.method})\n`);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    await page.screenshot({ path: 'test-id2-3-click2.png', fullPage: true });
    
    // Click 3
    console.log('[6] Click 3: Consulta de Comprobantes de Pago (data-id2="11.38.1")...');
    const click3 = await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11.38.1"] span.spanNivelDescripcion');
      if (el) {
        el.click();
        return { success: true, method: 'data-id2' };
      }
      
      const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
      const target = spans.find(s => s.textContent?.trim() === 'Consulta de Comprobantes de Pago');
      if (target) {
        target.click();
        return { success: true, method: 'fallback' };
      }
      
      return { success: false };
    });
    
    if (!click3.success) {
      throw new Error('Click 3 falló');
    }
    console.log(`✅ Click 3 (método: ${click3.method})\n`);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    await page.screenshot({ path: 'test-id2-4-click3.png', fullPage: true });
    
    // Click 4
    console.log('[7] Click 4: Nueva Consulta (data-id2="11.38.1.1")...');
    const click4 = await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11.38.1.1"] span.spanNivelDescripcion');
      if (el) {
        el.click();
        return { success: true, method: 'data-id2' };
      }
      
      const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
      const target = spans.find(s => s.textContent?.trim() === 'Nueva Consulta de comprobantes de pago');
      if (target) {
        target.click();
        return { success: true, method: 'fallback' };
      }
      
      return { success: false };
    });
    
    if (!click4.success) {
      throw new Error('Click 4 falló');
    }
    console.log(`✅ Click 4 (método: ${click4.method})\n`);
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.screenshot({ path: 'test-id2-5-final.png', fullPage: true });
    
    // Verificar frames
    console.log('[8] Verificando frames...');
    const frames = page.frames();
    console.log(`Total frames: ${frames.length}`);
    frames.forEach((f, i) => {
      console.log(`  Frame ${i}: ${f.url().substring(0, 80)}`);
    });
    
    console.log('\n========================================');
    console.log('✅ TEST COMPLETADO');
    console.log('========================================');
    console.log('\nScreenshots:');
    console.log('  - test-id2-1-empresas.png');
    console.log('  - test-id2-2-click1.png');
    console.log('  - test-id2-3-click2.png');
    console.log('  - test-id2-4-click3.png');
    console.log('  - test-id2-5-final.png');
    
    console.log('\nEsperando 30 segundos...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) await browser.close();
  }
}

testConDataId2();
