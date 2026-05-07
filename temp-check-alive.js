const https = require('https');
function req(path) {
  return new Promise((resolve) => {
    const r = https.request({ hostname: 'sherman-financev2-production.up.railway.app', path, method: 'GET', timeout: 10000 }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d.substring(0, 200) }));
    });
    r.on('error', e => resolve({ status: 0, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
    r.end();
  });
}
async function run() {
  console.log('Probando app...');
  const r = await req('/');
  console.log('Status:', r.status, '| Error:', r.error || 'none');
  console.log('Body:', r.body?.substring(0, 100));
}
run();
