// Test para explorar la estructura del formulario de búsqueda
import puppeteer from 'puppeteer-core';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

async function testFormStructure() {
  console.log('=== Test de Estructura del Formulario ===\n');

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
    
    // 2. Navegar a consulta de facturas directamente por URL
    console.log('[2/3] Navegando a consulta de facturas...');
    
    // Intentar navegar directamente
    try {
      await page.goto(
        'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=iconExecute&code=11.5.3.1.2',
        {
          waitUntil: 'networkidle2',
          timeout: 30000,
        }
      );
    } catch (navError) {
      console.log('⚠️  Navegación directa falló, intentando con frame...');
      
      // Buscar si hay un iframe
      const frames = page.frames();
      console.log(`Frames encontrados: ${frames.length}`);
      
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const url = frame.url();
        console.log(`  Frame ${i}: ${url}`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ Navegación completada\n');
    
    // Verificar si hay iframes
    const frames = page.frames();
    console.log(`📦 Frames encontrados: ${frames.length}`);
    frames.forEach((frame, i) => {
      console.log(`  ${i}. ${frame.url()}`);
    });
    console.log('');
    
    // Buscar el frame correcto (el que tiene el formulario)
    let targetFrame = page.mainFrame();
    for (const frame of frames) {
      const url = frame.url();
      if (url.includes('consulta') || url.includes('comprobante') || url.includes('11.5.3.1.2')) {
        console.log(`✅ Frame objetivo encontrado: ${url}\n`);
        targetFrame = frame;
        break;
      }
    }
    
    // 3. Explorar estructura del formulario
    console.log('[3/3] Explorando formulario de búsqueda...\n');
    
    // Tomar screenshot
    await page.screenshot({ path: 'formulario-busqueda.png', fullPage: true });
    console.log('📸 Screenshot: formulario-busqueda.png\n');
    
    // Buscar todos los formularios en el frame correcto
    const forms = await targetFrame.evaluate(() => {
      const allForms = Array.from(document.querySelectorAll('form'));
      return allForms.map((form, i) => ({
        index: i,
        id: form.id,
        name: form.name,
        action: form.action,
        method: form.method,
      }));
    });
    
    console.log('📋 Formularios encontrados:');
    forms.forEach(form => {
      console.log(`  ${form.index + 1}. ID: ${form.id || 'N/A'}, Name: ${form.name || 'N/A'}`);
      console.log(`     Action: ${form.action || 'N/A'}`);
    });
    console.log('');
    
    // Buscar todos los inputs, selects y buttons en el frame correcto
    const formElements = await targetFrame.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
      
      return {
        inputs: inputs.map(el => ({
          tag: el.tagName,
          type: el.type,
          id: el.id,
          name: el.name,
          placeholder: el.placeholder,
          value: el.value,
          label: el.labels?.[0]?.textContent?.trim() || 
                 document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ||
                 el.parentElement?.textContent?.trim().substring(0, 50),
        })),
        buttons: buttons.map(btn => ({
          tag: btn.tagName,
          type: btn.type,
          id: btn.id,
          name: btn.name,
          text: btn.textContent?.trim() || btn.value,
          onclick: btn.onclick?.toString().substring(0, 100),
        })),
      };
    });
    
    console.log('📝 Campos del formulario:');
    formElements.inputs.forEach((input, i) => {
      console.log(`  ${i + 1}. ${input.tag} (${input.type})`);
      console.log(`     ID: ${input.id || 'N/A'}`);
      console.log(`     Name: ${input.name || 'N/A'}`);
      console.log(`     Label: ${input.label || 'N/A'}`);
      if (input.placeholder) console.log(`     Placeholder: ${input.placeholder}`);
      console.log('');
    });
    
    console.log('🔘 Botones:');
    formElements.buttons.forEach((btn, i) => {
      console.log(`  ${i + 1}. ${btn.text}`);
      console.log(`     ID: ${btn.id || 'N/A'}`);
      console.log(`     Type: ${btn.type || 'N/A'}`);
      console.log('');
    });
    
    // Buscar específicamente campos relacionados con RUC, serie, número
    console.log('🔍 Campos relevantes para búsqueda:');
    
    const relevantFields = await targetFrame.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('input, select'));
      
      const keywords = ['ruc', 'emisor', 'serie', 'numero', 'tipo', 'comprobante', 'fecha'];
      
      return allElements
        .filter(el => {
          const id = el.id?.toLowerCase() || '';
          const name = el.name?.toLowerCase() || '';
          const label = el.labels?.[0]?.textContent?.toLowerCase() || 
                       document.querySelector(`label[for="${el.id}"]`)?.textContent?.toLowerCase() || '';
          
          return keywords.some(kw => id.includes(kw) || name.includes(kw) || label.includes(kw));
        })
        .map(el => ({
          tag: el.tagName,
          type: el.type,
          id: el.id,
          name: el.name,
          label: el.labels?.[0]?.textContent?.trim() || 
                 document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ||
                 'N/A',
        }));
    });
    
    relevantFields.forEach((field, i) => {
      console.log(`  ${i + 1}. ${field.label}`);
      console.log(`     Tag: ${field.tag} (${field.type})`);
      console.log(`     ID: ${field.id || 'N/A'}`);
      console.log(`     Name: ${field.name || 'N/A'}`);
      console.log('');
    });
    
    // Buscar tabla de resultados
    console.log('📊 Buscando tabla de resultados...');
    const tables = await targetFrame.evaluate(() => {
      const allTables = Array.from(document.querySelectorAll('table'));
      return allTables.map((table, i) => ({
        index: i,
        id: table.id,
        class: table.className,
        rows: table.rows.length,
        headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim()),
      }));
    });
    
    if (tables.length > 0) {
      console.log('Tablas encontradas:');
      tables.forEach(table => {
        console.log(`  ${table.index + 1}. ID: ${table.id || 'N/A'}, Class: ${table.class || 'N/A'}`);
        console.log(`     Filas: ${table.rows}`);
        if (table.headers.length > 0) {
          console.log(`     Headers: ${table.headers.join(', ')}`);
        }
      });
    } else {
      console.log('  No se encontraron tablas (normal antes de buscar)');
    }
    
    console.log('\n========================================');
    console.log('RESULTADO: Revisa formulario-busqueda.png');
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

testFormStructure();
