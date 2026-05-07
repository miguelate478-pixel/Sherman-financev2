// Test simple siguiendo el flujo exacto
import puppeteer from 'puppeteer-core';

const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

async function testSimpleFlow() {
  console.log('=== Test Flujo Simple ===\n');

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
    
    // PASO 1: Login
    console.log('[1/4] Login...');
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    await page.waitForSelector('#txtRuc');
    await page.type('#txtRuc', ruc);
    await page.type('#txtUsuario', solUser);
    await page.type('#txtContrasena', solPass);
    await page.click('#btnAceptar');
    
    await new Promise(resolve => setTimeout(resolve, 4000));
    await page.screenshot({ path: 'flow-1-after-login.png', fullPage: true });
    console.log('✅ Login - Screenshot: flow-1-after-login.png\n');
    
    // PASO 2: Click en Empresas
    console.log('[2/4] Click en Empresas...');
    
    // Buscar el elemento "Empresas" en el menú lateral izquierdo
    const empresasClicked = await page.evaluate(() => {
      // Buscar en el menú lateral (generalmente tiene clase o id específico)
      const menuItems = Array.from(document.querySelectorAll('#divOpcionServicio1 a, #divOpcionServicio1 div, .nivel1 a, .nivel1 div, [class*="nivel1"] a, [class*="nivel1"] div'));
      
      for (const item of menuItems) {
        const text = item.textContent?.trim().toLowerCase();
        if (text === 'empresas') {
          console.log('Encontrado elemento Empresas:', item.className, item.id);
          item.click();
          return true;
        }
      }
      
      // Si no lo encuentra, buscar en todo el documento
      const allElements = Array.from(document.querySelectorAll('a, div, span, li'));
      for (const el of allElements) {
        const text = el.textContent?.trim().toLowerCase();
        if (text === 'empresas') {
          console.log('Encontrado Empresas en documento:', el.tagName, el.className);
          el.click();
          return true;
        }
      }
      
      return false;
    });
    
    if (!empresasClicked) {
      console.log('❌ No se encontró "Empresas"');
      
      // Listar todas las opciones del menú para debug
      const menuOptions = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('a, div[onclick], li'));
        return items
          .filter(el => {
            const text = el.textContent?.trim();
            return text && text.length > 2 && text.length < 50;
          })
          .map(el => el.textContent?.trim())
          .slice(0, 30);
      });
      
      console.log('Opciones del menú encontradas:');
      menuOptions.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));
      
      throw new Error('No se pudo hacer clic en Empresas');
    }
    
    console.log('✅ Click en Empresas realizado');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.screenshot({ path: 'flow-2-after-empresas.png', fullPage: true });
    console.log('📸 Screenshot: flow-2-after-empresas.png\n');
    
    // PASO 3: Click en "Consulta de Facturas y Notas Electrónicas"
    console.log('[3/4] Click en Consulta de Facturas...');
    
    // Escuchar nuevas páginas/ventanas
    const newPagePromise = new Promise(resolve => {
      browser.once('targetcreated', async target => {
        const newPage = await target.page();
        if (newPage) {
          console.log(`✅ Nueva ventana detectada: ${target.url()}`);
          resolve(newPage);
        }
      });
      
      // Timeout de 10 segundos
      setTimeout(() => resolve(null), 10000);
    });
    
    const consultaClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, div, span, li'));
      
      for (const el of elements) {
        const text = el.textContent?.trim();
        if (text && text.includes('Consulta de Facturas') && text.includes('Electrónicas')) {
          console.log('Encontrado:', text);
          el.click();
          return true;
        }
      }
      
      return false;
    });
    
    if (!consultaClicked) {
      console.log('❌ No se encontró "Consulta de Facturas"');
      throw new Error('No se pudo hacer clic en Consulta de Facturas');
    }
    
    console.log('✅ Click en Consulta de Facturas realizado');
    console.log('Esperando nueva ventana o contenido...');
    
    // Esperar nueva ventana
    const newPage = await newPagePromise;
    
    let targetPage = page;
    if (newPage) {
      console.log('✅ Se abrió una nueva ventana');
      targetPage = newPage;
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log('⚠️  No se detectó nueva ventana, usando página actual');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    await targetPage.screenshot({ path: 'flow-3-consulta-page.png', fullPage: true });
    console.log('📸 Screenshot: flow-3-consulta-page.png\n');
    
    // PASO 4: Buscar formulario en la página objetivo
    console.log('[4/4] Buscando formulario...');
    
    const mainPageContent = await targetPage.evaluate(() => {
      const forms = document.querySelectorAll('form');
      const inputs = document.querySelectorAll('input');
      const selects = document.querySelectorAll('select');
      const buttons = document.querySelectorAll('button, input[type="submit"]');
      
      // Buscar específicamente campos relacionados con consulta
      const allInputs = Array.from(document.querySelectorAll('input, select'));
      const relevantInputs = allInputs.filter(inp => {
        const name = (inp.name || '').toLowerCase();
        const id = (inp.id || '').toLowerCase();
        const placeholder = (inp.placeholder || '').toLowerCase();
        
        return name.includes('ruc') || name.includes('serie') || name.includes('numero') ||
               id.includes('ruc') || id.includes('serie') || id.includes('numero') ||
               placeholder.includes('ruc') || placeholder.includes('serie') || placeholder.includes('numero');
      });
      
      return {
        totalForms: forms.length,
        totalInputs: inputs.length,
        totalSelects: selects.length,
        totalButtons: buttons.length,
        relevantInputs: relevantInputs.map(inp => ({
          tag: inp.tagName,
          type: inp.type,
          name: inp.name,
          id: inp.id,
          placeholder: inp.placeholder,
        })),
        allInputs: allInputs.slice(0, 20).map(inp => ({
          tag: inp.tagName,
          type: inp.type,
          name: inp.name,
          id: inp.id,
          placeholder: inp.placeholder,
        })),
      };
    });
    
    console.log(`\nContenido de la página principal:`);
    console.log(`  Forms: ${mainPageContent.totalForms}`);
    console.log(`  Inputs: ${mainPageContent.totalInputs}`);
    console.log(`  Selects: ${mainPageContent.totalSelects}`);
    console.log(`  Buttons: ${mainPageContent.totalButtons}`);
    
    if (mainPageContent.relevantInputs.length > 0) {
      console.log(`\n✅ CAMPOS RELEVANTES ENCONTRADOS (${mainPageContent.relevantInputs.length}):`);
      mainPageContent.relevantInputs.forEach((inp, idx) => {
        console.log(`  ${idx + 1}. ${inp.tag} type="${inp.type}" name="${inp.name}" id="${inp.id}" placeholder="${inp.placeholder}"`);
      });
    } else {
      console.log(`\n⚠️  No se encontraron campos relevantes`);
      console.log(`\nPrimeros 20 inputs encontrados:`);
      mainPageContent.allInputs.forEach((inp, idx) => {
        console.log(`  ${idx + 1}. ${inp.tag} type="${inp.type}" name="${inp.name}" id="${inp.id}" placeholder="${inp.placeholder}"`);
      });
    }
    
    // PASO 5: Buscar formulario en frames de la página objetivo
    console.log('\n[5/4] Buscando formulario en frames...');
    
    const frames = targetPage.frames();
    console.log(`Total frames: ${frames.length}`);
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const url = frame.url();
      console.log(`\nFrame ${i}: ${url}`);
      
      try {
        // Obtener TODO el contenido del frame
        const content = await frame.content();
        console.log(`  Tamaño HTML: ${content.length} caracteres`);
        
        // Buscar formulario
        const hasForm = await frame.evaluate(() => {
          const forms = document.querySelectorAll('form');
          const inputs = document.querySelectorAll('input[type="text"], input[name*="ruc"], input[name*="serie"], input, select');
          const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
          
          // Buscar texto relevante
          const bodyText = document.body?.textContent || '';
          const hasConsulta = bodyText.toLowerCase().includes('consulta');
          const hasComprobante = bodyText.toLowerCase().includes('comprobante');
          const hasFactura = bodyText.toLowerCase().includes('factura');
          
          return {
            forms: forms.length,
            inputs: inputs.length,
            buttons: buttons.length,
            hasRuc: !!document.querySelector('input[name*="ruc"], input[id*="ruc"], input[name*="Ruc"], input[id*="Ruc"]'),
            hasSerie: !!document.querySelector('input[name*="serie"], input[id*="serie"], input[name*="Serie"], input[id*="Serie"]'),
            hasConsulta,
            hasComprobante,
            hasFactura,
          };
        });
        
        console.log(`  Forms: ${hasForm.forms}, Inputs: ${hasForm.inputs}, Buttons: ${hasForm.buttons}`);
        console.log(`  RUC: ${hasForm.hasRuc}, Serie: ${hasForm.hasSerie}`);
        console.log(`  Texto: consulta=${hasForm.hasConsulta}, comprobante=${hasForm.hasComprobante}, factura=${hasForm.hasFactura}`);
        
        if (hasForm.inputs > 0 || hasForm.hasConsulta) {
          console.log(`\n✅ CONTENIDO RELEVANTE EN FRAME ${i}`);
          
          // Listar todos los inputs
          const inputs = await frame.evaluate(() => {
            const allInputs = Array.from(document.querySelectorAll('input, select'));
            return allInputs.map(inp => ({
              tag: inp.tagName,
              type: inp.type,
              name: inp.name,
              id: inp.id,
              placeholder: inp.placeholder,
            }));
          });
          
          console.log('\nCampos encontrados:');
          inputs.forEach((inp, idx) => {
            console.log(`  ${idx + 1}. ${inp.tag} type="${inp.type}" name="${inp.name}" id="${inp.id}" placeholder="${inp.placeholder}"`);
          });
          
          // Listar botones
          const buttons = await frame.evaluate(() => {
            const allButtons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
            return allButtons.map(btn => ({
              tag: btn.tagName,
              type: btn.type,
              text: btn.textContent?.trim() || btn.value,
              id: btn.id,
            }));
          });
          
          console.log('\nBotones encontrados:');
          buttons.forEach((btn, idx) => {
            console.log(`  ${idx + 1}. ${btn.tag} type="${btn.type}" text="${btn.text}" id="${btn.id}"`);
          });
        }
      } catch (error) {
        console.log(`  ❌ Error al leer frame ${i}: ${error.message}`);
      }
    }
    
    console.log('\n========================================');
    console.log('Revisa los screenshots generados');
    console.log('========================================');
    
    console.log('\nEsperando 30 segundos...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testSimpleFlow();
