/**
 * Test rápido para verificar que @sparticuz/chromium funcione
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

async function testChromium() {
  console.log('🧪 Probando @sparticuz/chromium...\n');
  
  try {
    // Obtener path de Chromium
    console.log('1. Obteniendo executablePath...');
    const executablePath = await chromium.executablePath();
    console.log(`   ✅ Path: ${executablePath}\n`);
    
    // Obtener args
    console.log('2. Args de Chromium:');
    console.log(`   ${chromium.args.join(' ')}\n`);
    
    // Intentar lanzar browser
    console.log('3. Lanzando browser...');
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: chromium.args,
    });
    console.log('   ✅ Browser lanzado correctamente\n');
    
    // Crear página y navegar
    console.log('4. Navegando a página de prueba...');
    const page = await browser.newPage();
    await page.goto('https://example.com', { waitUntil: 'networkidle2', timeout: 10000 });
    const title = await page.title();
    console.log(`   ✅ Título: ${title}\n`);
    
    // Cerrar
    await browser.close();
    console.log('5. ✅ Browser cerrado\n');
    
    console.log('✅ ÉXITO: @sparticuz/chromium funciona correctamente');
    console.log('   Esto significa que el scraping DEBERÍA funcionar en Railway\n');
    
    return true;
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('\nStack:', error.stack);
    return false;
  }
}

testChromium().then(success => {
  process.exit(success ? 0 : 1);
});
