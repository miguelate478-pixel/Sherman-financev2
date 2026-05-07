// Test de login sin esperar navegación
import puppeteer from 'puppeteer-core';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

async function testLogin() {
  console.log('=== Test de Login (sin wait navigation) ===\n');

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
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('Navegando al Menú SOL...');
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    console.log('✅ Página cargada\n');
    
    console.log('Llenando formulario...');
    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    
    await page.type('#txtRuc', ruc, { delay: 100 });
    await page.type('#txtUsuario', solUser, { delay: 100 });
    await page.type('#txtContrasena', solPass, { delay: 100 });
    
    console.log('✅ Formulario llenado\n');
    
    // Tomar screenshot antes de hacer clic
    await page.screenshot({ path: 'antes-login.png' });
    console.log('📸 Screenshot: antes-login.png\n');
    
    console.log('Haciendo clic en Aceptar...');
    await page.click('#btnAceptar');
    
    // Esperar 5 segundos sin waitForNavigation
    console.log('Esperando 5 segundos...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Ver qué hay en la página ahora
    const url = page.url();
    const title = await page.title();
    
    console.log(`\nURL actual: ${url}`);
    console.log(`Título: ${title}`);
    
    // Tomar screenshot después
    await page.screenshot({ path: 'despues-login.png' });
    console.log('📸 Screenshot: despues-login.png\n');
    
    // Buscar mensajes de error
    const errorMsg = await page.evaluate(() => {
      const errors = document.querySelectorAll('.error, .mensajeError, .alert-danger');
      return Array.from(errors).map(el => el.textContent?.trim());
    });
    
    if (errorMsg.length > 0) {
      console.log('⚠️  Mensajes de error encontrados:');
      errorMsg.forEach(msg => console.log(`   - ${msg}`));
    }
    
    // Ver si hay CAPTCHA
    const hasCaptcha = await page.evaluate(() => {
      const captcha = document.querySelector('[id*="captcha"], [class*="captcha"], img[src*="captcha"]');
      return !!captcha;
    });
    
    if (hasCaptcha) {
      console.log('\n⚠️  CAPTCHA detectado en la página');
    }
    
    console.log('\nEsperando 15 segundos para que veas la página...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testLogin();
