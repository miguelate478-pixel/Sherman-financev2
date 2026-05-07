// Test directo contra SUNAT para verificar scopes correctos
// Ejecutar con: node temp-sunat-test.js CLIENT_ID CLIENT_SECRET

const clientId = process.argv[2];
const clientSecret = process.argv[3];

if (!clientId || !clientSecret) {
  console.log('Uso: node temp-sunat-test.js <CLIENT_ID> <CLIENT_SECRET>');
  process.exit(1);
}

const API_BASE = 'https://api-seguridad.sunat.gob.pe/v1';
const VALIDATE_BASE = 'https://api.sunat.gob.pe/v1';

const scopes = [
  'https://api.sunat.gob.pe/v1/contribuyente/controlcpe',
  'https://api.sunat.gob.pe/v1/contribuyente/contribuyentes',
  'https://api.sunat.gob.pe/v1/contribuyente/migeigv',
];

async function testScope(scope) {
  try {
    const res = await fetch(`${API_BASE}/clientesextranet/${clientId}/oauth2/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    
    if (res.ok && data.access_token) {
      console.log(`✅ SCOPE OK: ${scope}`);
      console.log(`   Token: ${data.access_token.slice(0,30)}...`);
      return data.access_token;
    } else {
      console.log(`❌ SCOPE FALLO: ${scope}`);
      console.log(`   HTTP ${res.status}: ${JSON.stringify(data)}`);
      return null;
    }
  } catch(e) {
    console.log(`❌ ERROR: ${scope} → ${e.message}`);
    return null;
  }
}

async function run() {
  console.log(`\n🔍 Probando Client ID: ${clientId}\n`);
  
  for (const scope of scopes) {
    const token = await testScope(scope);
    if (token) {
      // Si obtenemos token, probar el endpoint de validación
      console.log(`\n   Probando endpoint de validación con este token...`);
      try {
        const r = await fetch(`${VALIDATE_BASE}/contribuyente/controlcpe/20610169849/validarcomprobante`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ numRuc: '20100066603', codComp: '01', numeroSerie: 'F001', numero: '1234', fechaEmision: '2026-04-01', monto: '11800' }),
          signal: AbortSignal.timeout(8000),
        });
        const rd = await r.json();
        console.log(`   Validación HTTP ${r.status}:`, JSON.stringify(rd).slice(0, 100));
      } catch(e) {
        console.log(`   Validación error: ${e.message}`);
      }
    }
    console.log('');
  }
}

run();