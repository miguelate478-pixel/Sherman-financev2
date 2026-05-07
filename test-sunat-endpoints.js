// Test de diferentes endpoints de SUNAT para descargar XMLs
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
  console.log('=== Investigación de endpoints SUNAT para descarga de XML ===\n');

  // 1. Obtener token SIRE
  console.log('[1/2] Obteniendo token SIRE...');
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
    console.log('\n⚠️  Las credenciales en temp-sire-test.js pueden haber expirado.');
    console.log('Necesitas actualizar:');
    console.log('  - clientSecret');
    console.log('  - solPass (Clave SOL)');
    return;
  }
  
  const token = tokenData.access_token;
  console.log(`✅ Token obtenido exitosamente`);
  console.log(`   Expira en: ${tokenData.expires_in}s\n`);

  // Decodificar JWT para ver qué recursos están autorizados
  const parts = token.split('.');
  const padded = parts[1] + '=='.slice((parts[1].length + 2) % 4 || 4);
  const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  
  console.log('📋 Recursos autorizados en el token:');
  console.log(JSON.stringify(JSON.parse(payload.aud), null, 2));
  console.log('');

  // 2. Probar diferentes endpoints
  console.log('[2/2] Probando diferentes endpoints...\n');
  
  const endpoints = [
    {
      name: 'GEM - Comprobantes XML',
      url: `https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/${tipo}/${serie}/${numero}/${rucEmisor}/xml`,
      description: 'Endpoint para descargar XML de comprobantes',
    },
    {
      name: 'GEM - Comprobantes (sin /xml)',
      url: `https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/${tipo}/${serie}/${numero}/${rucEmisor}`,
      description: 'Endpoint sin especificar formato',
    },
    {
      name: 'Control CPE - Consulta',
      url: `https://api-cpe.sunat.gob.pe/v1/contribuyente/controlcpe/consulta/${ruc}/${tipo}/${serie}/${numero}`,
      description: 'Endpoint de consulta de comprobantes propios',
    },
    {
      name: 'SIRE - Consulta Comprobante',
      url: `https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/comprobante/${rucEmisor}/${tipo}/${serie}/${numero}`,
      description: 'Endpoint SIRE para consultar comprobantes',
    },
  ];

  for (const ep of endpoints) {
    console.log(`\n📍 ${ep.name}`);
    console.log(`   ${ep.description}`);
    console.log(`   URL: ${ep.url}`);
    
    try {
      const res = await fetch(ep.url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Accept-Language': 'es-419,es;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://e-factura.sunat.gob.pe',
          'Referer': 'https://e-factura.sunat.gob.pe/',
        },
      });
      
      console.log(`   HTTP: ${res.status} ${res.statusText}`);
      
      const contentType = res.headers.get('content-type');
      console.log(`   Content-Type: ${contentType}`);
      
      if (res.ok) {
        const body = await res.text();
        console.log(`   ✅ ÉXITO - Respuesta (primeros 500 chars):`);
        console.log(`   ${body.substring(0, 500)}`);
        
        // Intentar parsear como JSON
        try {
          const json = JSON.parse(body);
          console.log(`   📦 JSON parseado:`);
          console.log(JSON.stringify(json, null, 2).substring(0, 1000));
        } catch {}
      } else {
        const errorBody = await res.text();
        console.log(`   ❌ Error - Respuesta:`);
        console.log(`   ${errorBody.substring(0, 300)}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Exception: ${error.message}`);
    }
  }
  
  console.log('\n\n========================================');
  console.log('CONCLUSIÓN:');
  console.log('========================================');
  console.log('Si ningún endpoint funciona, significa que:');
  console.log('1. SUNAT no tiene API pública para descargar XMLs de proveedores');
  console.log('2. Se requiere usar servicios de terceros como ExcelNegocios.com');
  console.log('3. O se debe descargar desde el portal web de SUNAT (scraping)');
}

run().catch(console.error);
