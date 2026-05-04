import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { getCredentialByCompany, findCompanyById } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { ok, unauthorized } from '@/lib/response';

const SIRE_HEADERS = (token: string) => ({
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

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const companyId = url.searchParams.get('companyId');
  const period    = url.searchParams.get('period') || '202601';
  const tipo      = (url.searchParams.get('tipo') || 'RVIE') as 'RVIE' | 'RCE';

  // 1. Conectividad básica
  const connectivity: Record<string, unknown>[] = [];
  for (const { name, u } of [
    { name: 'api-sire.sunat.gob.pe',       u: 'https://api-sire.sunat.gob.pe' },
    { name: 'api-seguridad.sunat.gob.pe',  u: 'https://api-seguridad.sunat.gob.pe' },
    { name: 'api.sunat.gob.pe',            u: 'https://api.sunat.gob.pe' },
  ]) {
    try {
      const start = Date.now();
      const r = await fetch(u, { signal: AbortSignal.timeout(5000) });
      connectivity.push({ name, status: r.status, ms: Date.now() - start, ok: true });
    } catch (e) {
      connectivity.push({ name, error: (e as Error).message, ok: false });
    }
  }

  if (!companyId) return ok({ server: 'Railway', connectivity });

  // 2. Cargar credenciales
  const cred    = await getCredentialByCompany(companyId);
  const company = await findCompanyById(companyId);
  if (!cred || !company) return ok({ server: 'Railway', connectivity, error: 'Sin credenciales para esta empresa' });

  const solPass = decrypt(cred.encryptedPass as string, cred.iv as string, cred.authTag as string);
  const clientId = cred.clientId as string | null;
  let clientSecret: string | null = null;
  if (cred.encClientSecret) {
    try {
      const p = JSON.parse(cred.encClientSecret as string) as { enc: string; iv: string; tag: string };
      clientSecret = decrypt(p.enc, p.iv, p.tag);
    } catch {}
  }

  const ruc      = company.ruc as string;
  const solUser  = cred.solUser as string;

  // 3. Obtener token SIRE
  let token = '';
  let tokenResult: Record<string, unknown> = {};
  try {
    const tokenRes = await fetch(
      `https://api-seguridad.sunat.gob.pe/v1/clientessol/${clientId}/oauth2/token/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'password',
          scope:         'https://api-sire.sunat.gob.pe',
          client_id:     clientId || '',
          client_secret: clientSecret || '',
          username:      `${ruc}${solUser}`,
          password:      solPass,
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
    const tokenBody = await tokenRes.text();
    tokenResult = {
      status:    tokenRes.status,
      ok:        tokenRes.ok,
      body:      tokenBody.substring(0, 500),
    };
    if (tokenRes.ok) {
      const j = JSON.parse(tokenBody) as { access_token: string; expires_in: number };
      token = j.access_token;
      tokenResult.expires_in  = j.expires_in;
      tokenResult.token_start = token.substring(0, 40) + '...';
    }
  } catch (e) {
    tokenResult = { error: (e as Error).message };
  }

  if (!token) return ok({ server: 'Railway', connectivity, ruc, solUser, clientId, tokenResult });

  // 4. Probar MÚLTIPLES variantes de URL de propuesta SIRE
  const variants = tipo === 'RVIE' ? [
    // Con RUC en URL (versión actual)
    `https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rvie/propuesta/web/propuesta/${ruc}/${period}/exportapropuesta?codTipoArchivo=0`,
    // Sin RUC en URL (versión original)
    `https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rvie/propuesta/web/propuesta/${period}/exportapropuesta?codTipoArchivo=0`,
    // Variante con /rvie/web/
    `https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rvie/web/propuesta/${ruc}/${period}/exportapropuesta?codTipoArchivo=0`,
  ] : [
    // Con RUC en URL (versión actual)
    `https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rce/propuesta/web/propuesta/${ruc}/${period}/exportacioncomprobantepropuesta?codTipoArchivo=0&codOrigenEnvio=2`,
    // Sin RUC en URL (versión original)
    `https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rce/propuesta/web/propuesta/${period}/exportacioncomprobantepropuesta?codTipoArchivo=0&codOrigenEnvio=2`,
    // Variante con /rce/web/
    `https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rce/web/propuesta/${ruc}/${period}/exportacioncomprobantepropuesta?codTipoArchivo=0&codOrigenEnvio=2`,
  ];

  const propuestaResults: Record<string, unknown>[] = [];
  for (const ep of variants) {
    try {
      const r = await fetch(ep, { headers: SIRE_HEADERS(token), signal: AbortSignal.timeout(15000) });
      const body = await r.text();
      propuestaResults.push({ url: ep, status: r.status, ok: r.ok, body: body.substring(0, 500) });
    } catch (e) {
      propuestaResults.push({ url: ep, error: (e as Error).message });
    }
  }

  return ok({ server: 'Railway', connectivity, ruc, solUser, clientId, tokenResult, propuestaResults });
}
