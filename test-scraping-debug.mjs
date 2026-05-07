// Test debug para ver qué carga SUNAT
import puppeteer from 'puppeteer-core';

async function debugSunat() {
  console.log('=== Debug de Portal SUNAT ===\n');

  let browser;
  
  try {
    console.log('Iniciando navegador...');
    
    const chromiumPath = process.env.CHROMIUM_PATH || 
                        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('Navegando a SUNAT...');
    
    await page.goto('https://e-factura.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    console.log('✅ Página cargada\n');
    
    // Esperar 2 segundos
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Ver qué elementos hay en la página
    console.log('Buscando elementos de formulario...\n');
    
    const inputs = await page.$$eval('input', elements => 
      elements.map(el => ({
        type: el.type,
        id: el.id,
        name: el.name,
        placeholder: el.placeholder,
      }))
    );
    
    console.log('Inputs encontrados:');
    console.log(JSON.stringify(inputs, null, 2));
    
    const buttons = await page.$$eval('button, input[type="submit"], input[type="button"]', elements => 
      elements.map(el => ({
        tag: el.tagName,
        type: el.type,
        id: el.id,
        value: el.value,
        text: el.textContent?.trim(),
      }))
    );
    
    console.log('\nBotones encontrados:');
    console.log(JSON.stringify(buttons, null, 2));
    
    // Tomar screenshot
    await page.screenshot({ path: 'sunat-login.png', fullPage: true });
    console.log('\n✅ Screenshot guardado: sunat-login.png');
    
    console.log('\nEsperando 10 segundos para que veas la página...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

debugSunat();
