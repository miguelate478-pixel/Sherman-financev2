// Código de Login y Empresas que FUNCIONA CORRECTAMENTE
import puppeteer from 'puppeteer-core';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

async function loginYEmpresas() {
  console.log('=== Login y Empresas - Código que Funciona ===\n');

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
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // ============================================
    // PASO 1: LOGIN
    // ============================================
    console.log('[1] Login en SUNAT...');
    
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    await page.type('#txtRuc', ruc, { delay: 100 });
    await page.type('#txtUsuario', solUser, { delay: 100 });
    await page.type('#txtContrasena', solPass, { delay: 100 });
    await page.click('#btnAceptar');
    
    // Esperar a que cargue el menú
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verificar que el login fue exitoso
    const menuLoaded = await page.$('#divContainerMenu');
    if (!menuLoaded) {
      throw new Error('Login falló - no se cargó el menú');
    }
    
    console.log('✅ Login exitoso');
    await page.screenshot({ path: 'paso-1-login.png', fullPage: true });
    console.log('   Screenshot: paso-1-login.png\n');
    
    // ============================================
    // PASO 2: CLICK EN EMPRESAS
    // ============================================
    console.log('[2] Click en Empresas...');
    
    const empresasClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, div, span, li'));
      const empresasEl = elements.find(el => {
        const text = el.textContent?.trim().toLowerCase();
        return text === 'empresas' || text?.includes('empresa');
      });
      
      if (empresasEl) {
        empresasEl.click();
        return true;
      }
      return false;
    });
    
    if (!empresasClicked) {
      throw new Error('No se encontró la opción "Empresas"');
    }
    
    // Esperar a que se despliegue el menú de empresas
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('✅ Empresas seleccionado');
    await page.screenshot({ path: 'paso-2-empresas.png', fullPage: true });
    console.log('   Screenshot: paso-2-empresas.png\n');
    
    // ============================================
    // AQUÍ CONTINÚA EL RESTO DEL FLUJO
    // ============================================
    console.log('========================================');
    console.log('✅ LOGIN Y EMPRESAS COMPLETADOS');
    console.log('========================================');
    console.log('\nAhora puedes continuar con:');
    console.log('  3. Click en "Consulta de Facturas y Notas Electrónicas"');
    console.log('  4. Llenar formulario de búsqueda');
    console.log('  5. Descargar XML');
    
    console.log('\nEsperando 30 segundos para que revises...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

loginYEmpresas();
