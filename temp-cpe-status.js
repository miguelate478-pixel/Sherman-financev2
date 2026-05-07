// Crear endpoint temporal de diagnóstico en el backend
// que pruebe el endpoint CPE y devuelva el status HTTP exacto
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
  const login = await httpReq('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = login.data?.data?.token;

  // Obtener docs para saber qué serie/numero/tipo/ruc_e tenemos
  const docs12 = await httpReq('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-12', null, token);
  const docs = docs12.data?.data || [];

  console.log('=== Documentos 2025-12 ===');
  docs.forEach(d => {
    console.log(`  ${d.id} | op=${d.op} | tipo=${d.tipo} | serie=${d.serie} | num=${d.num} | ruc_e=${d.ruc_e} | parser=${d.parserStatus}`);
  });

  // El endpoint CPE es: GET /v1/contribuyente/gem/comprobantes/{tipo}/{serie}/{numero}/{rucEmisor}/xml
  // Para COMPRAS: rucEmisor = ruc_e (el proveedor)
  // Para VENTAS: rucEmisor = ruc_e (la empresa = 20610169849)

  // Verificar: para FJ88-30587 (COMPRA), ruc_e debería ser el proveedor
  const compra = docs.find(d => d.op === 'COMPRA');
  const venta = docs.find(d => d.op === 'VENTA');

  console.log('\n=== Análisis ===');
  if (compra) {
    console.log(`COMPRA: ${compra.id}`);
    console.log(`  tipo=${compra.tipo} serie=${compra.serie} num=${compra.num}`);
    console.log(`  ruc_e (emisor/proveedor)=${compra.ruc_e} → ${compra.rs_e}`);
    console.log(`  ruc_r (receptor/empresa)=${compra.ruc_r}`);
    console.log(`  CPE URL sería: /comprobantes/${compra.tipo}/${compra.serie}/${compra.num}/${compra.ruc_e}/xml`);
  }
  if (venta) {
    console.log(`\nVENTA: ${venta.id}`);
    console.log(`  tipo=${venta.tipo} serie=${venta.serie} num=${venta.num}`);
    console.log(`  ruc_e (emisor/empresa)=${venta.ruc_e} → ${venta.rs_e}`);
    console.log(`  ruc_r (receptor/cliente)=${venta.ruc_r}`);
    console.log(`  CPE URL sería: /comprobantes/${venta.tipo}/${venta.serie}/${venta.num}/${venta.ruc_e}/xml`);
  }

  // El problema puede ser que para COMPRAS, el rucEmisor en el código es doc.issuerRuc
  // pero la API CPE puede requerir el RUC del RECEPTOR (la empresa que consulta)
  // Vamos a probar ambas variantes via el PUT con logs detallados

  // Resetear parserStatus de un doc a PENDIENTE para re-probar
  console.log('\n=== Reseteando parserStatus de FJ88-30587-2025-12 a PENDIENTE ===');
  // No tenemos endpoint directo para esto, pero podemos usar el PATCH de documents
  const resetResp = await httpReq('PATCH', '/api/documents',
    { id: 'FJ88-30587-2025-12', parserStatus: 'PENDIENTE' }, token);
  console.log('Reset:', resetResp.status, JSON.stringify(resetResp.data || resetResp.raw).substring(0, 100));

  // Ahora probar PUT con limit=1 para ese doc específico
  console.log('\n=== PUT parsear 1 doc (FJ88-30587-2025-12) ===');
  const putResp = await httpReq('PUT', '/api/sunat/bulk-download',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', classifyWithAI: false, limit: 1 }, token);
  console.log('PUT result:', JSON.stringify(putResp.data || putResp.raw));

  // Ver estado después
  await new Promise(r => setTimeout(r, 2000));
  const afterDocs = await httpReq('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-12', null, token);
  const fj88 = afterDocs.data?.data?.find(d => d.id === 'FJ88-30587-2025-12');
  console.log('\nFJ88-30587-2025-12 después:', fj88?.parserStatus, '| hasXml:', fj88?.xml, '| lineas:', fj88?.lineas?.length);
}

run().catch(e => console.error('FATAL:', e.message));
