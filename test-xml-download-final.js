// Test de descarga de XML desde SUNAT
const clientId     = 'f62b2812-1afb-4d70-8d74-7c444bdfae4c';
const clientSecret = 'e2bquIu+yJt1vREhnvoTHA==';
const ruc          = '20610169849';
const solUser      = 'SHERMAN1';
const solPass      = 'Sherman2026!';

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

  // 1. Obtener token SIRE
  console.log('\n[1/2] Obteniendo token SIRE...');
  const tokenRes = await fetch(`https://api-seguridad.sunat.gob.pe/v1/clientessol/${clientId}/oauth2/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'password',
      scope:         'https://api-sire.sunat.gob.pe',
      client_id:     clientId,
      client_secret: clientSecret,
      username:      `${ruc}${solUser}`,
      password:      solPass,
    }),
  });
  
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    console.log('❌ Error al obtener token:', tokenData);
    return;
  }
  
  const token = tokenData.access_token;
  console.log(`✅ Token obtenido exitosamente`);
  console.log(`   Expira en: ${tokenData.expires_in}s`);
  console.log(`   Token (primeros 50 chars): ${token.substring(0, 50)}...`);

  // 2. Intentar descargar XML
  console.log('\n[2/2] Descargando XML del comprobante...');
  const xmlUrl = `https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/${tipo}/${serie}/${numero}/${rucEmisor}/xml`;
  console.log(`   URL: ${xmlUrl}`);
  
  try {
    const xmlRes = await fetch(xmlUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
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
