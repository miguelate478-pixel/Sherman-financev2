// Test para detectar frames en SUNAT
import puppeteer from 'puppeteer-core';

async function testFrames() {
  console.log('=== Test de Frames en SUNAT ===\n');

  let browser;
  
  try {
    const chromiumPath = process.env.CHROMIUM_PATH || 
                        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: false,
      args: ['--no-sandbox'],
    });
    
    const page = await browser.newPage();
    
    console.log('Navegando a SUNAT...');
    
    await page.goto('https://e-factura.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    console.log('✅ Página cargada\n');
    
    // Esperar a que cargue
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Ver si hay frames
    const frames = page.frames();
    console.log(`Frames encontrados: ${frames.length}\n`);
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      console.log(`Frame ${i}:`);
      console.log(`  URL: ${frame.url()}`);
      console.log(`  Name: ${frame.name()}`);
      
      try {
        const inputs = await frame.$$eval('input', elements => 
          elements.map(el => ({
            type: el.type,
            id: el.id,
            name: el.name,
          }))
        );
        
        if (inputs.length > 0) {
          console.log(`  ✅ Inputs encontrados: ${inputs.length}`);
          console.log(JSON.stringify(inputs, null, 2));
        }
      } catch (e) {
        console.log(`  ⚠️  No se pudo acceder al frame`);
      }
      
      console.log('');
    }
    
    // Ver el HTML de la página principal
    const html = await page.content();
    console.log('HTML de la página (primeros 1000 chars):');
    console.log(html.substring(0, 1000));
    
    console.log('\nEsperando 10 segundos...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testFrames();
