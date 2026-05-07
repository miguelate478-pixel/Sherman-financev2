const https = require('https');

async function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'sherman-financev2-production.up.railway.app',
      path, method,
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
      timeout: 30000,
    };
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data.substring(0,500) }); } });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('TIMEOUT')); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function run() {
  const login = await req('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = login.data?.token;

  // Hacer descarga COMPRAS 2025-10 SIN includeDetails para ver cuántos docs devuelve SIRE
  console.log('Probando COMPRAS 2025-10 sin includeDetails...');
  const r1 = await req('POST', '/api/sunat/bulk-download', {
    companyId: 'sherman-inmobiliaria-01',
    periodFrom: '2025-10', periodTo: '2025-10',
    operation: 'COMPRAS',
    documentTypes: ['01','03','07','08'],
    includeDetails: false,
    classifyWithAI: false,
  }, token);
  console.log('totalDocs COMPRAS:', r1.data?.totalDocs, '| status:', r1.data?.status);

  // Ahora VENTAS 2025-10
  console.log('\nProbando VENTAS 2025-10 sin includeDetails...');
  const r2 = await req('POST', '/api/sunat/bulk-download', {
    companyId: 'sherman-inmobiliaria-01',
    periodFrom: '2025-10', periodTo: '2025-10',
    operation: 'VENTAS',
    documentTypes: ['01','03','07','08'],
    includeDetails: false,
    classifyWithAI: false,
  }, token);
  console.log('totalDocs VENTAS:', r2.data?.totalDocs, '| status:', r2.data?.status);

  // Ver cuántos docs hay ahora en 2025-10
  const docs = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-10', null, token);
  console.log('\nTotal docs en BD 2025-10:', docs.data?.length);
  console.log('COMPRAS:', docs.data?.filter(d => d.op === 'COMPRA').length);
  console.log('VENTAS:', docs.data?.filter(d => d.op === 'VENTA').length);

  // El problema: SIRE devuelve X docs, pero en BD ya hay Y docs
  // Si SIRE devuelve menos que BD, significa que SIRE no devuelve todos
  console.log('\n=== DIAGNÓSTICO ===');
  console.log('SIRE devolvió COMPRAS:', r1.data?.totalDocs, '| En BD:', docs.data?.filter(d => d.op === 'COMPRA').length);
  console.log('Si SIRE devuelve MENOS que BD → SIRE no devuelve docs ya procesados');
  console.log('Solución: necesitamos iterar sobre los docs de BD directamente para parsear XMLs');
}

run().catch(e => console.error('FATAL:', e.message));
