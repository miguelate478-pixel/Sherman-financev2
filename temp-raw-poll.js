// Hacer el polling directamente a SUNAT para ver la respuesta RAW
// Necesitamos el token SIRE — lo obtenemos via el endpoint de test que lo genera internamente
const https = require('https');

async function reqApp(method, path, body, token) {
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
        catch { resolve({ status: res.statusCode, raw: data.substring(0, 3000) }); }
      });
    });
    r.on('error', e => resolve({ status: 0, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function reqSunat(path, token) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'api-sire.sunat.gob.pe',
      path, method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'es-419,es;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://e-factura.sunat.gob.pe',
        'Referer': 'https://e-factura.sunat.gob.pe/',
      },
      timeout: 15000,
    };
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, raw: data.substring(0, 3000) }));
    });
    r.on('error', e => resolve({ status: 0, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
    r.end();
  });
}

async function run() {
  const login = await reqApp('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const appToken = login.data?.data?.token;

  // Solicitar propuesta para obtener ticket
  const sire = await reqApp('POST', '/api/sunat/sire',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', tipo: 'RCE' }, appToken);
  const ticket = sire.data?.data?.numTicket;
  console.log('Ticket:', ticket);

  // Esperar 8 segundos
  console.log('Esperando 8s...');
  await new Promise(r => setTimeout(r, 8000));

  // Probar diferentes variantes del endpoint de polling DIRECTAMENTE a SUNAT
  // Necesitamos el token SIRE — pero no lo tenemos aquí directamente
  // Vamos a usar el endpoint de copiloto como proxy para hacer la llamada
  // O mejor: crear un endpoint de diagnóstico temporal

  // Por ahora, verificar qué devuelve el sire/route.ts GET con el raw completo
  console.log('\n=== Respuesta RAW del sire/route.ts GET ===');
  const pollRaw = await reqApp('GET',
    `/api/sunat/sire?ticket=${ticket}&companyId=sherman-inmobiliaria-01`, null, appToken);
  console.log('Status:', pollRaw.status);
  console.log('Data:', JSON.stringify(pollRaw.data, null, 2));
  console.log('Raw:', pollRaw.raw);

  // El problema: consultarTicket devuelve { numTicket, estado: undefined }
  // y ok(result) en sire/route.ts serializa solo los campos definidos
  // Necesitamos ver qué devuelve SUNAT realmente

  // Vamos a hacer una llamada directa al endpoint de polling de SUNAT
  // usando el token SIRE que obtenemos via el backend
  // Para esto necesitamos exponer el token — usamos el endpoint de test-connection
  // que internamente llama a getSireToken

  // Alternativa: ver los logs de Railway después de ejecutar el PUT
  console.log('\n=== Ejecutando PUT para ver logs en Railway ===');
  console.log('(Revisar logs de Railway para ver [POLLING] Respuesta intento 1)');
  const putResult = await reqApp('PUT', '/api/sunat/bulk-download',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', classifyWithAI: false },
    appToken, 30000);
  console.log('PUT result (13s):', JSON.stringify(putResult.data || putResult.raw));

  // Si el PUT termina en 13s, significa que esperarTicket lanza excepción en intento 1
  // La excepción más probable: "Ticket listo pero sin nombre de archivo"
  // porque codProceso=3 pero nomArchivo=''
  console.log('\n=== HIPÓTESIS ===');
  console.log('Si PUT termina en ~8s (5s espera + 3s proceso):');
  console.log('  → codProceso=3 pero nomArchivo vacío → throw "sin nombre de archivo"');
  console.log('  → catch en bloque RCE → errors += compras.length');
  console.log('  → luego loop sinXml marca todos como SIN_XML');
  console.log('\nSolución: loguear el error exacto del catch en el bloque RCE');
}

run().catch(e => console.error('FATAL:', e.message));
