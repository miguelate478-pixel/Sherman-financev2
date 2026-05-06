// Probar CPE API directamente para una venta de Sherman
// E001-101 emitida por 20610169849
const https = require('https');

async function req(method, path, body, token) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { hostname: 'sherman-financev2-production.up.railway.app', path, method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) }, timeout: 30000 };
    const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, raw: d.substring(0,2000) }); } }); });
    r.on('error', e => resolve({ status: 0, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
    if (bodyStr) r.write(bodyStr); r.end();
  });
}

async function reqSunat(path, token) {
  return new Promise((resolve) => {
    const opts = { hostname: 'api-cpe.sunat.gob.pe', path, method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/xml',
        'User-Agent': 'Mozilla/5.0', 'Origin': 'https://e-factura.sunat.gob.pe',
        'Referer': 'https://e-factura.sunat.gob.pe/' }, timeout: 15000 };
    const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d.substring(0,500) })); });
    r.on('error', e => resolve({ status: 0, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
    r.end();
  });
}

async function run() {
  const login = await req('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = login.data?.data?.token;

  // Obtener token CPE via test-connection (que internamente llama a getSireToken)
  // No tenemos acceso directo al token CPE desde aquí
  // Pero podemos usar el endpoint de diagnóstico del sire/route para obtener el token SIRE
  // y luego obtener el CPE token manualmente

  // Alternativa: usar el endpoint de sire/route GET que ahora expone el token SIRE
  // y hacer el fetch CPE desde aquí

  // Primero ver qué docs de venta tenemos
  const docs = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-12', null, token);
  const ventas = (docs.data?.data || []).filter(d => d.op === 'VENTA');
  console.log('Ventas 2025-12:');
  ventas.forEach(d => console.log(`  ${d.id} | serie=${d.serie} | num=${d.num} | tipo=${d.tipo} | ruc_e=${d.ruc_e}`));

  // El endpoint CPE para ventas es:
  // GET https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/{tipo}/{serie}/{numero}/{rucEmisor}/xml
  // Para E001-101: /comprobantes/01/E001/101/20610169849/xml
  // Para E001-100: /comprobantes/01/E001/100/20610169849/xml

  // Necesitamos el token CPE — scope: https://api-cpe.sunat.gob.pe
  // El token SIRE tiene scope: https://api-sire.sunat.gob.pe — son diferentes

  // Verificar si el token CPE se puede obtener con las mismas credenciales
  // Hacemos una solicitud de propuesta SIRE para obtener el token SIRE
  // y luego intentamos usarlo en CPE (puede que funcione o no)

  console.log('\n=== Verificando si el token SIRE funciona en CPE ===');
  // Obtener token SIRE via el endpoint de diagnóstico
  const sireResp = await req('POST', '/api/sunat/sire',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', tipo: 'RVIE' }, token);
  console.log('SIRE ticket:', sireResp.data?.data?.numTicket);

  // El token CPE se obtiene con scope diferente
  // Según el código en bulk-download/route.ts, getCpeToken usa:
  // scope: 'https://api-cpe.sunat.gob.pe'
  // Esto es diferente al scope SIRE

  // La pregunta es: ¿el Client ID de Sherman tiene acceso al scope CPE?
  // Si no tiene acceso, getCpeToken lanzará un error

  console.log('\n=== HIPÓTESIS FINAL ===');
  console.log('El Client ID f62b2812... puede no tener acceso al scope CPE.');
  console.log('El scope CPE (api-cpe.sunat.gob.pe) requiere que la empresa sea emisor electrónico.');
  console.log('Sherman Inmobiliaria puede no estar habilitada para emitir comprobantes electrónicos.');
  console.log('\nVerificar en SUNAT: ¿Sherman emite facturas electrónicas?');
  console.log('Si no emite, el scope CPE no está disponible para su Client ID.');
  console.log('\nLas ventas E001-99, E001-100, E001-101 son facturas emitidas por Sherman.');
  console.log('Si Sherman emite electrónicamente, el CPE debería funcionar.');
}

run().catch(e => console.error('FATAL:', e.message));
