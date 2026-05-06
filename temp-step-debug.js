// Diagnóstico paso a paso del flujo PUT
const https = require('https');

async function req(method, path, body, token, timeoutMs = 30000) {
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
      timeout: timeoutMs,
    };
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, raw: data.substring(0, 2000) }); }
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

  // Resetear 1 doc a PENDIENTE
  const docs = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-12', null, token);
  const firstDoc = docs.data?.data?.[0];
  if (firstDoc) {
    await req('PATCH', '/api/documents', { id: firstDoc.id, parserStatus: 'PENDIENTE' }, token);
    console.log('Reseteado:', firstDoc.id);
  }

  // Paso 1: Solicitar propuesta RCE
  console.log('\n=== PASO 1: Solicitar propuesta RCE 2025-12 ===');
  const sire1 = await req('POST', '/api/sunat/sire',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', tipo: 'RCE' }, token);
  console.log('Propuesta RCE:', JSON.stringify(sire1.data));
  const ticket = sire1.data?.data?.numTicket;
  if (!ticket) { console.log('ERROR: sin ticket'); return; }

  // Paso 2: Polling manual 10 intentos
  console.log(`\n=== PASO 2: Polling ticket ${ticket} (10 intentos × 5s) ===`);
  let nomArchivo = null, codProceso = null, codTipo = null;
  for (let i = 1; i <= 10; i++) {
    console.log(`Intento ${i}/10...`);
    await new Promise(r => setTimeout(r, 5000));
    const poll = await req('GET', `/api/sunat/sire?ticket=${ticket}&companyId=sherman-inmobiliaria-01`, null, token);
    const d = poll.data?.data;
    console.log(`  Respuesta: ${JSON.stringify(d)}`);
    if (d?.estado === '06') {
      nomArchivo = d?.archivoReporte?.[0]?.nomArchivoReporte;
      codProceso = d?.codProceso;
      codTipo = d?.archivoReporte?.[0]?.codTipoArchivoReporte;
      console.log(`  ✓ LISTO! archivo=${nomArchivo} codProceso=${codProceso} codTipo=${codTipo}`);
      break;
    }
  }

  if (!nomArchivo) {
    console.log('\nTicket no completó en 10 intentos. Estado final del polling:');
    const finalPoll = await req('GET', `/api/sunat/sire?ticket=${ticket}&companyId=sherman-inmobiliaria-01`, null, token);
    console.log(JSON.stringify(finalPoll.data, null, 2));
    return;
  }

  // Paso 3: Descargar ZIP directamente
  console.log(`\n=== PASO 3: Descargar ZIP ${nomArchivo} ===`);
  // Construir URL con parámetros del manual v25
  const params = new URLSearchParams({
    nomArchivoReporte: nomArchivo,
    codTipoArchivoReporte: codTipo || 'null',
    perTributario: '202512',
    codProceso: String(codProceso || '3'),
    numTicket: ticket,
    codLibro: '080000',
  });
  const dlUrl = `https://apisire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte?${params}`;
  console.log('URL descarga:', dlUrl);

  // Necesitamos el token SIRE real — lo obtenemos via el backend
  // Por ahora solo verificamos que el PUT funciona con el nuevo deploy
  console.log('\n=== PASO 4: Ejecutar PUT con 1 doc ===');
  const putResult = await req('PUT', '/api/sunat/bulk-download',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', classifyWithAI: false },
    token, 360000);
  console.log('PUT result:', JSON.stringify(putResult.data || putResult.raw));
}

run().catch(e => console.error('FATAL:', e.message));
