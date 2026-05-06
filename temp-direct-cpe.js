// Probar el endpoint CPE directamente obteniendo el token via el backend
// y luego llamando a SUNAT directamente desde aquí
const https = require('https');

async function httpReq(method, hostname, path, body, headers) {
  return new Promise((resolve) => {
    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const opts = {
      hostname, path, method,
      headers: { ...headers, ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) },
      timeout: 20000,
    };
    const r = https.request(opts, res => {
      let data = Buffer.alloc(0);
      res.on('data', c => data = Buffer.concat([data, c]));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data.toString('utf8').substring(0, 1000) }));
    });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, body: 'TIMEOUT' }); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function run() {
  // 1. Obtener token SIRE via el backend de producción
  const loginResp = await httpReq('POST', 'sherman-financev2-production.up.railway.app', '/api/auth/login',
    JSON.stringify({ email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' }),
    { 'Content-Type': 'application/json' });
  const appToken = JSON.parse(loginResp.body).data?.token;

  // 2. Obtener token SIRE real via test-connection (que llama a getSireToken)
  // El token SIRE se obtiene internamente — necesitamos exponerlo
  // Usamos el endpoint de copiloto como proxy para hacer una llamada SUNAT
  // En su lugar, vamos a obtener el token SIRE directamente desde aquí
  // usando las credenciales que conocemos del contexto

  const CLIENT_ID = 'f62b2812-1afb-4d70-8d74-7c444bdfae4c';
  const RUC = '20610169849';
  const SOL_USER = 'SHERMAN1';
  // No tenemos la contraseña aquí — necesitamos otro approach

  // 3. Approach alternativo: crear un endpoint de diagnóstico temporal
  // que pruebe los endpoints CPE y devuelva el resultado
  // Vamos a modificar el endpoint de test-connection para que también pruebe CPE

  // Por ahora, probamos los endpoints SIRE que SÍ tenemos acceso
  // El endpoint de propuesta ZIP que devuelve el archivo con todos los XMLs

  console.log('=== Probando endpoint SIRE propuesta ZIP (contiene XMLs) ===');
  // El endpoint de propuesta genera un ZIP con todos los XMLs del período
  // Este es el approach correcto para obtener XMLs masivamente

  // Verificar qué devuelve el ticket de la propuesta que se generó antes
  const ticketResp = await httpReq('GET',
    'sherman-financev2-production.up.railway.app',
    '/api/sunat/sire?ticket=20250300000119&companyId=sherman-inmobiliaria-01',
    null,
    { 'Content-Type': 'application/json', Authorization: `Bearer ${appToken}` });
  console.log('Ticket status:', ticketResp.status);
  console.log('Ticket body:', ticketResp.body.substring(0, 500));

  // 4. Probar endpoint SIRE de detalle de comprobante individual
  // Formato: /v1/contribuyente/migeigv/libros/rce/propuesta/web/propuesta/{periodo}/comprobante/{id}
  // o: /v1/contribuyente/migeigv/comprobantes/{ruc}/{tipo}/{serie}/{numero}
  console.log('\n=== Probando via backend proxy - endpoint SIRE detalle ===');

  // Usar el endpoint de SIRE que ya existe para probar
  const sireDetail = await httpReq('POST',
    'sherman-financev2-production.up.railway.app',
    '/api/sunat/sire',
    JSON.stringify({ companyId: 'sherman-inmobiliaria-01', period: '2025-12', tipo: 'RVIE' }),
    { 'Content-Type': 'application/json', Authorization: `Bearer ${appToken}` });
  console.log('SIRE RVIE propuesta:', sireDetail.status, sireDetail.body.substring(0, 300));

  // 5. Verificar qué docs tienen parserStatus=SIN_XML vs PENDIENTE
  const docsResp = await httpReq('GET',
    'sherman-financev2-production.up.railway.app',
    '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-12',
    null,
    { Authorization: `Bearer ${appToken}` });
  const docs = JSON.parse(docsResp.body).data || [];
  console.log('\n=== Docs 2025-12 ===');
  const byStatus = {};
  docs.forEach(d => { byStatus[d.parserStatus] = (byStatus[d.parserStatus]||0)+1; });
  console.log('Por parserStatus:', JSON.stringify(byStatus));
  console.log('Ejemplo doc COMPRA:', docs.find(d=>d.op==='COMPRA')?.id, '| ruc_e:', docs.find(d=>d.op==='COMPRA')?.ruc_e);
  console.log('Ejemplo doc VENTA:', docs.find(d=>d.op==='VENTA')?.id, '| ruc_e:', docs.find(d=>d.op==='VENTA')?.ruc_e);
}

run().catch(e => console.error('FATAL:', e.message));
