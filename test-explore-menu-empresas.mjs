// Test para explorar el menú después de hacer clic en Empresas
import puppeteer from 'puppeteer-core';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

async function exploreMenuEmpresas() {
  console.log('=== Explorar Menú de Empresas ===\n');

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
    
    // 1. Login
    console.log('[1/3] Iniciando sesión...');
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    await page.type('#txtRuc', ruc, { delay: 100 });
    await page.type('#txtUsuario', solUser, { delay: 100 });
    await page.type('#txtContrasena', solPass, { delay: 100 });
    await page.click('#btnAceptar');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Login completado\n');
    
    // 2. Hacer clic en Empresas
    console.log('[2/3] Haciendo clic en "Empresas"...');
    
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
    
    console.log('✅ Clic en "Empresas" realizado');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await page.screenshot({ path: 'menu-empresas-expanded.png' });
    console.log('📸 Screenshot: menu-empresas-expanded.png\n');
    
    // 3. Explorar opciones del menú
    console.log('[3/3] Explorando opciones del menú...\n');
    
    // Buscar todos los links y opciones visibles
    const menuOptions = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, div[onclick], span[onclick], li'));
      return elements
        .filter(el => {
          const text = el.textContent?.trim();
          return text && text.length > 3 && text.length < 200;
        })
        .map(el => ({
          text: el.textContent?.trim(),
          href: el.href,
          onclick: el.onclick?.toString().substring(0, 150),
          id: el.id,
          class: el.className,
        }));
    });
    
    console.log('📋 Opciones del menú (primeras 50):');
    menuOptions.slice(0, 50).forEach((opt, i) => {
      console.log(`${i + 1}. ${opt.text}`);
      if (opt.text.toLowerCase().includes('factura') || 
          opt.text.toLowerCase().includes('comprobante') ||
          opt.text.toLowerCase().includes('consulta')) {
        console.log(`   ✅ RELEVANTE`);
        if (opt.href && opt.href !== 'javascript:void(0)') {
          console.log(`   → URL: ${opt.href}`);
        }
        if (opt.onclick) {
          console.log(`   → onclick: ${opt.onclick}`);
        }
        if (opt.id) {
          console.log(`   → ID: ${opt.id}`);
        }
      }
    });
    
    // Buscar específicamente opciones relacionadas con comprobantes
    console.log('\n🔍 Opciones relacionadas con comprobantes:');
    const relevantOptions = menuOptions.filter(opt =>
      opt.text.toLowerCase().includes('comprobante') ||
      opt.text.toLowerCase().includes('factura') ||
      opt.text.toLowerCase().includes('consulta')
    );
    
    relevantOptions.forEach((opt, i) => {
      console.log(`\n${i + 1}. ${opt.text}`);
      console.log(`   Href: ${opt.href || 'N/A'}`);
      console.log(`   Onclick: ${opt.onclick || 'N/A'}`);
      console.log(`   ID: ${opt.id || 'N/A'}`);
      console.log(`   Class: ${opt.class || 'N/A'}`);
    });
    
    // Buscar iframes
    console.log('\n📦 Buscando iframes...');
    const frames = page.frames();
    console.log(`Frames encontrados: ${frames.length}`);
    frames.forEach((frame, i) => {
      console.log(`  ${i}. ${frame.url()}`);
    });
    
    console.log('\n========================================');
    console.log('Revisa menu-empresas-expanded.png');
    console.log('========================================');
    
    console.log('\nEsperando 30 segundos para que explores...');
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

exploreMenuEmpresas();
