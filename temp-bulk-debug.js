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
      timeout: 120000,
    };
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data.substring(0, 1000) }); } });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('TIMEOUT 120s')); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function run() {
  const login = await req('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = login.data?.token;
  console.log('Token OK:', !!token);

  // Verificar estado ANTES
  const before = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-10', null, token);
  const docs = before.data || [];
  console.log(`\n=== ANTES: ${docs.length} docs en 2025-10 ===`);
  docs.slice(0,3).forEach(d => console.log(`  ${d.id} | parser=${d.parserStatus} | lineas=${d.lineas?.length||0}`));

  // Ejecutar bulk download con includeDetails
  console.log('\n=== Ejecutando bulk download (puede tardar 60-90s)... ===');
  const t0 = Date.now();
  const result = await req('POST', '/api/sunat/bulk-download', {
    companyId: 'sherman-inmobiliaria-01',
    periodFrom: '2025-10',
    periodTo: '2025-10',
    operation: 'COMPRAS',
    documentTypes: ['01','03','07','08'],
    includeDetails: true,
    classifyWithAI: false,
  }, token);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n=== RESPUESTA (${elapsed}s) ===`);
  console.log(JSON.stringify(result, null, 2));

  // Verificar estado DESPUÉS
  await new Promise(r => setTimeout(r, 2000));
  const after = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-10', null, token);
  const docsAfter = after.data || [];
  console.log(`\n=== DESPUÉS: ${docsAfter.length} docs en 2025-10 ===`);
  docsAfter.forEach(d => console.log(`  ${d.id} | parser=${d.parserStatus} | hasXml=${d.xml} | lineas=${d.lineas?.length||0}`));

  // Ver detalle del primer doc
  if (docsAfter.length > 0) {
    const firstId = docsAfter[0].id;
    const detail = await req('GET', `/api/documents/${firstId}`, null, token);
    console.log(`\n=== Detalle ${firstId} ===`);
    console.log('parserStatus:', detail.data?.parserStatus);
    console.log('hasXml:', detail.data?.hasXml);
    console.log('lines count:', detail.data?.lines?.length || 0);
    if (detail.data?.lines?.length > 0) {
      console.log('Primera línea:', JSON.stringify(detail.data.lines[0], null, 2));
    }
  }
}

run().catch(e => console.error('FATAL:', e.message));
