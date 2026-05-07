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

  // 2. Verificar credenciales actuales
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
  console.log('Credenciales actuales:', JSON.stringify(credResp.data, null, 2));

  // 3. Guardar Client Secret (sin cambiar password - no enviamos solPass)
  // Client Secret de Sherman: necesitamos el valor real
  // Según el contexto: Client ID = f62b2812-1afb-4d70-8d74-7c444bdfae4c
  // El Client Secret no está en el contexto - necesitamos pedirlo al usuario
  console.log('\n⚠️  ACCIÓN REQUERIDA:');
  console.log('El Client Secret NO está guardado en la BD.');
  console.log('Para guardarlo, ejecuta este curl desde tu terminal:');
  console.log('');
  console.log(`curl -X POST https://sherman-financev2-production.up.railway.app/api/sunat/credentials \\`);
  console.log(`  -H "Authorization: Bearer ${token.substring(0,40)}..." \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"companyId":"sherman-inmobiliaria-01","solUser":"SHERMAN1","clientId":"f62b2812-1afb-4d70-8d74-7c444bdfae4c","clientSecret":"TU_CLIENT_SECRET_AQUI"}'`);
  console.log('');
  console.log('O ve a la web → Configuración → Credenciales SUNAT → ingresa el Client Secret y guarda.');
}

run().catch(e => console.error('FATAL:', e.message));
