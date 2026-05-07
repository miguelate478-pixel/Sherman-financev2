// Test de descarga de XML usando el token de tu API
const APP_URL = 'https://sherman-financev2-production.up.railway.app';

// Comprobante a descargar (Factura de Tottus)
const rucEmisor = '20508565934';
const tipo = '01';
const serie = 'FJ88';
const numero = '30587';

async function run() {
  console.log('=== Prueba de descarga de XML desde SUNAT ===\n');
  console.log('Comprobante a descargar:');
  console.log(`  RUC Emisor: ${rucEmisor}`);
  console.log(`  Tipo: ${tipo} (Factura)`);
  console.log(`  Serie-Número: ${serie}-${numero}`);

  // 1. Login en tu aplicación
  console.log('\n[1/3] Autenticando en la aplicación...');
  const loginRes = await fetch(`${APP_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@shermaninmobiliaria.pe',
      password: 'Sherman2026!',
    }),
  });
  
  if (!loginRes.ok) {
    console.log('❌ Error al autenticar:', await loginRes.text());
    return;
  }
  
  const loginData = await loginRes.json();
  const appToken = loginData.data?.token;
  if (!appToken) {
    console.log('❌ No se obtuvo token de la aplicación');
    return;
  }
  console.log('✅ Autenticado en la aplicación');

  // 2. Obtener token SIRE desde tu API
  console.log('\n[2/3] Obteniendo token SIRE desde tu API...');
  const testRes = await fetch(`${APP_URL}/api/sunat/test-connection?companyId=1`, {
    headers: { 'Authorization': `Bearer ${appToken}` },
  });
  
  if (!testRes.ok) {
    console.log('❌ Error al obtener token SIRE:', await testRes.text());
    return;
  }
  
  const testData = await testRes.json();
  console.log('Respuesta de test-connection:', JSON.stringify(testData, null, 2).substring(0, 1000));
  
  const tokenBody = testData.data?.tokenResult?.body;
  if (!tokenBody) {
    console.log('❌ No se obtuvo token SIRE');
    console.log('Token result:', testData.data?.tokenResult);
    return;
  }
  
  const tokenJson = JSON.parse(tokenBody);
  const sireToken = tokenJson.access_token;
  console.log('✅ Token SIRE obtenido');
  console.log(`   Expira en: ${tokenJson.expires_in}s`);
  console.log(`   Token (primeros 50 chars): ${sireToken.substring(0, 50)}...`);

  // 3. Intentar descargar XML
  console.log('\n[3/3] Descargando XML del comprobante...');
  const xmlUrl = `https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/${tipo}/${serie}/${numero}/${rucEmisor}/xml`;
  console.log(`   URL: ${xmlUrl}`);
  
  try {
    const xmlRes = await fetch(xmlUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sireToken}`,
        'Accept': 'application/json',
        'Accept-Language': 'es-419,es;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://e-factura.sunat.gob.pe',
        'Referer': 'https://e-factura.sunat.gob.pe/',
      },
    });
    
    console.log(`   HTTP Status: ${xmlRes.status} ${xmlRes.statusText}`);
    
    if (!xmlRes.ok) {
      const errorText = await xmlRes.text();
      console.log('\n❌ Error al descargar XML:');
      console.log('========================================');
      console.log(errorText);
      console.log('========================================');
      return;
    }
    
    const xmlData = await xmlRes.json();
    console.log('\n✅ XML descargado exitosamente');
    console.log('\n========================================');
    console.log('RESPUESTA DE SUNAT:');
    console.log('========================================');
    console.log(JSON.stringify(xmlData, null, 2));
    console.log('========================================');
    
    // Si hay datos base64, guardar el archivo
    const base64Data = xmlData.data || xmlData.body?.data;
    if (base64Data) {
      const fs = require('fs');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = xmlData.body?.fileName || `xml-${rucEmisor}-${tipo}-${serie}-${numero}.zip`;
      fs.writeFileSync(fileName, buffer);
      console.log(`\n✅ Archivo guardado: ${fileName}`);
      console.log(`   Tamaño: ${buffer.length} bytes`);
    }
    
  } catch (error) {
    console.log('\n❌ Error:', error.message);
  }
}

run().catch(console.error);
