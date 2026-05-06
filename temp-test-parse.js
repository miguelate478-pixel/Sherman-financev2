const https = require('https');

async function req(method, path, body, token) {
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
      timeout: 360000, // 6 min para el polling
    };
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, raw: data.substring(0, 1000) }); }
      });
    });
    r.on('error', e => resolve({ status: 0, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, error: 'TIMEOUT 6min' }); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function run() {
  // 1. Login
  const login = await req('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = login.data?.data?.token;
  console.log('Token OK:', !!token);

  // 2. Estado ANTES
  const before = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-12', null, token);
  const docs = before.data?.data || [];
  const byStatus = {};
  docs.forEach(d => { byStatus[d.parserStatus] = (byStatus[d.parserStatus]||0)+1; });
  console.log('\n=== ANTES 2025-12 ===');
  console.log('Por parserStatus:', JSON.stringify(byStatus));
  console.log('Total docs:', docs.length);

  // Resetear algunos docs a PENDIENTE para poder probar
  const sinXml = docs.filter(d => d.parserStatus === 'SIN_XML').slice(0, 3);
  if (sinXml.length > 0) {
    console.log(`\nReseteando ${sinXml.length} docs SIN_XML → PENDIENTE para re-probar...`);
    for (const d of sinXml) {
      await req('PATCH', '/api/documents', { id: d.id, parserStatus: 'PENDIENTE' }, token);
    }
  }

  // 3. Ejecutar PUT parsear XMLs
  console.log('\n=== Ejecutando PUT /api/sunat/bulk-download (parsear XMLs via SIRE ZIP) ===');
  console.log('Esto puede tardar 2-5 minutos (polling cada 5s)...');
  const t0 = Date.now();

  const result = await req('PUT', '/api/sunat/bulk-download',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', classifyWithAI: false },
    token);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== RESPUESTA (${elapsed}s) ===`);
  console.log('Status HTTP:', result.status);
  console.log(JSON.stringify(result.data || result.raw, null, 2));

  // 4. Estado DESPUÉS
  await new Promise(r => setTimeout(r, 2000));
  const after = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-12', null, token);
  const docsAfter = after.data?.data || [];
  const byStatusAfter = {};
  docsAfter.forEach(d => { byStatusAfter[d.parserStatus] = (byStatusAfter[d.parserStatus]||0)+1; });
  console.log('\n=== DESPUÉS 2025-12 ===');
  console.log('Por parserStatus:', JSON.stringify(byStatusAfter));

  // 5. Ver líneas de docs parseados
  const parseados = docsAfter.filter(d => d.parserStatus === 'PARSEADO');
  console.log(`\nDocs PARSEADOS: ${parseados.length}`);
  for (const d of parseados.slice(0, 3)) {
    console.log(`\n  ${d.id} | op=${d.op} | lineas=${d.lineas?.length || 0}`);
    if (d.lineas?.length > 0) {
      d.lineas.slice(0, 2).forEach(l => {
        console.log(`    L${l.n}: "${l.desc}" | qty=${l.qty} | total=${l.total_l}`);
      });
    }
  }
}

run().catch(e => console.error('FATAL:', e.message));
