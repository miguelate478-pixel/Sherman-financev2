const https = require('https');

async function req(method, path, body, token, ms = 180000) {
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
      timeout: ms,
    };
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, raw: data.substring(0, 3000) }); }
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

  console.log('\n=== Probando browser automation (PUT /api/sunat/sire) ===');
  console.log('Período: 2025-12 | Esperando hasta 3 minutos...\n');

  const t0 = Date.now();
  const result = await req('PUT', '/api/sunat/sire',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', maxDocs: 5 },
    token, 180000);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Tiempo: ${elapsed}s`);
  console.log('Status HTTP:', result.status);

  if (result.data) {
    console.log('\n=== RESULTADO ===');
    console.log('ok:', result.data.ok);
    console.log('error:', result.data.error);
    if (result.data.data) {
      console.log('parsed:', result.data.data.parsed);
      console.log('errors:', result.data.data.errors);
      console.log('total:', result.data.data.total);
      console.log('\n=== LOGS DEL BROWSER ===');
      (result.data.data.logs || []).forEach(l => console.log(' ', l));
    }
  } else {
    console.log('Raw:', result.raw || result.error);
  }
}

run().catch(e => console.error('FATAL:', e.message));
