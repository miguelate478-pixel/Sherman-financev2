const https = require('https');

async function run() {
  // 1. Login
  const loginBody = JSON.stringify({ email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'sherman-financev2-production.up.railway.app',
      path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
    }, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data).data?.token || ''); } catch(e) { reject(e); } });
    });
    req.on('error', reject); req.write(loginBody); req.end();
  });
  console.log('Token OK:', token.substring(0,40) + '...\n');

  // 2. Ver documentos de 2025-12 y su parserStatus
  const docsResp = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'sherman-financev2-production.up.railway.app',
      path: '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-12',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject); req.end();
  });

  const docs = docsResp.data || [];
  console.log(`=== Documentos 2025-12: ${docs.length} ===`);
  docs.forEach(d => {
    console.log(`  ${d.id} | op=${d.op} | tipo=${d.tipo} | hasXml=${d.xml} | parser=${d.parserStatus} | ai=${d.aiStatus}`);
  });

  // 3. Probar token CPE directamente via test-connection
  console.log('\n=== Test conexión SUNAT ===');
  const testBody = JSON.stringify({ companyId: 'sherman-inmobiliaria-01' });
  const testResp = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'sherman-financev2-production.up.railway.app',
      path: '/api/sunat/test-connection', method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(testBody) }
    }, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({ raw: data.substring(0,300) }); } });
    });
    req.on('error', reject); req.write(testBody); req.end();
  });
  console.log('Test conexión:', JSON.stringify(testResp, null, 2));

  // 4. Ver credenciales (sin mostrar passwords)
  console.log('\n=== Credenciales empresa ===');
  const credResp = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'sherman-financev2-production.up.railway.app',
      path: '/api/sunat/credentials?companyId=sherman-inmobiliaria-01',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject); req.end();
  });
  const cred = credResp.data || credResp;
  console.log('solUser:', cred.solUser);
  console.log('clientId:', cred.clientId);
  console.log('status:', cred.status);
  console.log('provider:', cred.provider);
  console.log('encClientSecret existe:', !!cred.encClientSecret);
}

run().catch(e => console.error('FATAL:', e.message));
