const clientId     = 'f62b2812-1afb-4d70-8d74-7c444bdfae4c';
const clientSecret = 'e2bquIu+yJt1vREhnvoTHA==';
const ruc          = '20610169849';
const solUser      = 'SHERMAN1';
const solPass      = 'Sherman2026!';
const period       = '202601'; // 2026-01
const tipo         = 'RCE';   // COMPRAS

const SIRE_HEADERS = (token) => ({
  'Authorization':   `Bearer ${token}`,
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'es-419,es;q=0.9',
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  'Origin':          'https://e-factura.sunat.gob.pe',
  'Referer':         'https://e-factura.sunat.gob.pe/',
  'Sec-Fetch-Dest':  'empty',
  'Sec-Fetch-Mode':  'cors',
  'Sec-Fetch-Site':  'same-site',
});

async function run() {
  // 1. Obtener token
  console.log('\n🔑 Paso 1: Obteniendo token SIRE...');
  const tokenRes = await fetch(`https://api-seguridad.sunat.gob.pe/v1/clientessol/${clientId}/oauth2/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'password',
      scope:         'https://api-sire.sunat.gob.pe',
      client_id:     clientId,
      client_secret: clientSecret,
      username:      `${ruc}${solUser}`,
      password:      solPass,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    console.log('❌ Error token:', tokenData);
    return;
  }
  const token = tokenData.access_token;
  console.log(`✅ Token OK | expires_in: ${tokenData.expires_in}s`);
  console.log(`   Token: ${token.substring(0, 60)}...`);

  // 2. Probar propuesta RCE (compras)
  const epRCE = `https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rce/propuesta/web/propuesta/${ruc}/${period}/exportacioncomprobantepropuesta?codTipoArchivo=0&codOrigenEnvio=2`;
  console.log(`\n📋 Paso 2: Propuesta RCE`);
  console.log(`   URL: ${epRCE}`);
  const rceRes = await fetch(epRCE, { headers: SIRE_HEADERS(token) });
  const rceBody = await rceRes.text();
  console.log(`   HTTP: ${rceRes.status}`);
  console.log(`   Body: ${rceBody.substring(0, 500)}`);

  // 3. Probar propuesta RVIE (ventas)
  const epRVIE = `https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rvie/propuesta/web/propuesta/${ruc}/${period}/exportapropuesta?codTipoArchivo=0`;
  console.log(`\n📋 Paso 3: Propuesta RVIE`);
  console.log(`   URL: ${epRVIE}`);
  const rvieRes = await fetch(epRVIE, { headers: SIRE_HEADERS(token) });
  const rvieBody = await rvieRes.text();
  console.log(`   HTTP: ${rvieRes.status}`);
  console.log(`   Body: ${rvieBody.substring(0, 500)}`);
}

run().catch(console.error);
