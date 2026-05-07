// Test para explorar el menú de facturas electrónicas
import puppeteer from 'puppeteer-core';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

async function testMenuFacturas() {
  console.log('=== Test de Menú de Facturas Electrónicas ===\n');

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
    
    // 2. Buscar y hacer clic en "Consulta de Facturas y Notas Electrónicas"
    console.log('[2/3] Buscando menú de facturas...');
    
    // Buscar el elemento que contiene "Consulta de Facturas"
    const facturasLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, div, span'));
      const facturasEl = links.find(el => 
        el.textContent?.includes('Consulta de Facturas') ||
        el.textContent?.includes('Facturas y Notas')
      );
      
      if (facturasEl) {
        // Obtener selector
        if (facturasEl.id) return { selector: `#${facturasEl.id}`, text: facturasEl.textContent?.trim() };
        
        // Buscar por texto exacto
        return { selector: null, text: facturasEl.textContent?.trim() };
      }
      return null;
    });
    
    if (facturasLink) {
      console.log(`✅ Encontrado: "${facturasLink.text}"`);
      
      if (facturasLink.selector) {
        console.log(`   Selector: ${facturasLink.selector}`);
        await page.click(facturasLink.selector);
      } else {
        // Hacer clic por texto
        console.log('   Haciendo clic por texto...');
        await page.evaluate((text) => {
          const links = Array.from(document.querySelectorAll('a, div, span'));
          const el = links.find(e => e.textContent?.includes(text));
          if (el) el.click();
        }, facturasLink.text);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Tomar screenshot después del clic
      await page.screenshot({ path: 'menu-facturas-expandido.png' });
      console.log('📸 Screenshot: menu-facturas-expandido.png\n');
      
      // 3. Buscar submenú
      console.log('[3/3] Buscando opciones del submenú...');
      
      const submenuOptions = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('a, div[onclick], span[onclick]'));
        return elements.map(el => ({
          text: el.textContent?.trim().substring(0, 150),
          href: el.href,
          onclick: el.onclick?.toString().substring(0, 200),
        })).filter(e => e.text && e.text.length > 5);
      });
      
      console.log('Opciones del submenú:');
      submenuOptions.forEach((opt, i) => {
        if (opt.text.toLowerCase().includes('comprobante') || 
            opt.text.toLowerCase().includes('consulta') ||
            opt.text.toLowerCase().includes('recibid')) {
          console.log(`  ${i + 1}. ${opt.text}`);
          if (opt.href && opt.href !== 'javascript:void(0)') {
            console.log(`     → URL: ${opt.href}`);
          }
          if (opt.onclick) {
            console.log(`     → onclick: ${opt.onclick.substring(0, 100)}`);
          }
        }
      });
      
      // Buscar específicamente "comprobantes recibidos"
      const recibidosLink = submenuOptions.find(opt => 
        opt.text.toLowerCase().includes('recibid') ||
        opt.text.toLowerCase().includes('compra')
      );
      
      if (recibidosLink) {
        console.log(`\n✅ ENCONTRADO: "${recibidosLink.text}"`);
        if (recibidosLink.href && recibidosLink.href !== 'javascript:void(0)') {
          console.log(`   URL: ${recibidosLink.href}`);
          
          // Navegar a esa URL
          console.log('\n   Navegando...');
          await page.goto(recibidosLink.href, {
            waitUntil: 'networkidle2',
            timeout: 30000,
          });
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const url = page.url();
          const title = await page.title();
          console.log(`   URL actual: ${url}`);
          console.log(`   Título: ${title}`);
          
          await page.screenshot({ path: 'consulta-comprobantes-recibidos.png' });
          console.log('   📸 Screenshot: consulta-comprobantes-recibidos.png');
        }
      }
      
    } else {
      console.log('⚠️  No se encontró el menú de facturas');
    }
    
    console.log('\nEsperando 20 segundos para que explores...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    console.log('\n========================================');
    console.log('RESULTADO: Revisa los screenshots');
    console.log('========================================');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testMenuFacturas();
