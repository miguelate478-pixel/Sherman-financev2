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
      timeout: 30000,
    };
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, raw: data.substring(0, 5000) }); }
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

  // Solicitar propuesta RCE
  const sire = await req('POST', '/api/sunat/sire',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', tipo: 'RCE' }, token);
  const ticket = sire.data?.data?.numTicket;
  console.log('Ticket RCE:', ticket);

  // Esperar 10s y hacer polling con el nuevo endpoint de diagnóstico
  console.log('Esperando 10s...');
  await new Promise(r => setTimeout(r, 10000));

  // Usar el nuevo endpoint que devuelve la respuesta RAW de SUNAT
  const poll = await req('GET',
    `/api/sunat/sire?ticket=${ticket}&companyId=sherman-inmobiliaria-01&period=202512&codLibro=080000`,
    null, token);

  console.log('\n=== RESPUESTA COMPLETA DEL POLLING ===');
  console.log('HTTP Status:', poll.status);
  if (poll.data) {
    console.log('\nsunatStatus:', poll.data.data?.sunatStatus);
    console.log('\nsunatRaw (respuesta real de SUNAT):');
    console.log(JSON.stringify(poll.data.data?.sunatRaw, null, 2));
    console.log('\nconsultarTicketResult:');
    console.log(JSON.stringify(poll.data.data?.consultarTicketResult, null, 2));
  } else {
    console.log('Raw:', poll.raw);
  }

  // Esperar más y probar de nuevo
  console.log('\nEsperando 15s más...');
  await new Promise(r => setTimeout(r, 15000));

  const poll2 = await req('GET',
    `/api/sunat/sire?ticket=${ticket}&companyId=sherman-inmobiliaria-01&period=202512&codLibro=080000`,
    null, token);
  console.log('\n=== SEGUNDO POLLING (25s después) ===');
  if (poll2.data) {
    console.log('sunatRaw:', JSON.stringify(poll2.data.data?.sunatRaw, null, 2));
  }
}

run().catch(e => console.error('FATAL:', e.message));
