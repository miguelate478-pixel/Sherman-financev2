const https = require('https');
async function req(method, path, body, token) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { hostname: 'sherman-financev2-production.up.railway.app', path, method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) }, timeout: 15000 };
    const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d.substring(0,500) }); } }); });
    r.on('error', e => resolve({ error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ error: 'TIMEOUT' }); });
    if (bodyStr) r.write(bodyStr); r.end();
  });
}
async function run() {
  const login = await req('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = login.data?.token;
  // El nuevo código tiene hasClientSecret en GET credentials
  const cred = await req('GET', '/api/sunat/credentials?companyId=sherman-inmobiliaria-01', null, token);
  console.log('hasClientSecret (nuevo código):', cred.data?.hasClientSecret);
  // El nuevo código PUT devuelve total=3 (solo ventas pendientes), no 13
  // Si devuelve 13, es el código viejo
  console.log('\nVersión activa:');
  console.log('  hasClientSecret en cred:', 'hasClientSecret' in (cred.data || {}));
  console.log('  Commit local:', '3ff347c');
}
run().catch(e => console.error(e.message));
