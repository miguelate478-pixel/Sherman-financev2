const https = require('https');

async function run() {
  // 1. Login
  const loginBody = JSON.stringify({ email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'sherman-financev2-production.up.railway.app',
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { const d = JSON.parse(data); resolve(d.data?.token || ''); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(loginBody);
    req.end();
  });

  if (!token) { console.log('ERROR: no token'); return; }
  console.log('Token OK:', token.substring(0, 40) + '...');

  // 2. Bulk download
  const bulkBody = JSON.stringify({
    companyId: 'sherman-inmobiliaria-01',
    periodFrom: '2025-12',
    periodTo: '2025-12',
    operation: 'COMPRAS',
    documentTypes: ['01','03','07','08'],
    includeDetails: true,
    classifyWithAI: false
  });

  console.log('\nEjecutando bulk download con includeDetails:true...');
  console.log('(puede tardar 60-90 segundos)\n');

  const result = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'sherman-financev2-production.up.railway.app',
      path: '/api/sunat/bulk-download',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bulkBody)
      },
      timeout: 120000
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ raw: data.substring(0, 500) }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT 120s')); });
    req.write(bulkBody);
    req.end();
  });

  console.log('=== RESPUESTA COMPLETA ===');
  console.log('ok:', result.ok);
  console.log('error:', result.error);
  if (result.data) {
    console.log('status:', result.data.status);
    console.log('totalDocs:', result.data.totalDocs);
    console.log('totalXml:', result.data.totalXml);
    console.log('totalErrors:', result.data.totalErrors);
    console.log('lastError:', result.data.lastError);
    console.log('jobId:', result.data.jobId);
  }
  console.log('\nFull JSON:');
  console.log(JSON.stringify(result, null, 2));
}

run().catch(e => console.error('FATAL:', e.message));
