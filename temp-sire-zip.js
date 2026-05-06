// Probar el endpoint SIRE de exportación de propuesta (ZIP con XMLs)
// Este es el approach correcto para obtener XMLs de compras recibidas
const https = require('https');

async function httpReq(method, path, body, token) {
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
        catch { resolve({ status: res.statusCode, raw: data.substring(0, 1000) }); }
      });
    });
    r.on('error', e => resolve({ status: 0, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function run() {
  const login = await httpReq('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = login.data?.data?.token;

  // Probar propuesta RCE (compras) - genera ZIP con XMLs
  console.log('=== Solicitando propuesta RCE 2025-12 (ZIP con XMLs) ===');
  const rce = await httpReq('POST', '/api/sunat/sire',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', tipo: 'RCE' }, token);
  console.log('RCE status:', rce.status);
  console.log('RCE response:', JSON.stringify(rce.data || rce.raw).substring(0, 300));

  // Probar propuesta RVIE (ventas)
  console.log('\n=== Solicitando propuesta RVIE 2025-12 ===');
  const rvie = await httpReq('POST', '/api/sunat/sire',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', tipo: 'RVIE' }, token);
  console.log('RVIE status:', rvie.status);
  console.log('RVIE response:', JSON.stringify(rvie.data || rvie.raw).substring(0, 300));

  // Consultar tickets generados
  const rceTicket = rce.data?.data?.numTicket;
  const rvieTicket = rvie.data?.data?.numTicket;

  if (rceTicket) {
    console.log(`\n=== Consultando ticket RCE: ${rceTicket} ===`);
    await new Promise(r => setTimeout(r, 3000));
    const t1 = await httpReq('GET',
      `/api/sunat/sire?ticket=${rceTicket}&companyId=sherman-inmobiliaria-01`, null, token);
    console.log('Ticket RCE:', JSON.stringify(t1.data || t1.raw).substring(0, 500));
  }

  if (rvieTicket) {
    console.log(`\n=== Consultando ticket RVIE: ${rvieTicket} ===`);
    await new Promise(r => setTimeout(r, 3000));
    const t2 = await httpReq('GET',
      `/api/sunat/sire?ticket=${rvieTicket}&companyId=sherman-inmobiliaria-01`, null, token);
    console.log('Ticket RVIE:', JSON.stringify(t2.data || t2.raw).substring(0, 500));
  }
}

run().catch(e => console.error('FATAL:', e.message));
