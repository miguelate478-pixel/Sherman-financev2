const https = require('https');

async function httpReq(method, hostname, path, body, headers) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname, path, method,
      headers: { 'Content-Type': 'application/json', ...headers,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) },
      timeout: 20000,
    };
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data.substring(0, 800) }));
    });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, body: 'TIMEOUT' }); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function run() {
  // 1. Login
  const login = await httpReq('POST', 'sherman-financev2-production.up.railway.app', '/api/auth/login',
    { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' }, {});
  const appToken = JSON.parse(login.body).data?.token;
  console.log('App token OK:', !!appToken);

  // 2. Obtener token SIRE via test-connection (para usarlo directamente)
  // Primero obtener credenciales desencriptadas via el endpoint de test
  const testConn = await httpReq('PATCH', 'sherman-financev2-production.up.railway.app',
    '/api/sunat/credentials',
    { companyId: 'sherman-inmobiliaria-01' },
    { Authorization: `Bearer ${appToken}` });
  console.log('Test connection:', testConn.status, testConn.body.substring(0, 200));

  // 3. Obtener token SIRE directamente
  // Necesitamos las credenciales reales — las obtenemos via el endpoint de bulk-download
  // que ya las tiene. Vamos a hacer una descarga mínima para capturar el token en logs.

  // 4. Probar endpoints CPE directamente con token SIRE
  // El token SIRE ya funciona para SIRE API. Probamos si también sirve para CPE API.
  // Primero necesitamos el token — lo obtenemos haciendo una llamada al backend que lo genere

  // Hacer una descarga de 1 doc para que el backend genere el token CPE
  // y luego probamos el endpoint directamente
  console.log('\n=== Probando endpoint SIRE para detalle de comprobante ===');

  // Endpoints a probar (todos con token SIRE):
  const RUC = '20610169849';
  const TIPO = '01';
  const SERIE = 'FJ88';
  const NUMERO = '30587';
  const PERIODO = '202512';

  // Necesitamos el token SIRE — lo obtenemos via el backend proxy
  // Crear un endpoint temporal de diagnóstico
  console.log('\nNecesitamos el token SIRE real para probar los endpoints.');
  console.log('Vamos a usar el endpoint de bulk-download como proxy para obtenerlo.');

  // Hacer PUT parse para un solo doc y ver qué pasa
  console.log('\n=== Probando PUT /api/sunat/bulk-download (parsear XMLs) ===');
  const putResp = await httpReq('PUT', 'sherman-financev2-production.up.railway.app',
    '/api/sunat/bulk-download',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', classifyWithAI: false, limit: 1 },
    { Authorization: `Bearer ${appToken}` });
  console.log('PUT status:', putResp.status);
  console.log('PUT body:', putResp.body);
}

run().catch(e => console.error('FATAL:', e.message));
