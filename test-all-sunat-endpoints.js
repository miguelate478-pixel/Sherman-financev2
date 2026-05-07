// Test completo de todos los endpoints SUNAT posibles
const clientId = 'f62b2812-1afb-4d70-8d74-7c444bdfae4c';
const clientSecret = 'e2bquIu+yJt1vREhnvoTHA==';
const ruc = '20610169849';
const solUser = 'SHERMAN1';
const solPass = 'Pepe2024';

// Comprobante de prueba (Factura de Tottus)
const rucEmisor = '20508565934';
const tipo = '01';
const serie = 'FJ88';
const numero = '30587';
const fecha = '2025-12-30';
const monto = '166.90';

async function run() {
  console.log('=== Test Completo de Endpoints SUNAT ===\n');
  
  // ========================================
  // 1. Obtener Token SIRE (scope: api-sire)
  // ========================================
  console.log('[1/5] Obteniendo token SIRE (scope: api-sire.sunat.gob.pe)...');
  const sireTokenRes = await fetch(
    `https://api-seguridad.sunat.gob.pe/v1/clientessol/${clientId}/oauth2/token/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        scope: 'https://api-sire.sunat.gob.pe',
        client_id: clientId,
        client_secret: clientSecret,
        username: `${ruc}${solUser}`,
        password: solPass,
      }),
    }
  );
  
  const sireTokenData = await sireTokenRes.json();
  if (!sireTokenRes.ok || !sireTokenData.access_token) {
    console.log('❌ Error obteniendo token SIRE:', sireTokenData);
    return;
  }
  
  const sireToken = sireTokenData.access_token;
  console.log(`✅ Token SIRE obtenido (${sireTokenData.expires_in}s)`);
  console.log(`   ${sireToken.substring(0, 50)}...\n`);
  
  // ========================================
  // 2. Obtener Token CPE (scope: api-cpe)
  // ========================================
  console.log('[2/5] Obteniendo token CPE (scope: api-cpe.sunat.gob.pe)...');
  const cpeTokenRes = await fetch(
    `https://api-seguridad.sunat.gob.pe/v1/clientesextranet/${clientId}/oauth2/token/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api-cpe.sunat.gob.pe',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }
  );
  
  let cpeToken = null;
  if (cpeTokenRes.ok) {
    const cpeTokenData = await cpeTokenRes.json();
    if (cpeTokenData.access_token) {
      cpeToken = cpeTokenData.access_token;
      console.log(`✅ Token CPE obtenido (${cpeTokenData.expires_in}s)`);
      console.log(`   ${cpeToken.substring(0, 50)}...\n`);
    } else {
      console.log('⚠️  Token CPE no disponible:', cpeTokenData, '\n');
    }
  } else {
    const errorText = await cpeTokenRes.text();
    console.log(`⚠️  Token CPE no disponible (${cpeTokenRes.status}):`, errorText.substring(0, 200), '\n');
  }
  
  // ========================================
  // 3. Endpoint: validarcomprobante con token SIRE
  // ========================================
  console.log('[3/5] Probando validarcomprobante con token SIRE...');
  console.log(`URL: https://api-cpe.sunat.gob.pe/v1/contribuyente/contribuyentes/${ruc}/validarcomprobante`);
  
  try {
    const validarRes = await fetch(
      `https://api-cpe.sunat.gob.pe/v1/contribuyente/contribuyentes/${ruc}/validarcomprobante`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sireToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numRuc: rucEmisor,
          codComp: tipo,
          numeroSerie: serie,
          numero: numero,
          fechaEmision: fecha,
          monto: monto,
        }),
      }
    );
    
    console.log(`HTTP: ${validarRes.status} ${validarRes.statusText}`);
    const validarBody = await validarRes.text();
    
    if (validarRes.ok) {
      console.log('✅ ÉXITO - Respuesta:');
      try {
        const json = JSON.parse(validarBody);
        console.log(JSON.stringify(json, null, 2));
      } catch {
        console.log(validarBody.substring(0, 1000));
      }
    } else {
      console.log('❌ Error:');
      console.log(validarBody.substring(0, 500));
    }
  } catch (e) {
    console.log('❌ Exception:', (e as Error).message);
  }
  console.log('');
  
  // ========================================
  // 4. Endpoint: validarcomprobante con token CPE
  // ========================================
  if (cpeToken) {
    console.log('[4/5] Probando validarcomprobante con token CPE...');
    console.log(`URL: https://api-cpe.sunat.gob.pe/v1/contribuyente/contribuyentes/${ruc}/validarcomprobante`);
    
    try {
      const validarCpeRes = await fetch(
        `https://api-cpe.sunat.gob.pe/v1/contribuyente/contribuyentes/${ruc}/validarcomprobante`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cpeToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            numRuc: rucEmisor,
            codComp: tipo,
            numeroSerie: serie,
            numero: numero,
            fechaEmision: fecha,
            monto: monto,
          }),
        }
      );
      
      console.log(`HTTP: ${validarCpeRes.status} ${validarCpeRes.statusText}`);
      const validarCpeBody = await validarCpeRes.text();
      
      if (validarCpeRes.ok) {
        console.log('✅ ÉXITO - Respuesta:');
        try {
          const json = JSON.parse(validarCpeBody);
          console.log(JSON.stringify(json, null, 2));
        } catch {
          console.log(validarCpeBody.substring(0, 1000));
        }
      } else {
        console.log('❌ Error:');
        console.log(validarCpeBody.substring(0, 500));
      }
    } catch (e) {
      console.log('❌ Exception:', (e as Error).message);
    }
    console.log('');
  } else {
    console.log('[4/5] Saltando validarcomprobante con token CPE (token no disponible)\n');
  }
  
  // ========================================
  // 5. Endpoint: GEM con RUC del receptor (no emisor)
  // ========================================
  if (cpeToken) {
    console.log('[5/5] Probando GEM con RUC del RECEPTOR (no emisor)...');
    console.log(`URL: https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/${tipo}/${serie}/${numero}/${ruc}/xml`);
    
    try {
      const gemReceptorRes = await fetch(
        `https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/${tipo}/${serie}/${numero}/${ruc}/xml`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cpeToken}`,
            'Accept': 'application/json',
          },
        }
      );
      
      console.log(`HTTP: ${gemReceptorRes.status} ${gemReceptorRes.statusText}`);
      const gemReceptorBody = await gemReceptorRes.text();
      
      if (gemReceptorRes.ok) {
        console.log('✅ ÉXITO - Respuesta:');
        console.log(gemReceptorBody.substring(0, 1000));
        
        try {
          const json = JSON.parse(gemReceptorBody);
          console.log('\n📦 JSON parseado:');
          console.log(JSON.stringify(json, null, 2));
          
          // Si hay base64, guardar
          const base64Data = json.data || json.body?.data;
          if (base64Data) {
            const fs = await import('fs');
            const buffer = Buffer.from(base64Data, 'base64');
            const fileName = json.body?.fileName || `xml-${ruc}-${tipo}-${serie}-${numero}.zip`;
            fs.writeFileSync(fileName, buffer);
            console.log(`\n✅ Archivo guardado: ${fileName} (${buffer.length} bytes)`);
          }
        } catch {}
      } else {
        console.log('❌ Error:');
        console.log(gemReceptorBody.substring(0, 500));
      }
    } catch (e) {
      console.log('❌ Exception:', (e as Error).message);
    }
    console.log('');
  } else {
    console.log('[5/5] Saltando GEM con RUC receptor (token CPE no disponible)\n');
  }
  
  // ========================================
  // BONUS: Probar otros endpoints posibles
  // ========================================
  console.log('\n=== BONUS: Otros endpoints posibles ===\n');
  
  const bonusEndpoints = [
    {
      name: 'GEM receptor con token SIRE',
      url: `https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/${tipo}/${serie}/${numero}/${ruc}/xml`,
      token: sireToken,
    },
    {
      name: 'Consulta CPE receptor',
      url: `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${ruc}/validarcomprobante`,
      token: sireToken,
      method: 'POST',
      body: {
        numRuc: rucEmisor,
        codComp: tipo,
        numeroSerie: serie,
        numero: numero,
        fechaEmision: fecha,
        monto: monto,
      },
    },
  ];
  
  for (const ep of bonusEndpoints) {
    console.log(`📍 ${ep.name}`);
    console.log(`   URL: ${ep.url}`);
    
    try {
      const options = {
        method: ep.method || 'GET',
        headers: {
          'Authorization': `Bearer ${ep.token}`,
          'Accept': 'application/json',
          ...(ep.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
      };
      
      const res = await fetch(ep.url, options);
      console.log(`   HTTP: ${res.status} ${res.statusText}`);
      
      if (res.ok) {
        const body = await res.text();
        console.log('   ✅ ÉXITO:');
        console.log(`   ${body.substring(0, 300)}`);
      } else {
        const errorBody = await res.text();
        console.log('   ❌ Error:');
        console.log(`   ${errorBody.substring(0, 200)}`);
      }
    } catch (e) {
      console.log(`   ❌ Exception: ${(e as Error).message}`);
    }
    console.log('');
  }
  
  console.log('\n========================================');
  console.log('RESUMEN:');
  console.log('========================================');
  console.log('Si algún endpoint funcionó:');
  console.log('  → Implementar ese endpoint en la aplicación');
  console.log('Si todos fallaron:');
  console.log('  → Usar ExcelNegocios.com o scraping');
}

run().catch(console.error);
