const https = require('https');
async function req(method, path, body, token) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { hostname: 'sherman-financev2-production.up.railway.app', path, method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) }, timeout: 15000 };
    const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d.substring(0,3000) }); } }); });
    r.on('error', e => resolve({ error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ error: 'TIMEOUT' }); });
    if (bodyStr) r.write(bodyStr); r.end();
  });
}
async function run() {
  const login = await req('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = login.data?.token;
  const diag = await req('POST', '/api/sunat/test-connection', {}, token);
  const d = diag.data || diag;
  console.log('=== DIAGNÓSTICO SISTEMA RAILWAY ===\n');
  console.log('ENV:', JSON.stringify(d.env, null, 2));
  console.log('\nRutas fijas:', d.fixedPaths?.filter(p => p.exists).map(p => p.path));
  console.log('which:', JSON.stringify(d.which, null, 2));
  console.log('\nnixStore:', d.nixStore || '(vacío)');
  console.log('findNix:', d.findNix || '(vacío)');
  console.log('usrBin:', d.usrBin || '(vacío)');
  console.log('dpkg:', d.dpkg || '(vacío)');
  console.log('puppeteerCore:', d.puppeteerCore);
}
run().catch(e => console.error(e.message));
