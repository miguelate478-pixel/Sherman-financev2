const https = require('https');

async function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'sherman-financev2-production.up.railway.app',
      path, method,
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
      timeout: 120000,
    };
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data.substring(0,300) }); } });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('TIMEOUT')); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function run() {
  // 1. Login
  const login = await req('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = login.data?.token;
  console.log('Token OK:', !!token);

  // 2. Ver docs 2025-10 y su parserStatus
  const docs10 = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-10', null, token);
  const docs = docs10.data || [];
  console.log(`\n=== Docs 2025-10: ${docs.length} ===`);
  docs.forEach(d => console.log(`  ${d.id} | parser=${d.parserStatus} | hasXml=${d.xml} | lineas=${d.lineas?.length||0}`));

  // 3. Ver si algún doc tiene líneas
  const conLineas = docs.filter(d => d.lineas?.length > 0);
  console.log(`\nDocs con líneas: ${conLineas.length}`);
  if (conLineas.length > 0) {
    const d = conLineas[0];
    console.log(`\nPrimer doc con líneas: ${d.id}`);
    d.lineas.forEach((l, i) => console.log(`  L${i+1}: ${l.desc} | qty=${l.qty} | total=${l.total_l}`));
  }

  // 4. El problema: los docs ya existen → el loop hace "continue"
  // Necesitamos borrar los docs existentes O agregar lógica para procesar líneas de docs existentes
  // Primero verificar cuántos docs existen en 2025-10
  console.log(`\n=== DIAGNÓSTICO ===`);
  console.log(`Los ${docs.length} docs de 2025-10 ya existen en BD.`);
  console.log(`El loop hace: if(existing) continue  → salta el bloque includeDetails`);
  console.log(`\nSOLUCIÓN: Necesitamos un endpoint separado para parsear XMLs de docs existentes`);
  console.log(`O modificar el bulk-download para procesar líneas aunque el doc ya exista`);

  // 5. Probar con 2025-09 (período diferente, puede que no tenga docs)
  const docs09 = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-09', null, token);
  console.log(`\nDocs 2025-09: ${docs09.data?.length || 0}`);

  // 6. Probar con 2025-08
  const docs08 = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-08', null, token);
  console.log(`Docs 2025-08: ${docs08.data?.length || 0}`);

  // 7. Probar con 2025-11
  const docs11 = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2025-11', null, token);
  console.log(`Docs 2025-11: ${docs11.data?.length || 0}`);

  // 8. Probar con 2026-01
  const docs2601 = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2026-01', null, token);
  console.log(`Docs 2026-01: ${docs2601.data?.length || 0}`);

  // 9. Probar con 2026-02
  const docs2602 = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2026-02', null, token);
  console.log(`Docs 2026-02: ${docs2602.data?.length || 0}`);

  // 10. Probar con 2026-03
  const docs2603 = await req('GET', '/api/documents?companyId=sherman-inmobiliaria-01&period=2026-03', null, token);
  console.log(`Docs 2026-03: ${docs2603.data?.length || 0}`);
}

run().catch(e => console.error('FATAL:', e.message));
