// Test de scraping de XML desde SUNAT
import puppeteer from 'puppeteer-core';

// Credenciales
const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

// Comprobante a descargar (Factura de Tottus)
const rucEmisor = '20508565934';
const tipo = '01';
const serie = 'FJ88';
const numero = '30587';

async function testScraping() {
  console.log('=== Test de Scraping de XML desde SUNAT ===\n');

  let browser;
  
  try {
    // 1. Iniciar navegador
    console.log('[1/5] Iniciando navegador...');
    
    const chromiumPath = process.env.CHROMIUM_PATH || 
                        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: false, // Visible para ver qué pasa
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    
    console.log('✅ Navegador iniciado\n');
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 2. Login en SUNAT
    console.log('[2/5] Iniciando sesión en SUNAT...');
    console.log(`   RUC: ${ruc}`);
    console.log(`   Usuario: ${solUser}`);
    
    await page.goto('https://e-factura.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    // Esperar formulario de login
    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    
    // Llenar formulario
    await page.type('#txtRuc', ruc, { delay: 100 });
    await page.type('#txtUsuario', solUser, { delay: 100 });
    await page.type('#txtContrasena', solPass, { delay: 100 });
    
    // Hacer clic en ingresar
    await page.click('#btnAceptar');
    
    // Esperar navegación
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    
    // Verificar si hay error de login
    const loginError = await page.$('.mensajeError');
    if (loginError) {
      const errorText = await page.evaluate(el => el?.textContent, loginError);
      throw new Error(`Error de login: ${errorText}`);
    }
    
    console.log('✅ Login exitoso\n');
    
    // 3. Ir a consulta de comprobantes recibidos
    console.log('[3/5] Navegando a consulta de comprobantes recibidos...');
    
    await page.goto('https://e-factura.sunat.gob.pe/cl-ti-itmenu/ConsultaComprobantesRecibidos.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    console.log('✅ En página de consulta\n');
    
    // 4. Buscar factura
    console.log('[4/5] Buscando factura...');
    console.log(`   RUC Emisor: ${rucEmisor}`);
    console.log(`   Tipo: ${tipo} (Factura)`);
    console.log(`   Serie-Número: ${serie}-${numero}`);
    
    // Esperar formulario
    await page.waitForSelector('#frmConsulta', { timeout: 10000 });
    
    // Llenar formulario de búsqueda
    await page.select('#cboTipoComprobante', tipo);
    await page.type('#txtRucEmisor', rucEmisor, { delay: 100 });
    await page.type('#txtSerie', serie, { delay: 100 });
    await page.type('#txtNumero', numero, { delay: 100 });
    
    // Buscar
    await page.click('#btnBuscar');
    
    // Esperar resultados
    await page.waitForSelector('.tablaResultados, .sinResultados', { timeout: 30000 });
    
    // Verificar si hay resultados
    const noResults = await page.$('.sinResultados');
    if (noResults) {
      throw new Error('Comprobante no encontrado en SUNAT');
    }
    
    console.log('✅ Factura encontrada\n');
    
    // 5. Descargar XML
    console.log('[5/5] Descargando XML...');
    
    // Buscar botón de descarga XML
    const downloadButton = await page.$('.btnDescargarXML, a[title*="XML"], a[href*="xml"]');
    
    if (!downloadButton) {
      console.log('⚠️  Botón de descarga no encontrado');
      console.log('Elementos disponibles en la página:');
      
      const buttons = await page.$$eval('button, a', elements => 
        elements.map(el => ({
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 50),
          class: el.className,
          title: el.title,
        }))
      );
      
      console.log(JSON.stringify(buttons, null, 2));
      
      throw new Error('Botón de descarga XML no encontrado');
    }
    
    console.log('✅ Botón de descarga encontrado');
    console.log('\n⚠️  NOTA: La descarga real requiere configurar el directorio de descargas');
    console.log('El scraping funciona correctamente hasta este punto.\n');
    
    // Esperar 5 segundos para que puedas ver la página
    console.log('Esperando 5 segundos para que veas la página...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n========================================');
    console.log('RESULTADO: ✅ SCRAPING FUNCIONA');
    console.log('========================================');
    console.log('El sistema puede:');
    console.log('  ✅ Iniciar sesión en SUNAT');
    console.log('  ✅ Navegar a consulta de comprobantes');
    console.log('  ✅ Buscar facturas específicas');
    console.log('  ✅ Encontrar botón de descarga XML');
    console.log('\nPróximo paso: Configurar descarga automática de archivos');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nStack:', error.stack);
  } finally {
    if (browser) {
      console.log('\nCerrando navegador...');
      await browser.close();
    }
  }
}

testScraping();
