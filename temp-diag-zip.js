// Diagnóstico directo: probar el polling y descarga del ZIP manualmente
const https = require('https');

async function req(method, hostname, path, body, headers) {
  return new Promise((resolve) => {
    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const opts = {
      hostname, path, method,
      headers: { 'Content-Type': 'application/json', ...headers,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) },
      timeout: 30000,
    };
    const r = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        try { resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(text), buf }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, raw: text.substring(0, 2000), buf }); }
      });
    });
    r.on('error', e => resolve({ status: 0, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

const SIRE_HEADERS = (token) => ({
  'Authorization':   `Bearer ${token}`,
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'es-419,es;q=0.9',
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Origin':          'https://e-factura.sunat.gob.pe',
  'Referer':         'https://e-factura.sunat.gob.pe/',
});

async function run() {
  // 1. Login app
  const login = await req('POST', 'sherman-financev2-production.up.railway.app', '/api/auth/login',
    { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' }, {});
  const appToken = login.data?.data?.token;
  console.log('App token OK:', !!appToken);

  // 2. Obtener token SIRE via test-connection
  const testConn = await req('PATCH', 'sherman-financev2-production.up.railway.app',
    '/api/sunat/credentials', { companyId: 'sherman-inmobiliaria-01' },
    { Authorization: `Bearer ${appToken}` });
  console.log('Test conn:', testConn.data?.data?.status, testConn.data?.data?.message);

  // 3. Necesitamos el token SIRE real — lo obtenemos haciendo una solicitud de propuesta
  // y capturando el ticket. Luego hacemos el polling manualmente.
  console.log('\n=== Paso 1: Solicitar propuesta RCE 2025-12 ===');
  const sireResp = await req('POST', 'sherman-financev2-production.up.railway.app',
    '/api/sunat/sire', { companyId: 'sherman-inmobiliaria-01', period: '2025-12', tipo: 'RCE' },
    { Authorization: `Bearer ${appToken}` });
  console.log('SIRE RCE response:', JSON.stringify(sireResp.data));
  const ticket = sireResp.data?.data?.numTicket;
  console.log('Ticket:', ticket);

  if (!ticket) { console.log('ERROR: no ticket'); return; }

  // 4. Polling manual del ticket (3 intentos con 5s de espera)
  console.log('\n=== Paso 2: Polling del ticket ===');
  for (let i = 1; i <= 6; i++) {
    console.log(`\nIntento ${i}/6 (esperando 5s)...`);
    await new Promise(r => setTimeout(r, 5000));

    const pollResp = await req('GET', 'sherman-financev2-production.up.railway.app',
      `/api/sunat/sire?ticket=${ticket}&companyId=sherman-inmobiliaria-01`, null,
      { Authorization: `Bearer ${appToken}` });
    console.log('Poll response:', JSON.stringify(pollResp.data));

    const data = pollResp.data?.data;
    if (data?.estado === '06' || data?.codProceso === '3' || data?.codProceso === '4') {
      console.log('✓ Ticket listo!');
      console.log('Archivo:', data?.archivoReporte?.[0]?.nomArchivoReporte || data?.nomArchivoReporte);
      break;
    }
  }

  // 5. Ver qué devuelve el consultarTicket actual
  console.log('\n=== Paso 3: Ver respuesta RAW del consultarTicket ===');
  // Necesitamos ver la respuesta completa del endpoint de polling
  // Usamos el endpoint de sire/route.ts que llama a consultarTicket
  const rawPoll = await req('GET', 'sherman-financev2-production.up.railway.app',
    `/api/sunat/sire?ticket=${ticket}&companyId=sherman-inmobiliaria-01`, null,
    { Authorization: `Bearer ${appToken}` });
  console.log('Raw poll completo:', JSON.stringify(rawPoll.data, null, 2));
}

run().catch(e => console.error('FATAL:', e.message));
