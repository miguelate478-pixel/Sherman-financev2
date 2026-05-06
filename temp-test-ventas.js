const https = require('https');

async function req(method, path, body, token, timeoutMs = 30000) {
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
      timeout: timeoutMs,
    };
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, raw: data.substring(0, 2000) }); }
      });
    });
    r.on('error', e => resolve({ status: 0, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function run() {
  const login = await req('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = login.data?.data?.token;
  console.log('Token OK:', !!token);

  // Ver todos los docs de 2025-12
  const docs = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-12', null, token);
  const allDocs = docs.data?.data || [];
  console.log('\n=== Docs 2025-12 ===');
  allDocs.forEach(d => console.log(`  ${d.id} | op=${d.op} | parser=${d.parserStatus}`));

  // Resetear VENTAS a PENDIENTE
  const ventas = allDocs.filter(d => d.op === 'VENTA');
  console.log(`\nVentas encontradas: ${ventas.length}`);
  for (const d of ventas) {
    await req('PATCH', '/api/documents', { id: d.id, parserStatus: 'PENDIENTE' }, token);
    console.log(`  Reseteado: ${d.id}`);
  }

  // Ejecutar PUT
  console.log('\n=== Ejecutando PUT (solo ventas pendientes) ===');
  console.log('Esperando respuesta...');
  const t0 = Date.now();
  const result = await req('PUT', '/api/sunat/bulk-download',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', classifyWithAI: false },
    token, 120000);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n=== RESPUESTA (${elapsed}s) ===`);
  console.log(JSON.stringify(result.data || result.raw, null, 2));

  // Ver estado después
  await new Promise(r => setTimeout(r, 2000));
  const after = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-12', null, token);
  const afterDocs = after.data?.data || [];
  console.log('\n=== Estado ventas después ===');
  afterDocs.filter(d => d.op === 'VENTA').forEach(d => {
    console.log(`  ${d.id} | parser=${d.parserStatus} | hasXml=${d.xml} | lineas=${d.lineas?.length||0}`);
    if (d.lineas?.length > 0) {
      d.lineas.slice(0,2).forEach(l => console.log(`    L${l.n}: "${l.desc}" qty=${l.qty} total=${l.total_l}`));
    }
  });
}

run().catch(e => console.error('FATAL:', e.message));
