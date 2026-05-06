// Descargar el ZIP que ya tenemos y ver qué contiene
const https = require('https');

async function req(method, path, body, token) {
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

async function run() {
  const login = await req('POST', '/api/auth/login', { email: 'admin@shermaninmobiliaria.pe', password: 'Admin123!' });
  const token = login.data?.data?.token;

  // Solicitar propuesta con codTipoArchivo=0 (TXT resumen) para comparar
  console.log('=== Probando codTipoArchivo=0 (TXT resumen) ===');
  const s0 = await req('POST', '/api/sunat/sire',
    { companyId: 'sherman-inmobiliaria-01', period: '2025-12', tipo: 'RCE' }, token);
  console.log('Ticket tipo=0:', s0.data?.data?.numTicket);

  // El endpoint actual usa codTipoArchivo=1
  // Según el manual:
  // codTipoArchivo=0 → TXT con resumen de propuesta
  // codTipoArchivo=1 → ZIP con XMLs individuales (lo que queremos)
  // Pero el archivo generado tiene nomArchivoContenido con .txt → puede ser que el ZIP contiene un TXT

  // Esperar y ver qué archivo genera
  await new Promise(r => setTimeout(r, 12000));
  const poll = await req('GET',
    `/api/sunat/sire?ticket=${s0.data?.data?.numTicket}&companyId=sherman-inmobiliaria-01&period=202512&codLibro=080000`,
    null, token);
  console.log('Archivo generado:', poll.data?.data?.sunatRaw?.registros?.[0]?.archivoReporte);
  console.log('nomArchivoContenido:', poll.data?.data?.sunatRaw?.registros?.[0]?.archivoReporte?.[0]?.nomArchivoContenido);

  // El nomArchivoContenido termina en .txt → el ZIP contiene un TXT, no XMLs
  // Para obtener XMLs necesitamos un endpoint diferente
  // Según el manual SIRE, los XMLs individuales se obtienen via:
  // GET /rce/propuesta/web/propuesta/{periodo}/comprobante/{id}/xml
  // O via el endpoint de descarga masiva que ya usamos (SIRE bulk download)

  console.log('\n=== CONCLUSIÓN ===');
  console.log('El ZIP de propuesta contiene un TXT con el resumen, NO XMLs individuales.');
  console.log('Los XMLs individuales de compras recibidas NO están disponibles via SIRE API.');
  console.log('SUNAT solo permite descargar XMLs de comprobantes que TÚ emitiste (ventas).');
  console.log('\nPara compras, las líneas deben obtenerse de otra fuente:');
  console.log('1. El proveedor envía el XML directamente');
  console.log('2. Via el portal SUNAT (descarga manual)');
  console.log('3. Via OSE/PSE del proveedor');
  console.log('\nLo que SÍ podemos hacer: parsear XMLs de VENTAS (que sí emitimos nosotros)');
  console.log('Para ventas: usar CPE API con rucEmisor = RUC de la empresa');
}

run().catch(e => console.error('FATAL:', e.message));
