// Test del scraping con captura de JWT token
import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

// Factura de prueba
const testInvoice = {
  rucEmisor: '20508565934', // Hipermercados Tottus
  tipoComprobante: '01', // Factura
  serie: 'FJ88',
  numero: '30587',
};

async function testJWTScraping() {
  console.log('=== Test de Scraping con JWT Token ===\n');
  console.log(`Factura: ${testInvoice.serie}-${testInvoice.numero}`);
  console.log(`RUC Emisor: ${testInvoice.rucEmisor}\n`);

  let browser;
  const downloadPath = path.join(process.cwd(), 'temp-downloads');
  
  try {
    await fs.mkdir(downloadPath, { recursive: true });
    
    const chromiumPath = process.env.CHROMIUM_PATH || 
                        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: false,
      args: ['--no-sandbox', '--start-maximized'],
      defaultViewport: null,
    });
    
    const page = await browser.newPage();
    
    let formToken = null;
    const seenUrls = new Set();
    
    // Interceptar el token JWT - escuchar tanto requests como responses
    page.on('request', (request) => {
      const url = request.url();
      if (!seenUrls.has(url) && (url.includes('e-factura') || url.includes('consulta') || url.includes('nuevaconsulta'))) {
        console.log('[DEBUG] Request:', url.substring(0, 100));
        seenUrls.add(url);
      }
      if (url.includes('nuevaconsulta.html') && url.includes('token=')) {
        const match = url.match(/token=([^&]+)/);
        if (match) {
          formToken = match[1];
          console.log('[JWT] ✅ Token capturado (request):', formToken.substring(0, 50) + '...');
        }
      }
    });
    
    page.on('response', async (response) => {
      const url = response.url();
      if (!seenUrls.has(url) && (url.includes('e-factura') || url.includes('consulta') || url.includes('nuevaconsulta'))) {
        console.log('[DEBUG] Response:', url.substring(0, 100));
        seenUrls.add(url);
      }
      if (url.includes('nuevaconsulta.html') && url.includes('token=')) {
        const match = url.match(/token=([^&]+)/);
        if (match) {
          formToken = match[1];
          console.log('[JWT] ✅ Token capturado (response):', formToken.substring(0, 50) + '...');
        }
      }
    });
    
    page.on('framenavigated', (frame) => {
      const url = frame.url();
      if (!seenUrls.has(url) && (url.includes('e-factura') || url.includes('consulta') || url.includes('nuevaconsulta'))) {
        console.log('[DEBUG] Frame navigated:', url.substring(0, 100));
        seenUrls.add(url);
      }
      if (url.includes('nuevaconsulta.html') && url.includes('token=')) {
        const match = url.match(/token=([^&]+)/);
        if (match) {
          formToken = match[1];
          console.log('[JWT] ✅ Token capturado (frame):', formToken.substring(0, 50) + '...');
        }
      }
    });
    
    // 1. Login
    console.log('[1/8] Login...');
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
    console.log('✅ Login completado\n');
    
    // 2. Click en Empresas
    console.log('[2/8] Click en Empresas...');
    await page.evaluate(() => {
      const empresasDiv = document.querySelector('div[data-id="2"]');
      if (empresasDiv) empresasDiv.click();
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Empresas seleccionado\n');
    
    // 3-6. Navegar por el menú (4 clicks)
    console.log('[3/8] Navegando por el menú...');
    
    // Click 1
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11"] span.spanNivelDescripcion');
      if (el) el.click();
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('  ✅ Click 1: Comprobantes Electrónicos');
    
    // Click 2
    await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span.spanNivelDescripcion'));
      const matches = spans.filter(s =>
        s.textContent?.trim().toLowerCase() === 'comprobantes de pago'
      );
      if (matches.length > 1) matches[1].click();
      else if (matches[0]) matches[0].click();
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('  ✅ Click 2: Comprobantes de Pago');
    
    // Click 3
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11_38_1"] span.spanNivelDescripcion');
      if (el) el.click();
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('  ✅ Click 3: Consulta');
    
    // Click 4
    await page.evaluate(() => {
      const el = document.querySelector('li[data-id2="11_38_1_1"] span.spanNivelDescripcion');
      if (el) el.click();
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('  ✅ Click 4: Nueva Consulta\n');
    
    // 7. Esperar token
    console.log('[4/8] Esperando token JWT...');
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (formToken) break;
      if (i % 3 === 0) console.log(`  Esperando... ${i + 1}/15`);
    }
    
    if (!formToken) {
      throw new Error('❌ Token no capturado');
    }
    
    console.log('✅ Token capturado\n');
    
    // 8. Navegar al formulario con token
    console.log('[5/8] Navegando al formulario con token...');
    const formUrl = `https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/loader/nuevaconsulta.html?token=${formToken}`;
    await page.goto(formUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Esperar formulario Angular
    await page.waitForFunction(
      () => !!document.querySelector('input[formcontrolname="rucEmisor"]'),
      { timeout: 15000 }
    );
    console.log('✅ Formulario cargado\n');
    
    // 9. Seleccionar "Recibido"
    console.log('[6/8] Seleccionando filtro "Recibido"...');
    await page.evaluate(() => {
      const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
      const recibidoRadio = radios.find(r => {
        const label = document.querySelector(`label[for="${r.id}"]`);
        return label?.textContent?.trim().toLowerCase().includes('recibido');
      });
      if (recibidoRadio) recibidoRadio.click();
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Filtro seleccionado\n');
    
    // 10. Llenar formulario
    console.log('[7/8] Llenando formulario...');
    const filled = await page.evaluate((data) => {
      const rucInput = document.querySelector('input[formcontrolname="rucEmisor"]');
      if (!rucInput) return false;
      rucInput.value = data.rucEmisor;
      rucInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      const tipoSelect = document.querySelector('select[formcontrolname="tipoComprobante"]');
      if (tipoSelect) {
        tipoSelect.value = data.tipoComprobante;
        tipoSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      const serieInput = document.querySelector('input[formcontrolname="serieComprobante"]');
      if (!serieInput) return false;
      serieInput.value = data.serie;
      serieInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      const numeroInput = document.querySelector('input[formcontrolname="numeroComprobante"]');
      if (!numeroInput) return false;
      numeroInput.value = data.numero;
      numeroInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      return true;
    }, testInvoice);
    
    if (!filled) {
      throw new Error('❌ No se pudo llenar el formulario');
    }
    
    console.log('✅ Formulario llenado\n');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 11. Click en Consultar
    console.log('[8/8] Consultando...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const consultarBtn = buttons.find(btn =>
        btn.textContent?.trim().toLowerCase().includes('consultar')
      );
      if (consultarBtn) consultarBtn.click();
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 12. Esperar modal
    console.log('Esperando modal...');
    await page.waitForSelector('ngb-modal-window', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Modal abierto\n');
    
    // 13. Configurar descarga
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath,
    });
    
    // 14. Click en botón XML
    console.log('Descargando XML...');
    await page.evaluate(() => {
      const container = document.querySelector('div.button-container');
      if (container) {
        const buttons = container.querySelectorAll('button');
        if (buttons[1]) buttons[1].click();
      }
    });
    
    // 15. Esperar descarga
    let downloaded = false;
    let fileName = '';
    
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const files = await fs.readdir(downloadPath);
      const xmlFile = files.find(f =>
        (f.endsWith('.xml') || f.endsWith('.zip')) &&
        !f.endsWith('.crdownload') &&
        !f.endsWith('.tmp')
      );
      
      if (xmlFile) {
        fileName = xmlFile;
        downloaded = true;
        break;
      }
    }
    
    if (!downloaded) {
      throw new Error('❌ Timeout esperando descarga');
    }
    
    console.log(`✅ XML descargado: ${fileName}\n`);
    
    // Leer archivo
    const filePath = path.join(downloadPath, fileName);
    const buffer = await fs.readFile(filePath);
    console.log(`Tamaño: ${buffer.length} bytes`);
    
    console.log('\n========================================');
    console.log('✅ ¡ÉXITO! SCRAPING COMPLETO FUNCIONA');
    console.log('========================================\n');
    
    console.log('Esperando 10 segundos...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testJWTScraping();
