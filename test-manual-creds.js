// Test manual - ingresa tus credenciales actuales
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

// Comprobante a descargar (Factura de Tottus)
const rucEmisor = '20508565934';
const tipo = '01';
const serie = 'FJ88';
const numero = '30587';

async function run() {
  console.log('=== Test de descarga de XML con credenciales manuales ===\n');
  console.log('Ingresa las credenciales actuales de SUNAT:\n');
  
  const ruc = await question('RUC: ');
  const solUser = await question('Usuario SOL: ');
  const solPass = await question('Clave SOL: ');
  const clientId = await question('Client ID: ');
  const clientSecret = await question('Client Secret: ');
  
  rl.close();
  
  console.log('\n[1/2] Obteniendo token SIRE...');
  
  try {
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
      console.log('❌ Error al obtener token:');
      console.log(JSON.stringify(tokenData, null, 2));
      console.log('\n⚠️  Verifica que las credenciales sean correctas.');
      return;
    }
    
    const token = tokenData.access_token;
    console.log(`✅ Token obtenido exitosamente`);
    console.log(`   Expira en: ${tokenData.expires_in}s`);
    console.log(`   Token (primeros 50 chars): ${token.substring(0, 50)}...`);
    
    // Decodificar JWT
    const parts = token.split('.');
    const padded = parts[1] + '=='.slice((parts[1].length + 2) % 4 || 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    
    console.log('\n📋 Recursos autorizados:');
    const aud = JSON.parse(payload.aud);
    for (const api of aud) {
      console.log(`   ${api.api}`);
      for (const recurso of api.recurso) {
        console.log(`      - ${recurso.id}`);
      }
    }
    
    // 2. Probar endpoints
    console.log('\n[2/2] Probando endpoints de descarga de XML...\n');
    
    const endpoints = [
      {
        name: 'GEM - Comprobantes XML',
        url: `https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/${tipo}/${serie}/${numero}/${rucEmisor}/xml`,
      },
      {
        name: 'GEM - Comprobantes (sin /xml)',
        url: `https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/${tipo}/${serie}/${numero}/${rucEmisor}`,
      },
      {
        name: 'Control CPE - Consulta',
        url: `https://api-cpe.sunat.gob.pe/v1/contribuyente/controlcpe/consulta/${ruc}/${tipo}/${serie}/${numero}`,
      },
      {
        name: 'SIRE - Comprobante',
        url: `https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/comprobante/${rucEmisor}/${tipo}/${serie}/${numero}`,
      },
    ];
    
    for (const ep of endpoints) {
      console.log(`📍 ${ep.name}`);
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
        
        if (res.ok) {
          const body = await res.text();
          console.log(`   ✅ ÉXITO!`);
          console.log(`   Respuesta (primeros 500 chars):`);
          console.log(`   ${body.substring(0, 500)}`);
          
          try {
            const json = JSON.parse(body);
            console.log(`\n   📦 JSON completo:`);
            console.log(JSON.stringify(json, null, 2));
            
            // Si hay datos base64, guardar
            const base64Data = json.data || json.body?.data;
            if (base64Data) {
              const fs = await import('fs');
              const buffer = Buffer.from(base64Data, 'base64');
              const fileName = json.body?.fileName || `xml-${rucEmisor}-${tipo}-${serie}-${numero}.zip`;
              fs.writeFileSync(fileName, buffer);
              console.log(`\n   ✅ Archivo guardado: ${fileName}`);
              console.log(`   Tamaño: ${buffer.length} bytes`);
            }
          } catch {}
        } else {
          const errorBody = await res.text();
          console.log(`   ❌ Error:`);
          console.log(`   ${errorBody.substring(0, 300)}`);
        }
        
        console.log('');
      } catch (error) {
        console.log(`   ❌ Exception: ${error.message}\n`);
      }
    }
    
    console.log('\n========================================');
    console.log('RESULTADO:');
    console.log('========================================');
    console.log('Si todos los endpoints fallaron:');
    console.log('  → SUNAT no tiene API pública para descargar XMLs de proveedores');
    console.log('  → Usar ExcelNegocios.com o scraping del portal');
    console.log('\nSi algún endpoint funcionó:');
    console.log('  → ¡Perfecto! Implementar ese endpoint en la aplicación');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

run();
