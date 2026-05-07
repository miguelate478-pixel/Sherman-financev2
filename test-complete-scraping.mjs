// Test completo de scraping de XML desde SUNAT
import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

// Datos de una factura real para probar
const testInvoice = {
  rucEmisor: '20508565934', // Hipermercados Tottus
  tipoComprobante: '01', // Factura
  serie: 'FJ88',
  numero: '30587',
};

async function tryMultipleSelectors(page, selectors, action, value) {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        if (action === 'click') {
          await element.click();
        } else if (action === 'type' && value) {
          await element.type(value, { delay: 100 });
        } else if (action === 'select' && value) {
          await page.select(selector, value);
        }
        console.log(`✅ Selector funcionó: ${selector}`);
        return true;
      }
    } catch (error) {
      // Continuar con el siguiente selector
    }
  }
  return false;
}

async function testCompleteScraping() {
  console.log('=== Test Completo de Scraping de XML ===\n');
  console.log(`Factura a buscar: ${testInvoice.serie}-${testInvoice.numero}`);
  console.log(`RUC Emisor: ${testInvoice.rucEmisor}\n`);

  let browser;
  const downloadPath = path.join(process.cwd(), 'temp-downloads');
  
  try {
    // Crear directorio de descargas
    await fs.mkdir(downloadPath, { recursive: true });
    
    const chromiumPath = process.env.CHROMIUM_PATH || 
                        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: false,
      args: ['--no-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // 1. Login
    console.log('[1/5] Iniciando sesión...');
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
    
    // 1.5. Hacer clic en "Empresas"
    console.log('[1.5/5] Seleccionando opción "Empresas"...');
    
    await page.screenshot({ path: 'step0-after-login.png' });
    console.log('📸 Screenshot: step0-after-login.png\n');
    
    // Buscar y hacer clic en "Empresas"
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
      console.log('⚠️  No se encontró la opción "Empresas", continuando...');
    } else {
      console.log('✅ Clic en "Empresas" realizado');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    await page.screenshot({ path: 'step0.5-after-empresas.png' });
    console.log('📸 Screenshot: step0.5-after-empresas.png\n');
    
    // 2. Navegar a consulta de comprobantes
    console.log('[2/5] Navegando a consulta de comprobantes...');
    
    let navigationSuccess = false;
    
    // Método 1: Hacer clic en "Consulta de Facturas y Notas Electrónicas" del menú
    try {
      const menuClicked = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('a, div, span'));
        const consultaEl = elements.find(el => {
          const text = el.textContent?.trim();
          return text?.includes('Consulta de Facturas') && text?.includes('Electrónicas');
        });
        
        if (consultaEl) {
          consultaEl.click();
          return true;
        }
        return false;
      });
      
      if (menuClicked) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        navigationSuccess = true;
        console.log('✅ Clic en menú "Consulta de Facturas" exitoso');
      }
    } catch (error) {
      console.log('⚠️  Clic en menú falló');
    }
    
    // Método 2: Navegación directa por URL
    if (!navigationSuccess) {
      try {
        await page.goto(
          'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=iconExecute&code=11.5.3.1.2',
          {
            waitUntil: 'networkidle2',
            timeout: 30000,
          }
        );
        await new Promise(resolve => setTimeout(resolve, 2000));
        navigationSuccess = true;
        console.log('✅ Navegación directa exitosa');
      } catch (error) {
        console.log('⚠️  Navegación directa falló');
      }
    }
    
    if (!navigationSuccess) {
      throw new Error('No se pudo navegar a la página de consulta');
    }
    
    await page.screenshot({ path: 'step1-after-navigation.png' });
    console.log('📸 Screenshot: step1-after-navigation.png\n');
    
    // 3. Buscar formulario
    console.log('[3/5] Buscando formulario...');
    
    // Esperar un poco más para que cargue el iframe
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Buscar en todos los frames
    const frames = page.frames();
    console.log(`Frames disponibles: ${frames.length}`);
    
    let targetFrame = page.mainFrame();
    let formFound = false;
    
    // Buscar el frame que contiene el formulario
    for (const frame of frames) {
      try {
        const url = frame.url();
        console.log(`  Revisando frame: ${url.substring(0, 80)}...`);
        
        // Intentar encontrar el formulario en este frame
        const formSelectors = [
          'form[name="frmConsulta"]',
          '#frmConsulta',
          'form[name="formConsulta"]',
          'form[name="consultaForm"]',
          'form',
        ];
        
        for (const selector of formSelectors) {
          try {
            const element = await frame.$(selector);
            if (element) {
              console.log(`✅ Formulario encontrado en frame: ${selector}`);
              targetFrame = frame;
              formFound = true;
              break;
            }
          } catch (error) {
            // Continuar
          }
        }
        
        if (formFound) break;
      } catch (error) {
        // Continuar con el siguiente frame
      }
    }
    
    if (!formFound) {
      await page.screenshot({ path: 'error-no-form.png' });
      
      // Mostrar contenido de todos los frames para debug
      console.log('\n🔍 Contenido de los frames:');
      for (let i = 0; i < frames.length; i++) {
        try {
          const frame = frames[i];
          const content = await frame.content();
          console.log(`\nFrame ${i} (${frame.url().substring(0, 60)}...):`);
          console.log(`  Longitud: ${content.length} caracteres`);
          
          // Buscar palabras clave
          const hasForm = content.includes('<form');
          const hasInput = content.includes('<input');
          const hasRuc = content.toLowerCase().includes('ruc');
          const hasSerie = content.toLowerCase().includes('serie');
          
          console.log(`  Tiene <form>: ${hasForm}`);
          console.log(`  Tiene <input>: ${hasInput}`);
          console.log(`  Menciona 'ruc': ${hasRuc}`);
          console.log(`  Menciona 'serie': ${hasSerie}`);
        } catch (error) {
          console.log(`  Error al leer frame ${i}`);
        }
      }
      
      throw new Error('Formulario no encontrado en ningún frame');
    }
    
    // 4. Llenar formulario
    console.log('[4/5] Llenando formulario...');
    
    // Usar el targetFrame en lugar de page
    async function tryMultipleSelectorsinFrame(selectors, action, value) {
      for (const selector of selectors) {
        try {
          const element = await targetFrame.$(selector);
          if (element) {
            if (action === 'click') {
              await element.click();
            } else if (action === 'type' && value) {
              await element.type(value, { delay: 100 });
            } else if (action === 'select' && value) {
              await targetFrame.select(selector, value);
            }
            console.log(`✅ Selector funcionó: ${selector}`);
            return true;
          }
        } catch (error) {
          // Continuar con el siguiente selector
        }
      }
      return false;
    }
    
    // Tipo de comprobante
    const tipoSelectors = [
      '#cboTipoComprobante',
      'select[name="tipoComprobante"]',
      'select[name="tipo"]',
      'select[id*="tipo"]',
      'select[id*="Tipo"]',
    ];
    const tipoSelected = await tryMultipleSelectorsinFrame(
      tipoSelectors,
      'select',
      testInvoice.tipoComprobante
    );
    if (!tipoSelected) {
      console.log('⚠️  No se pudo seleccionar tipo de comprobante');
    }
    
    // RUC emisor
    const rucSelectors = [
      '#txtRucEmisor',
      'input[name="rucEmisor"]',
      'input[name="ruc"]',
      'input[id*="ruc"]',
      'input[id*="Ruc"]',
      'input[placeholder*="RUC"]',
    ];
    const rucFilled = await tryMultipleSelectorsinFrame(rucSelectors, 'type', testInvoice.rucEmisor);
    if (!rucFilled) {
      await page.screenshot({ path: 'error-no-ruc-field.png' });
      throw new Error('No se pudo llenar el campo RUC emisor');
    }
    
    // Serie
    const serieSelectors = [
      '#txtSerie',
      'input[name="serie"]',
      'input[id*="serie"]',
      'input[id*="Serie"]',
      'input[placeholder*="Serie"]',
    ];
    const serieFilled = await tryMultipleSelectorsinFrame(serieSelectors, 'type', testInvoice.serie);
    if (!serieFilled) {
      await page.screenshot({ path: 'error-no-serie-field.png' });
      throw new Error('No se pudo llenar el campo Serie');
    }
    
    // Número
    const numeroSelectors = [
      '#txtNumero',
      'input[name="numero"]',
      'input[id*="numero"]',
      'input[id*="Numero"]',
      'input[placeholder*="Número"]',
    ];
    const numeroFilled = await tryMultipleSelectorsinFrame(numeroSelectors, 'type', testInvoice.numero);
    if (!numeroFilled) {
      await page.screenshot({ path: 'error-no-numero-field.png' });
      throw new Error('No se pudo llenar el campo Número');
    }
    
    console.log('✅ Formulario llenado\n');
    await page.screenshot({ path: 'step2-form-filled.png' });
    console.log('📸 Screenshot: step2-form-filled.png\n');
    
    // Buscar
    console.log('Haciendo clic en Buscar...');
    const buscarSelectors = [
      '#btnBuscar',
      'button[name="buscar"]',
      'input[type="submit"]',
      'button[type="submit"]',
      'input[value*="Buscar"]',
      'button[value*="Buscar"]',
    ];
    const buscarClicked = await tryMultipleSelectorsinFrame(buscarSelectors, 'click');
    if (!buscarClicked) {
      await page.screenshot({ path: 'error-no-buscar-button.png' });
      throw new Error('No se pudo hacer clic en el botón Buscar');
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Búsqueda realizada\n');
    
    await page.screenshot({ path: 'step3-search-results.png' });
    console.log('📸 Screenshot: step3-search-results.png\n');
    
    // Verificar resultados
    const noResultsSelectors = [
      '.sinResultados',
      '.no-results',
      '.mensaje-error',
      '[class*="sin-resultado"]',
    ];
    
    let noResults = false;
    for (const selector of noResultsSelectors) {
      const element = await page.$(selector);
      if (element) {
        noResults = true;
        break;
      }
    }
    
    if (noResults) {
      throw new Error('Comprobante no encontrado en SUNAT');
    }
    
    console.log('✅ Factura encontrada\n');
    
    // 5. Descargar XML
    console.log('[5/5] Descargando XML...');
    
    // Configurar descarga
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath,
    });
    
    // Buscar botón de descarga
    const downloadSelectors = [
      '.btnDescargarXML',
      'a[title*="XML"]',
      'a[href*="xml"]',
      'button[title*="XML"]',
      'a[title*="Descargar"]',
      'button[title*="Descargar"]',
      '[class*="download"]',
      '[class*="descargar"]',
    ];
    
    const downloadClicked = await tryMultipleSelectors(page, downloadSelectors, 'click');
    if (!downloadClicked) {
      await page.screenshot({ path: 'error-no-download-button.png' });
      throw new Error('Botón de descarga XML no encontrado');
    }
    
    console.log('Esperando descarga...');
    
    // Esperar descarga
    let downloaded = false;
    let attempts = 0;
    let fileName = '';
    const maxAttempts = 30;
    
    while (!downloaded && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const files = await fs.readdir(downloadPath);
      const xmlFile = files.find(
        f =>
          (f.endsWith('.xml') || f.endsWith('.zip')) &&
          !f.endsWith('.crdownload') &&
          !f.endsWith('.tmp')
      );
      
      if (xmlFile) {
        fileName = xmlFile;
        downloaded = true;
      }
      
      attempts++;
    }
    
    if (!downloaded) {
      throw new Error('Timeout esperando descarga del XML');
    }
    
    console.log(`✅ XML descargado: ${fileName}\n`);
    
    // Leer archivo
    const filePath = path.join(downloadPath, fileName);
    const buffer = await fs.readFile(filePath);
    
    console.log(`Tamaño del archivo: ${buffer.length} bytes`);
    
    // Mostrar primeros 500 caracteres
    const content = buffer.toString('utf-8', 0, Math.min(500, buffer.length));
    console.log('\nPrimeros 500 caracteres del XML:');
    console.log('---');
    console.log(content);
    console.log('---\n');
    
    console.log('========================================');
    console.log('✅ ÉXITO: SCRAPING COMPLETO FUNCIONA');
    console.log('========================================');
    
    console.log('\nEsperando 10 segundos antes de cerrar...');
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

testCompleteScraping();
