const https = require('https');
async function req(method, path, body, token, ms=30000) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { hostname: 'sherman-financev2-production.up.railway.app', path, method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) }, timeout: ms };
    const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, raw: d.substring(0,2000) }); } }); });
    r.on('error', e => resolve({ status: 0, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
    if (bodyStr) r.write(bodyStr); r.end();
  });
}
async function run() {
  const login = await req('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = login.data?.data?.token;

  // Resetear ventas
  const docs = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-12', null, token);
  const ventas = (docs.data?.data || []).filter(d => d.op === 'VENTA');
  for (const d of ventas) await req('PATCH', '/api/documents', { id: d.id, parserStatus: 'PENDIENTE' }, token);
  console.log('Ventas reseteadas:', ventas.map(d => d.id));

  // PUT con logs detallados
  console.log('\nEjecutando PUT...');
  const t0 = Date.now();
  const r = await req('PUT', '/api/sunat/bulk-download',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', classifyWithAI: false },
    token, 120000);
  console.log(`Tiempo: ${((Date.now()-t0)/1000).toFixed(1)}s`);
  console.log('Status:', r.status);
  console.log('Response:', JSON.stringify(r.data || r.raw, null, 2));

  // Ver estado
  await new Promise(r => setTimeout(r, 1000));
  const after = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-12', null, token);
  console.log('\nVentas después:');
  (after.data?.data || []).filter(d => d.op === 'VENTA').forEach(d =>
    console.log(`  ${d.id} | parser=${d.parserStatus} | lineas=${d.lineas?.length||0}`));
}
run().catch(e => console.error('FATAL:', e.message));
