// Test de diferentes URLs de SUNAT
import puppeteer from 'puppeteer-core';

const urls = [
  'https://e-factura.sunat.gob.pe',
  'https://e-menu.sunat.gob.pe',
  'https://ww1.sunat.gob.pe',
  'https://www.sunat.gob.pe',
  'https://e-factura.sunat.gob.pe/cl-ti-itmenu',
  'https://e-factura.sunat.gob.pe/cl-ti-itmrconsruc/jcrS00Alias',
];

async function testUrls() {
  console.log('=== Test de URLs de SUNAT ===\n');

  let browser;
  
  try {
    const chromiumPath = process.env.CHROMIUM_PATH || 
                        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: true,
      args: ['--no-sandbox'],
    });
    
    const page = await browser.newPage();
    
    for (const url of urls) {
      console.log(`\nProbando: ${url}`);
      
      try {
        const response = await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 15000,
        });
        
        const status = response?.status();
        console.log(`  Status: ${status}`);
        
        if (status === 200) {
          const title = await page.title();
          console.log(`  ✅ Título: ${title}`);
          
          // Ver si tiene formulario de login
          const hasLogin = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');
            return inputs.length > 0;
          });
          
          if (hasLogin) {
            console.log(`  ✅ Tiene formulario de login`);
          }
        } else {
          console.log(`  ❌ Error ${status}`);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
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

testUrls();
