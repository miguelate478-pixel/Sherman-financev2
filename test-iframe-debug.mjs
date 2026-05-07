// Debug para ver qué hay en los iframes
import puppeteer from 'puppeteer-core';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

async function debugIframes() {
  console.log('=== Debug Iframes ===\n');

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
    console.log('[2] Empresas...');
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, div, span, li'));
      const empresasEl = elements.find(el => el.textContent?.trim().toLowerCase() === 'empresas');
      if (empresasEl) empresasEl.click();
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Empresas\n');
    
    // Consulta
    console.log('[3] Click en Consulta...');
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, div, span, li'));
      const consultaEl = elements.find(el => {
        const text = el.textContent?.trim();
        return text?.includes('Consulta de Facturas') && text?.includes('Electrónicas');
      });
      if (consultaEl) consultaEl.click();
    });
    
    console.log('✅ Click realizado\n');
    
    // Esperar diferentes tiempos y revisar frames
    for (let waitTime of [3000, 5000, 8000, 10000]) {
      console.log(`\n=== Esperando ${waitTime}ms ===`);
      await new Promise(resolve => setTimeout(resolve, waitTime - (waitTime === 3000 ? 0 : 2000)));
      
      const frames = page.frames();
      console.log(`Total frames: ${frames.length}\n`);
      
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const url = frame.url();
        console.log(`Frame ${i}: ${url.substring(0, 80)}`);
        
        try {
          const frameInfo = await frame.evaluate(() => {
            const forms = document.querySelectorAll('form');
            const inputs = document.querySelectorAll('input');
            const selects = document.querySelectorAll('select');
            
            const rucInput = document.querySelector('input[name="rucEmisor"]');
            const serieInput = document.querySelector('input[name="serieComprobante"]');
            
            // Buscar también por otros atributos
            const allInputNames = Array.from(inputs).map(i => i.name || i.id).filter(Boolean);
            
            return {
              forms: forms.length,
              inputs: inputs.length,
              selects: selects.length,
              hasRucInput: !!rucInput,
              hasSerieInput: !!serieInput,
              inputNames: allInputNames.slice(0, 10),
            };
          });
          
          console.log(`  Forms: ${frameInfo.forms}, Inputs: ${frameInfo.inputs}, Selects: ${frameInfo.selects}`);
          console.log(`  RUC: ${frameInfo.hasRucInput}, Serie: ${frameInfo.hasSerieInput}`);
          
          if (frameInfo.inputNames.length > 0) {
            console.log(`  Input names: ${frameInfo.inputNames.join(', ')}`);
          }
          
          if (frameInfo.hasRucInput && frameInfo.hasSerieInput) {
            console.log(`\n✅✅✅ FORMULARIO ENCONTRADO EN FRAME ${i} ✅✅✅`);
            console.log(`Tiempo de espera necesario: ${waitTime}ms`);
            
            await page.screenshot({ path: `iframe-found-${waitTime}ms.png`, fullPage: true });
            console.log(`Screenshot: iframe-found-${waitTime}ms.png`);
            
            console.log('\nEsperando 30 segundos para inspección...');
            await new Promise(resolve => setTimeout(resolve, 30000));
            
            if (browser) await browser.close();
            return;
          }
        } catch (error) {
          console.log(`  Error al leer frame ${i}`);
        }
        console.log('');
      }
    }
    
    console.log('\n❌ Formulario no encontrado después de 10 segundos');
    console.log('Esperando 30 segundos para inspección manual...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

debugIframes();
