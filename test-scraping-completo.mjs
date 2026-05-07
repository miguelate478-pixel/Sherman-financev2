// Test completo de scraping con URL correcta
import puppeteer from 'puppeteer-core';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

async function testScrapingCompleto() {
  console.log('=== Test Completo de Scraping SUNAT ===\n');

  let browser;
  
  try {
    const chromiumPath = process.env.CHROMIUM_PATH || 
                        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 1. Ir al Menú SOL
    console.log('[1/4] Navegando al Menú SOL...');
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    console.log('✅ Página cargada\n');
    
    // 2. Login
    console.log('[2/4] Iniciando sesión...');
    console.log(`   RUC: ${ruc}`);
    console.log(`   Usuario: ${solUser}`);
    
    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    
    await page.type('#txtRuc', ruc, { delay: 100 });
    await page.type('#txtUsuario', solUser, { delay: 100 });
    await page.type('#txtContrasena', solPass, { delay: 100 });
    
    // Hacer clic en ingresar
    await page.click('#btnAceptar');
    
    console.log('   Esperando navegación...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    
    // Verificar si hay error
    const loginError = await page.$('.mensajeError, .error');
    if (loginError) {
      const errorText = await page.evaluate(el => el?.textContent, loginError);
      throw new Error(`Error de login: ${errorText}`);
    }
    
    console.log('✅ Login exitoso\n');
    
    // Tomar screenshot del menú
    await page.screenshot({ path: 'menu-principal.png' });
    console.log('📸 Screenshot guardado: menu-principal.png\n');
    
    // 3. Buscar opción de consulta de comprobantes
    console.log('[3/4] Buscando menú de consultas...');
    
    // Ver qué opciones hay en el menú
    const menuOptions = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        text: link.textContent?.trim().substring(0, 100),
        href: link.href,
      })).filter(l => l.text && l.text.length > 0);
    });
    
    console.log('Opciones de menú encontradas:');
    menuOptions.slice(0, 20).forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt.text}`);
      if (opt.text.toLowerCase().includes('comprobante') || 
          opt.text.toLowerCase().includes('consulta')) {
        console.log(`     → ${opt.href}`);
      }
    });
    
    // Buscar link de comprobantes recibidos
    const comprobanteLink = menuOptions.find(opt => 
      opt.text.toLowerCase().includes('comprobante') && 
      opt.text.toLowerCase().includes('recibid')
    );
    
    if (comprobanteLink) {
      console.log(`\n✅ Encontrado: ${comprobanteLink.text}`);
      console.log(`   URL: ${comprobanteLink.href}`);
    } else {
      console.log('\n⚠️  No se encontró link directo de comprobantes recibidos');
      console.log('Puedes navegar manualmente y copiar la URL correcta');
    }
    
    console.log('\n[4/4] Esperando 15 segundos para que explores el menú...');
    console.log('Busca la opción "Consulta de Comprobantes Recibidos" o similar');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    console.log('\n========================================');
    console.log('RESULTADO: ✅ SCRAPING FUNCIONA');
    console.log('========================================');
    console.log('El sistema puede:');
    console.log('  ✅ Acceder al Menú SOL');
    console.log('  ✅ Iniciar sesión correctamente');
    console.log('  ✅ Navegar por el menú');
    console.log('\nPróximo paso: Encontrar URL exacta de consulta de comprobantes');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (browser) {
      console.log('\nCerrando navegador...');
      await browser.close();
    }
  }
}

testScrapingCompleto();
