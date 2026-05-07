import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';

const CONFIG = {
  ruc: '20610169849',
  solUser: 'SHERMAN1',
  solPass: 'Pepe2024',
  chromiumPath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  downloadPath: path.join(process.cwd(), 'temp-downloads'),
  headless: false,
};

async function descargarXMLDeSUNAT(factura) {
  console.log('=== AUTOMATIZACIÓN SUNAT - DESCARGA DE XML ===\n');
  
  let browser;
  
  try {
    await fs.mkdir(CONFIG.downloadPath, { recursive: true });
    
    console.log('[1] Iniciando navegador...');
    browser = await puppeteer.launch({
      executablePath: CONFIG.chromiumPath,
      headless: CONFIG.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--start-maximized'
      ],
      defaultViewport: null,
    });
    
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    );
    
    // ── LOGIN ──────────────────────────────────────────
    console.log('[2] Login...');
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    await page.type('#txtRuc', CONFIG.ruc, { delay: 80 });
    await page.type('#txtUsuario', CONFIG.solUser, { delay: 80 });
    await page.type('#txtContrasena', CONFIG.solPass, { delay: 80 });
    await page.click('#btnAceptar');
    await page.waitForSelector('#divContainerMenu', { timeout: 15000 });
    console.log('✅ Login OK\n');
    
    // ── NAVEGACIÓN MENÚ ────────────────────────────────
    console.log('[3] Navegando menú...');
    
    // Click Empresas
    await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
      spans.find(s => s.textContent.trim() === 'Empresas')?.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    
    // Click 1: Comprobantes de pago (nivel 1)
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11"] span.spanNivelDescripcion')
        || Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
          .find(s => s.textContent.trim() === 'Comprobantes de pago');
      el?.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    
    // Click 2: Comprobantes de Pago (nivel 2 — segunda aparición)
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11_38"] span.spanNivelDescripcion')
        || Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
          .filter(s => s.textContent.trim().toLowerCase() === 'comprobantes de pago')[1];
      el?.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    
    // Click 3: Consulta de Comprobantes de Pago
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11_38_1"] span.spanNivelDescripcion')
        || Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
          .find(s => s.textContent.trim() === 'Consulta de Comprobantes de Pago');
      el?.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    
    // Click 4: Nueva Consulta de comprobantes de pago
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11_38_1_1"] span.spanNivelDescripcion')
        || Array.from(document.querySelectorAll('span.spanNivelDescripcion'))
          .find(s => s.textContent.trim() === 'Nueva Consulta de comprobantes de pago');
      el?.click();
    });
    await new Promise(r => setTimeout(r, 4000));
    console.log('✅ Menú navegado\n');
    
    // ── BUSCAR FRAME CON EL FORMULARIO ─────────────────
    console.log('[4] Buscando formulario Angular...');
    let targetFrame = page.mainFrame();
    
    for (const frame of page.frames()) {
      try {
        const hasForm = await frame.evaluate(() =>
          !!(document.querySelector('input[formcontrolname="rucEmisor"]') ||
             document.querySelector('input[name="rucEmisor"]'))
        );
        if (hasForm) {
          targetFrame = frame;
          break;
        }
      } catch {}
    }
    
    console.log(`✅ Frame: ${targetFrame.url()}\n`);
    
    // ── CLICK RECIBIDO ─────────────────────────────────
    console.log('[5] Seleccionando Recibido...');
    await targetFrame.evaluate(() => {
      const radio = document.querySelector('input[type="radio"][value="RBR"]')
        || document.querySelector('input[id="recibido"]');
      if (radio) {
        radio.click();
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log('✅ Recibido seleccionado\n');
    
    // ── RUC EMISOR ─────────────────────────────────────
    console.log('[6] Llenando RUC Emisor...');
    await targetFrame.evaluate((ruc) => {
      const input = document.querySelector('input[formcontrolname="rucEmisor"]')
        || document.querySelector('input[name="rucEmisor"]');
      if (input) {
        input.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        ).set;
        nativeInputValueSetter.call(input, ruc);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    }, factura.rucEmisor);
    await new Promise(r => setTimeout(r, 800));
    console.log('✅ RUC llenado\n');
    
    // ── TIPO COMPROBANTE (PrimeNG p-dropdown) ──────────
    console.log('[7] Seleccionando tipo Factura...');
    await targetFrame.evaluate(() => {
      const trigger = document.querySelector(
        'div[role="button"][aria-haspopup="listbox"], p-dropdown div.p-dropdown-trigger'
      );
      trigger?.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    
    await targetFrame.evaluate(() => {
      const items = Array.from(document.querySelectorAll(
        'li[role="option"], .p-dropdown-item, li.p-dropdown-item'
      ));
      const factura = items.find(i => i.textContent.trim() === 'Factura');
      factura?.click();
    });
    await new Promise(r => setTimeout(r, 800));
    console.log('✅ Tipo seleccionado\n');
    
    // ── SERIE ──────────────────────────────────────────
    console.log('[8] Llenando Serie...');
    await targetFrame.evaluate((serie) => {
      const input = document.querySelector('input[formcontrolname="serieComprobante"]')
        || document.querySelector('input[name="serieComprobante"]');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        ).set;
        setter.call(input, serie);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, factura.serie);
    await new Promise(r => setTimeout(r, 500));
    console.log('✅ Serie llenada\n');
    
    // ── NÚMERO ─────────────────────────────────────────
    console.log('[9] Llenando Número...');
    await targetFrame.evaluate((numero) => {
      const input = document.querySelector('input[formcontrolname="numeroComprobante"]')
        || document.querySelector('input[name="numeroComprobante"]');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        ).set;
        setter.call(input, numero);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, factura.numero);
    await new Promise(r => setTimeout(r, 500));
    console.log('✅ Número llenado\n');
    
    // ── CONSULTAR ──────────────────────────────────────
    console.log('[10] Consultando...');
    await targetFrame.evaluate(() => {
      const btn = document.querySelector('button.btn.boton-primary')
        || document.querySelector('button[type="submit"]')
        || Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent.trim().toLowerCase().includes('consultar'));
      btn?.click();
    });
    await new Promise(r => setTimeout(r, 5000));
    console.log('✅ Consulta enviada\n');
    
    // ── ESPERAR QUE APAREZCA EL MODAL CON LA FACTURA ──
    console.log('[11] Esperando modal con factura...');
    await targetFrame.waitForSelector('ngb-modal-window, .modal-dialog, control-cpe-factura', {
      timeout: 10000
    });
    await new Promise(r => setTimeout(r, 2000));
    console.log('✅ Modal con factura abierto\n');
    
    // ── CLICK EN BOTÓN DESCARGAR XML ──────────────────
    // Los botones están en div.button-container dentro del modal
    // Son: PDF(rojo), XML(verde), ..., imprimir, email
    // El botón XML es el segundo (índice 1) en .button-container
    console.log('[12] Descargando XML...');
    
    // Configurar descarga antes del click
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: CONFIG.downloadPath,
    });
    
    const xmlClicked = await targetFrame.evaluate(() => {
      // Buscar el botón XML — es el segundo botón en div.button-container
      // o el que tiene clase relacionada con XML/verde
      const container = document.querySelector('div.button-container, .button-container');
      if (container) {
        const buttons = container.querySelectorAll('button');
        // El segundo botón (índice 1) es el XML (verde)
        if (buttons[1]) {
          buttons[1].click();
          return { clicked: true, method: 'button-container index 1' };
        }
      }
      
      // Fallback: buscar por título o aria-label
      const allBtns = Array.from(document.querySelectorAll('button'));
      const xmlBtn = allBtns.find(b => {
        const title = (b.title || b.getAttribute('aria-label') || '').toLowerCase();
        const cls = (b.className || '').toLowerCase();
        return title.includes('xml') || cls.includes('xml');
      });
      
      if (xmlBtn) {
        xmlBtn.click();
        return { clicked: true, method: 'aria-label/title' };
      }
      
      // Fallback 2: el botón verde (segundo ícono)
      const ngxBtns = Array.from(document.querySelectorAll('ngb-modal-window button, .modal button'));
      if (ngxBtns.length >= 2) {
        ngxBtns[1].click();
        return { clicked: true, method: 'modal button index 1' };
      }
      
      return { clicked: false, total: allBtns.length };
    });
    
    console.log('Click XML:', xmlClicked);
    await new Promise(r => setTimeout(r, 5000));
    
    // ── ESPERAR DESCARGA ───────────────────────────────
    let downloaded = false;
    let fileName = '';
    
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      
      const files = await fs.readdir(CONFIG.downloadPath);
      const xmlFile = files.find(f =>
        (f.endsWith('.xml') || f.endsWith('.zip')) &&
        !f.endsWith('.crdownload')
      );
      
      if (xmlFile) {
        fileName = xmlFile;
        downloaded = true;
        break;
      }
      
      if (i % 5 === 0) console.log(`  Esperando descarga... ${i}s`);
    }
    
    if (downloaded) {
      console.log(`\n✅ XML DESCARGADO: ${fileName}`);
      
      const filePath = path.join(CONFIG.downloadPath, fileName);
      const content = await fs.readFile(filePath, 'utf8');
      
      console.log('Primeras 500 chars del XML:');
      console.log(content.substring(0, 500));
      
      return { success: true, fileName, size: content.length };
    } else {
      // Screenshot para ver qué pasó
      await page.screenshot({ path: 'after-xml-click.png', fullPage: true });
      throw new Error('XML no descargado - ver after-xml-click.png');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}

descargarXMLDeSUNAT({
  rucEmisor: '20508565934',
  tipoComprobante: '01',
  serie: 'FJ88',
  numero: '30587',
}).then(r => process.exit(r.success ? 0 : 1));
