// Test del portal Menú SOL de SUNAT
import puppeteer from 'puppeteer-core';

const urls = [
  'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm',
  'https://e-menu.sunat.gob.pe/cl-ti-itmenu/FrameCriterioBusqueda.htm',
  'https://e-menu.sunat.gob.pe',
  'https://ww1.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm',
  'https://www.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm',
];

async function testMenuSOL() {
  console.log('=== Test de Menú SOL ===\n');

  let browser;
  
  try {
    const chromiumPath = process.env.CHROMIUM_PATH || 
                        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: false, // Visible para ver
      args: ['--no-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    for (const url of urls) {
      console.log(`\nProbando: ${url}`);
      
      try {
        const response = await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 20000,
        });
        
        const status = response?.status();
        console.log(`  Status: ${status}`);
        
        if (status === 200) {
          const title = await page.title();
          console.log(`  ✅ Título: ${title}`);
          
          // Esperar un poco para que cargue JavaScript
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Buscar campos de login
          const loginFields = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input'));
            return inputs.map(input => ({
              type: input.type,
              id: input.id,
              name: input.name,
              placeholder: input.placeholder,
            }));
          });
          
          if (loginFields.length > 0) {
            console.log(`  ✅ Campos de login encontrados:`);
            console.log(JSON.stringify(loginFields, null, 2));
            
            // Tomar screenshot
            const filename = `menu-sol-${urls.indexOf(url)}.png`;
            await page.screenshot({ path: filename });
            console.log(`  📸 Screenshot: ${filename}`);
            
            // Esta es la URL correcta!
            console.log(`\n  🎯 ¡URL CORRECTA ENCONTRADA!`);
            console.log(`  Esperando 10 segundos para que la veas...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            break;
          }
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message.substring(0, 100)}`);
      }
    }
    
  } catch (error) {
    console.error('Error general:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testMenuSOL();
