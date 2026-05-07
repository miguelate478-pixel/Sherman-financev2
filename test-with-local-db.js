// Test usando credenciales desde la base de datos local
import Database from 'better-sqlite3';
import crypto from 'crypto';

// Función decrypt copiada de tu código
function decrypt(encrypted, iv, authTag) {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'sherman-encrypt-key-exactly-32b!';
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'utf8'), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Comprobante a descargar (Factura de Tottus)
const rucEmisor = '20508565934';
const tipo = '01';
const serie = 'FJ88';
const numero = '30587';

async function run() {
  console.log('=== Test de descarga de XML usando credenciales de la BD local ===\n');

  // 1. Leer credenciales de la BD
  console.log('[1/3] Leyendo credenciales desde dev.db...');
  const db = new Database('./dev.db');
  
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(1);
  if (!company) {
    console.log('❌ No se encontró la empresa con ID 1');
    return;
  }
  
  const cred = db.prepare('SELECT * FROM sunat_credentials WHERE companyId = ?').get(1);
  if (!cred) {
    console.log('❌ No se encontraron credenciales SUNAT para la empresa');
    return;
  }
  
  console.log('✅ Credenciales encontradas:');
  console.log(`   RUC: ${company.ruc}`);
  console.log(`   Usuario SOL: ${cred.solUser}`);
  console.log(`   Client ID: ${cred.clientId}`);
  
  // Desencriptar credenciales
  const solPass = decrypt(cred.encryptedPass, cred.iv, cred.authTag);
  
  let clientSecret = null;
  if (cred.encClientSecret) {
    try {
      const p = JSON.parse(cred.encClientSecret);
      clientSecret = decrypt(p.enc, p.iv, p.tag);
    } catch (e) {
      console.log('⚠️  Error al desencriptar client secret:', e.message);
    }
  }
  
  if (!clientSecret) {
    console.log('❌ No se pudo obtener el client secret');
    return;
  }
  
  console.log('✅ Credenciales desencriptadas correctamente');
  
  // 2. Obtener token SIRE
  console.log('\n[2/3] Obteniendo token SIRE...');
  const tokenRes = await fetch(`https://api-seguridad.sunat.gob.pe/v1/clientessol/${cred.clientId}/oauth2/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'password',
      scope:         'https://api-sire.sunat.gob.pe',
      client_id:     cred.clientId,
      client_secret: clientSecret,
      username:      `${company.ruc}${cred.solUser}`,
      password:      solPass,
    }),
  });
  
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    console.log('❌ Error al obtener token:', tokenData);
    console.log('\n⚠️  Esto significa que las credenciales en la BD están desactualizadas.');
    console.log('Ve a tu aplicación web y actualiza las credenciales SUNAT.');
    return;
  }
  
  const token = tokenData.access_token;
  console.log(`✅ Token obtenido exitosamente`);
  console.log(`   Expira en: ${tokenData.expires_in}s`);
  console.log(`   Token (primeros 50 chars): ${token.substring(0, 50)}...`);
  
  // Decodificar JWT para ver recursos autorizados
  const parts = token.split('.');
  const padded = parts[1] + '=='.slice((parts[1].length + 2) % 4 || 4);
  const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  
  console.log('\n📋 Recursos autorizados en el token:');
  const aud = JSON.parse(payload.aud);
  for (const api of aud) {
    console.log(`   API: ${api.api}`);
    for (const recurso of api.recurso) {
      console.log(`      - ${recurso.id}`);
    }
  }
  
  // 3. Probar diferentes endpoints
  console.log('\n[3/3] Probando endpoints de descarga de XML...\n');
  
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
      url: `https://api-cpe.sunat.gob.pe/v1/contribuyente/controlcpe/consulta/${company.ruc}/${tipo}/${serie}/${numero}`,
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
        console.log(`   ✅ ÉXITO - Respuesta (primeros 500 chars):`);
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
  console.log('CONCLUSIÓN:');
  console.log('========================================');
  console.log('Si todos los endpoints fallan, significa que:');
  console.log('1. SUNAT no tiene API pública para descargar XMLs de proveedores');
  console.log('2. Se requiere usar servicios de terceros como ExcelNegocios.com');
  console.log('3. O se debe descargar desde el portal web (scraping)');
  
  db.close();
}

run().catch(console.error);
