// Explorar data-ids del menú
import puppeteer from 'puppeteer-core';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

async function exploreDataIds() {
  console.log('=== Explorar Data-IDs del Menú ===\n');

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
    console.log('[1/3] Login...');
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    await page.waitForSelector('#txtRuc');
    await page.type('#txtRuc', ruc);
    await page.type('#txtUsuario', solUser);
    await page.type('#txtContrasena', solPass);
    await page.click('#btnAceptar');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Login\n');
    
    // Click en Empresas
    console.log('[2/3] Click en Empresas...');
    await page.evaluate(() => {
      const empresasDiv = document.querySelector('div[data-id="2"]');
      if (empresasDiv) empresasDiv.click();
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Empresas\n');
    
    // Explorar menú
    console.log('[3/3] Explorando menú...\n');
    
    const menuItems = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('li[data-id2]'));
      return items.map(li => ({
        dataId2: li.getAttribute('data-id2'),
        text: li.querySelector('span.spanNivelDescripcion')?.textContent?.trim(),
        visible: li.offsetParent !== null,
      })).filter(item => item.visible && item.text);
    });
    
    console.log('Items del menú nivel 1:');
    menuItems.forEach((item, i) => {
      console.log(`${i + 1}. [${item.dataId2}] ${item.text}`);
      if (item.text.toLowerCase().includes('comprobante')) {
        console.log('   ✅ ESTE ES EL QUE NECESITAMOS');
      }
    });
    
    // Click en "Comprobantes de pago" (data-id2="11")
    console.log('\nHaciendo click en "Comprobantes de pago"...');
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11"] span.spanNivelDescripcion');
      if (el) el.click();
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Click realizado\n');
    
    // Ver sub-menú nivel 2
    const subMenu2 = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('li[data-id2^="11_"]'));
      return items.map(li => ({
        dataId2: li.getAttribute('data-id2'),
        text: li.querySelector('span.spanNivelDescripcion')?.textContent?.trim(),
        visible: li.offsetParent !== null,
      })).filter(item => item.visible && item.text);
    });
    
    console.log('Sub-menú nivel 2 (11_*):');
    subMenu2.forEach((item, i) => {
      console.log(`${i + 1}. [${item.dataId2}] ${item.text}`);
    });
    
    console.log('\nEsperando 30 segundos para que explores...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

exploreDataIds();
