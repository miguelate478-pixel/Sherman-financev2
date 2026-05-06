// Probar endpoints CPE de CONSULTA (no descarga)
// El portal e-factura.sunat.gob.pe tiene una sección "Mis Comprobantes Recibidos"
// que usa APIs internas. Vamos a probar esas APIs con el token CPE que ya tenemos.
const https = require('https');

async function reqApp(method, path, body, token) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'sherman-financev2-production.up.railway.app',
      path, method,
      headers: { 'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) },
      timeout: 15000,
    };
    const r = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, raw: d.substring(0, 1000) }); } });
    });
    r.on('error', e => resolve({ status: 0, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
    if (bodyStr) r.write(bodyStr); r.end();
  });
}

async function reqSunat(path, token, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api-cpe.sunat.gob.pe',
      path, method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://e-factura.sunat.gob.pe',
        'Referer': 'https://e-factura.sunat.gob.pe/',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
      timeout: 15000,
    };
    const r = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d.substring(0, 2000) }));
    });
    r.on('error', e => resolve({ status: 0, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
    if (bodyStr) r.write(bodyStr); r.end();
  });
}

async function run() {
  const login = await reqApp('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const appToken = login.data?.data?.token;

  // Obtener token CPE via el endpoint de diagnóstico
  const diagResp = await reqApp('GET',
    '/api/sunat/sire?ticket=dummy&companyId=sherman-inmobiliaria-01&period=202512&codLibro=080000',
    null, appToken);
  // El token CPE está en el servidor — necesitamos exponerlo
  // Por ahora usamos el token SIRE que sabemos que funciona

  // Probar endpoints CPE de CONSULTA de comprobantes recibidos
  // Estos son los endpoints que usa el portal e-factura internamente
  const RUC = '20610169849';

  // El token SIRE tiene scope api-sire.sunat.gob.pe
  // El token CPE tiene scope api-cpe.sunat.gob.pe
  // Necesitamos el token CPE para estos endpoints

  // Vamos a obtener el token CPE directamente desde aquí
  // usando las credenciales conocidas
  // CLIENT_ID: f62b2812-1afb-4d70-8d74-7c444bdfae4c
  // Necesitamos el CLIENT_SECRET — está en la BD encriptado

  // Alternativa: usar el endpoint de test-connection que internamente obtiene el token
  // y luego hacer las llamadas desde el servidor

  // Por ahora, probamos los endpoints que NO requieren token CPE
  // sino que usan el token SIRE (que ya funciona)

  // Endpoint de consulta de comprobantes recibidos via SIRE
  // Según el manual SIRE, existe un endpoint para consultar comprobantes recibidos
  // con detalle de ítems

  console.log('=== Análisis de lo que hace Smartcont ===');
  console.log('');
  console.log('Smartcont menciona "descarga de ítems detallados" via API SUNAT.');
  console.log('Hay 3 posibilidades de cómo lo hace:');
  console.log('');
  console.log('1. Usa el endpoint CPE con el RUC del EMISOR (no del receptor)');
  console.log('   → Requiere que el emisor haya registrado el comprobante en CPE');
  console.log('   → Nuestro 404 indica que los emisores de Sherman no usan CPE directo');
  console.log('');
  console.log('2. Usa un endpoint SIRE de "detalle de comprobante" no documentado');
  console.log('   → Posible: el portal SIRE tiene más endpoints que los documentados');
  console.log('');
  console.log('3. Usa el portal e-factura con browser automation (Playwright)');
  console.log('   → El portal tiene "Mis Comprobantes Recibidos" con descarga de XML');
  console.log('   → Smartcont podría estar usando las APIs internas del portal');
  console.log('');

  // Probar endpoint SIRE de detalle de comprobante individual
  // Formato hipotético: /rce/propuesta/web/propuesta/{periodo}/comprobante/{id}
  console.log('=== Probando endpoints SIRE de detalle ===');

  // Necesitamos el token SIRE — lo obtenemos via el sire/route
  const sireResp = await reqApp('POST', '/api/sunat/sire',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', tipo: 'RCE' }, appToken);
  console.log('Token SIRE obtenido (ticket):', sireResp.data?.data?.numTicket);

  // El token SIRE está en el servidor — no lo podemos usar directamente desde aquí
  // Necesitamos un endpoint de diagnóstico que haga las llamadas por nosotros

  console.log('');
  console.log('=== CONCLUSIÓN DEL ANÁLISIS ===');
  console.log('');
  console.log('Lo que Smartcont probablemente hace:');
  console.log('');
  console.log('OPCIÓN A (más probable): Usa el endpoint CPE con el RUC del EMISOR');
  console.log('  URL: GET /v1/contribuyente/gem/comprobantes/{tipo}/{serie}/{num}/{rucEMISOR}/xml');
  console.log('  Pero autenticado con el token del RECEPTOR (Sherman)');
  console.log('  → Esto es exactamente lo que ya probamos → 404');
  console.log('  → El 404 puede ser porque los proveedores de Sherman usan OSE/PSE');
  console.log('    y sus XMLs no están en el repositorio CPE de SUNAT');
  console.log('');
  console.log('OPCIÓN B: Usa el portal e-factura con Playwright/Puppeteer');
  console.log('  → Automatiza el login SOL y navega a "Mis Comprobantes Recibidos"');
  console.log('  → Descarga los XMLs desde el portal web');
  console.log('  → Esto SÍ funcionaría para todos los comprobantes');
  console.log('');
  console.log('OPCIÓN C: Usa un endpoint no documentado del portal e-factura');
  console.log('  → El portal hace llamadas a APIs internas cuando el usuario navega');
  console.log('  → Esas APIs usan cookies de sesión SOL, no OAuth2');
  console.log('  → Requiere reverse engineering del portal');
}

run().catch(e => console.error('FATAL:', e.message));
