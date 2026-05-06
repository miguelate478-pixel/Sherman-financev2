// Probar múltiples endpoints SUNAT con el token real
// usando el backend como proxy para no exponer credenciales
const https = require('https');

async function httpReq(method, path, body, token) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'sherman-financev2-production.up.railway.app',
      path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
      timeout: 30000,
    };
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, raw: data.substring(0, 500) }); }
      });
    });
    r.on('error', e => resolve({ status: 0, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function run() {
  const login = await httpReq('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = login.data?.data?.token;
  console.log('Token OK:', !!token);

  // Probar PUT con todos los docs de 2025-12 (13 docs)
  console.log('\n=== PUT parsear XMLs 2025-12 (limit=3) ===');
  const r1 = await httpReq('PUT', '/api/sunat/bulk-download',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', classifyWithAI: false, limit: 3 }, token);
  console.log('Status:', r1.status);
  console.log('Result:', JSON.stringify(r1.data || r1.raw));

  // Probar con 2025-10
  console.log('\n=== PUT parsear XMLs 2025-10 (limit=3) ===');
  const r2 = await httpReq('PUT', '/api/sunat/bulk-download',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-10', classifyWithAI: false, limit: 3 }, token);
  console.log('Status:', r2.status);
  console.log('Result:', JSON.stringify(r2.data || r2.raw));

  // Ver estado de docs después
  await new Promise(r => setTimeout(r, 1000));
  const docs = await httpReq('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-12', null, token);
  const docsArr = docs.data?.data || [];
  console.log('\n=== Estado docs 2025-12 después del PUT ===');
  docsArr.slice(0, 5).forEach(d => console.log(`  ${d.id} | parser=${d.parserStatus} | hasXml=${d.xml} | lineas=${d.lineas?.length||0}`));

  // Probar el endpoint SIRE de detalle directamente via el backend
  // Necesitamos un endpoint que haga proxy de la llamada SUNAT
  // Usamos el endpoint de SIRE que ya existe
  console.log('\n=== Probando endpoint SIRE propuesta (para ver qué devuelve) ===');
  const sire = await httpReq('POST', '/api/sunat/sire',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', tipo: 'RCE' }, token);
  console.log('SIRE propuesta status:', sire.status);
  console.log('SIRE propuesta:', JSON.stringify(sire.data || sire.raw).substring(0, 300));
}

run().catch(e => console.error('FATAL:', e.message));
