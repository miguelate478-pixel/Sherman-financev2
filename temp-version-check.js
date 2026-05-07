const https = require('https');

// Verificar qué commit está en producción leyendo un endpoint que refleje el código actual
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
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, raw: data.substring(0, 500) }); } });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('TIMEOUT')); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function run() {
  const login = await req('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = login.body?.data?.token;

  // Verificar credenciales - el nuevo código devuelve hasClientSecret
  const cred = await req('GET', '/api/sunat/credentials?companyId=sherman-inmobiliaria-01', null, token);
  console.log('=== Credenciales (nuevo código tiene hasClientSecret) ===');
  console.log(JSON.stringify(cred.body?.data, null, 2));
  console.log('hasClientSecret presente:', 'hasClientSecret' in (cred.body?.data || {}));

  // El nuevo código (commit 4a2d1fb) tiene hasClientSecret en GET credentials
  // Si no aparece, el deploy viejo sigue activo
  if (!('hasClientSecret' in (cred.body?.data || {}))) {
    console.log('\n⚠️  DEPLOY VIEJO ACTIVO — Railway aún no deployó el nuevo código');
    console.log('Último commit local: 4a2d1fb (fix: procesar lineas XML de docs existentes)');
    console.log('Acción: esperar 2-3 min más o forzar redeploy en Railway');
  } else {
    console.log('\n✓ Deploy nuevo activo');
    console.log('hasClientSecret:', cred.body?.data?.hasClientSecret);
    if (!cred.body?.data?.hasClientSecret) {
      console.log('\n⚠️  CLIENT SECRET NO GUARDADO EN BD');
      console.log('Aunque el código es correcto, el clientSecret no está en la BD');
      console.log('Necesitas guardarlo desde la UI: Configuración → Credenciales SUNAT');
    }
  }
}

run().catch(e => console.error('FATAL:', e.message));
