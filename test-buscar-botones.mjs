import puppeteer from 'puppeteer-core';

const CONFIG = {
  ruc: '20610169849',
  solUser: 'SHERMAN1',
  solPass: 'Pepe2024',
  chromiumPath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
};

async function buscarBotones() {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      executablePath: CONFIG.chromiumPath,
      headless: false,
      args: ['--no-sandbox', '--start-maximized'],
      defaultViewport: null,
    });
    
    const page = await browser.newPage();
    
    // Login
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await page.waitForSelector('#txtRuc');
    await page.type('#txtRuc', CONFIG.ruc, { delay: 80 });
    await page.type('#txtUsuario', CONFIG.solUser, { delay: 80 });
    await page.type('#txtContrasena', CONFIG.solPass, { delay: 80 });
    await page.click('#btnAceptar');
    await page.waitForSelector('#divContainerMenu', { timeout: 15000 });
    
    // Navegar menú
    await page.evaluate(() => {
      document.querySelector('span.spanNivelDescripcion')?.click(); // Empresas
    });
    await new Promise(r => setTimeout(r, 2000));
    
    await page.evaluate(() => {
      document.querySelector('li[data-id2="11"] span.spanNivelDescripcion')?.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    
    await page.evaluate(() => {
      document.querySelector('li[data-id2="11_38"] span.spanNivelDescripcion')?.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    
    await page.evaluate(() => {
      document.querySelector('li[data-id2="11_38_1"] span.spanNivelDescripcion')?.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    
    await page.evaluate(() => {
      document.querySelector('li[data-id2="11_38_1_1"] span.spanNivelDescripcion')?.click();
    });
    await new Promise(r => setTimeout(r, 4000));
    
    // Buscar frame
    let targetFrame = page.mainFrame();
    for (const frame of page.frames()) {
      try {
        const hasForm = await frame.evaluate(() =>
          !!document.querySelector('input[formcontrolname="rucEmisor"]')
        );
        if (hasForm) {
          targetFrame = frame;
          break;
        }
      } catch {}
    }
    
    // Llenar y consultar (código resumido)
    await targetFrame.evaluate(() => {
      document.querySelector('input[type="radio"][value="RBR"]')?.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    
    await targetFrame.evaluate(() => {
      const input = document.querySelector('input[formcontrolname="rucEmisor"]');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, '20508565934');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 800));
    
    await targetFrame.evaluate(() => {
      document.querySelector('div[role="button"][aria-haspopup="listbox"]')?.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    
    await targetFrame.evaluate(() => {
      const items = Array.from(document.querySelectorAll('li[role="option"]'));
      items.find(i => i.textContent.trim() === 'Factura')?.click();
    });
    await new Promise(r => setTimeout(r, 800));
    
    await targetFrame.evaluate(() => {
      const input = document.querySelector('input[formcontrolname="serieComprobante"]');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'FJ88');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 500));
    
    await targetFrame.evaluate(() => {
      const input = document.querySelector('input[formcontrolname="numeroComprobante"]');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, '30587');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 500));
    
    await targetFrame.evaluate(() => {
      document.querySelector('button.btn.boton-primary')?.click();
    });
    await new Promise(r => setTimeout(r, 5000));
    
    // BUSCAR TODOS LOS ELEMENTOS INTERACTIVOS
    console.log('\n=== BUSCANDO TODOS LOS BOTONES/ENLACES ===\n');
    
    const allInteractive = await targetFrame.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, a, i, span[class*="icon"], span[class*="btn"]'));
      
      return elements.map((el, idx) => ({
        index: idx,
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 100) || '',
        class: el.className,
        id: el.id,
        title: el.title || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        onclick: el.onclick ? 'tiene onclick' : '',
        href: el.href || '',
      }));
    });
    
    console.log('Total elementos interactivos:', allInteractive.length);
    console.log('\nPrimeros 30 elementos:\n');
    
    allInteractive.slice(0, 30).forEach(el => {
      console.log(`[${el.index}] ${el.tag} - "${el.text}"`);
      if (el.class) console.log(`    class: ${el.class}`);
      if (el.title) console.log(`    title: ${el.title}`);
      if (el.ariaLabel) console.log(`    aria-label: ${el.ariaLabel}`);
      if (el.onclick) console.log(`    ${el.onclick}`);
      console.log('');
    });
    
    // Buscar específicamente iconos
    console.log('\n=== BUSCANDO ICONOS ===\n');
    
    const icons = await targetFrame.evaluate(() => {
      const iconElements = Array.from(document.querySelectorAll('i, span[class*="pi-"], span[class*="fa-"]'));
      
      return iconElements.map(el => ({
        tag: el.tagName,
        class: el.className,
        parent: el.parentElement?.tagName,
        parentClass: el.parentElement?.className,
        parentText: el.parentElement?.textContent?.trim().substring(0, 50),
      }));
    });
    
    console.log('Iconos encontrados:', icons.length);
    icons.slice(0, 20).forEach((icon, i) => {
      console.log(`${i + 1}. ${icon.tag}.${icon.class}`);
      console.log(`   Parent: ${icon.parent}.${icon.parentClass}`);
      console.log(`   Text: ${icon.parentText}\n`);
    });
    
    console.log('\nEsperando 60 segundos para inspección manual...');
    await new Promise(r => setTimeout(r, 60000));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

buscarBotones();
