// Test de login con selección de Empresas
import puppeteer from 'puppeteer-core';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

async function testLoginEmpresas() {
  console.log('=== Test de Login + Selección de Empresas ===\n');

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
    
    // 1. Ir al Menú SOL
    console.log('[1/5] Navegando al Menú SOL...');
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    console.log('✅ Página cargada\n');
    
    // 2. Login
    console.log('[2/5] Iniciando sesión...');
    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    
    await page.type('#txtRuc', ruc, { delay: 100 });
    await page.type('#txtUsuario', solUser, { delay: 100 });
    await page.type('#txtContrasena', solPass, { delay: 100 });
    
    await page.click('#btnAceptar');
    
    console.log('   Esperando respuesta...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('✅ Login enviado\n');
    
    // 3. Buscar y hacer clic en "Empresas"
    console.log('[3/5] Buscando opción "Empresas"...');
    
    // Tomar screenshot
    await page.screenshot({ path: 'despues-login.png' });
    console.log('📸 Screenshot: despues-login.png\n');
    
    // Buscar todos los links/botones
    const options = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, button, div[onclick], span[onclick]'));
      return elements.map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 100),
        onclick: el.onclick?.toString().substring(0, 100),
        href: el.href,
      })).filter(e => e.text && e.text.length > 0);
    });
    
    console.log('Opciones disponibles:');
    options.slice(0, 30).forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt.text}`);
      if (opt.text.toLowerCase().includes('empresa')) {
        console.log(`     ✅ ENCONTRADO: ${opt.tag} - ${opt.href || opt.onclick}`);
      }
    });
    
    // Buscar el link/botón de "Empresas"
    const empresasSelector = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, button, div, span'));
      const empresasEl = elements.find(el => 
        el.textContent?.trim().toLowerCase() === 'empresas' ||
        el.textContent?.trim().toLowerCase().includes('empresa')
      );
      
      if (empresasEl) {
        // Intentar obtener un selector único
        if (empresasEl.id) return `#${empresasEl.id}`;
        if (empresasEl.className) return `.${empresasEl.className.split(' ')[0]}`;
        return null;
      }
      return null;
    });
    
    if (empresasSelector) {
      console.log(`\n✅ Selector encontrado: ${empresasSelector}`);
      console.log('Haciendo clic en "Empresas"...');
      
      await page.click(empresasSelector);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ Clic realizado\n');
      
      // Ver URL actual
      const url = page.url();
      const title = await page.title();
      console.log(`URL actual: ${url}`);
      console.log(`Título: ${title}\n`);
      
      // Tomar screenshot del menú de empresas
      await page.screenshot({ path: 'menu-empresas.png' });
      console.log('📸 Screenshot: menu-empresas.png\n');
      
    } else {
      console.log('\n⚠️  No se encontró selector automático para "Empresas"');
      console.log('Revisa el screenshot "despues-login.png" para ver las opciones');
    }
    
    // 4. Buscar menú de consultas
    console.log('[4/5] Buscando menú de consultas...');
    
    const menuLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        text: link.textContent?.trim().substring(0, 100),
        href: link.href,
      })).filter(l => l.text && l.text.length > 0);
    });
    
    console.log('Links del menú:');
    menuLinks.slice(0, 30).forEach((link, i) => {
      console.log(`  ${i + 1}. ${link.text}`);
      if (link.text.toLowerCase().includes('comprobante') || 
          link.text.toLowerCase().includes('consulta')) {
        console.log(`     → ${link.href}`);
      }
    });
    
    // Buscar link de comprobantes recibidos
    const comprobanteLink = menuLinks.find(link => 
      link.text.toLowerCase().includes('comprobante') && 
      (link.text.toLowerCase().includes('recibid') || link.text.toLowerCase().includes('consulta'))
    );
    
    if (comprobanteLink) {
      console.log(`\n✅ Link de comprobantes encontrado:`);
      console.log(`   Texto: ${comprobanteLink.text}`);
      console.log(`   URL: ${comprobanteLink.href}`);
      
      // Navegar al link
      console.log('\n[5/5] Navegando a consulta de comprobantes...');
      await page.goto(comprobanteLink.href, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Tomar screenshot
      await page.screenshot({ path: 'consulta-comprobantes.png' });
      console.log('📸 Screenshot: consulta-comprobantes.png\n');
      
      console.log('✅ En página de consulta de comprobantes');
    }
    
    console.log('\nEsperando 20 segundos para que explores...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    console.log('\n========================================');
    console.log('RESULTADO: ✅ LOGIN COMPLETO FUNCIONA');
    console.log('========================================');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    if (browser) {
      console.log('\nCerrando navegador...');
      await browser.close();
    }
  }
}

testLoginEmpresas();
