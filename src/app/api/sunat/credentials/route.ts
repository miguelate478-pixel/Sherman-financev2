import { NextRequest } from 'next/server';
import { findCompanyById, getCredentialByCompany, upsertCredential, updateCredentialStatus, createAuditLog } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { encrypt, decrypt } from '@/lib/crypto';
import { ok, err, unauthorized, getIP } from '@/lib/response';
import { DirectSunatProvider, MockSunatProvider } from '@/lib/providers/sunat';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const companyId = new URL(req.url).searchParams.get('companyId');
  if (!companyId) return err('companyId requerido');
  const cred = await getCredentialByCompany(companyId);
  if (!cred) return ok(null);
  return ok({
    id: cred.id,
    companyId: cred.companyId,
    solUser: cred.solUser,
    clientId: cred.clientId,
    hasClientId: !!cred.clientId,
    provider: cred.provider,
    status: cred.status,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const { companyId, solUser, solPass, clientId, clientSecret } = await req.json();
    if (!companyId || !solUser || !solPass) return err('companyId, solUser y solPass requeridos');

    const { encrypted: encPass, iv: ivPass, authTag: tagPass } = encrypt(solPass);
    let encClientSecret: string | null = null;
    if (clientSecret) {
      const e = encrypt(clientSecret);
      encClientSecret = JSON.stringify({ enc: e.encrypted, iv: e.iv, tag: e.authTag });
    }

    await upsertCredential(companyId, {
      solUser,
      encryptedPass: encPass,
      iv: ivPass,
      authTag: tagPass,
      clientId: clientId || null,
      encClientSecret,
    });

    await createAuditLog({
      userId: user.sub, userEmail: user.email, userRole: user.role,
      action: 'CREDENTIALS_SAVED', object: companyId, ip: getIP(req),
    });
    return ok({ status: 'guardadas' });
  } catch (e) { return err((e as Error).message, 500); }
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const { companyId } = await req.json();
    const cred    = await getCredentialByCompany(companyId);
    const company = await findCompanyById(companyId);
    if (!cred || !company) return err('Sin credenciales. Guárdalas primero.');

    const solPass  = decrypt(cred.encryptedPass as string, cred.iv as string, cred.authTag as string);
    const clientId = cred.clientId as string | null;
    let clientSecret: string | null = null;

    if (cred.encClientSecret) {
      try {
        const p = JSON.parse(cred.encClientSecret as string) as { enc: string; iv: string; tag: string };
        clientSecret = decrypt(p.enc, p.iv, p.tag);
      } catch {
        // fallback: try direct decrypt (legacy format)
        try { clientSecret = decrypt(cred.encClientSecret as string, cred.iv as string, cred.authTag as string); } catch {}
      }
    }

    if (!clientId) return err('Client ID no ingresado. Llena el campo Client ID y guarda primero.');

    let status = 'verified', message = '', hasCpeToken = false, hasSireToken = false;

    if (process.env.SUNAT_PROVIDER === 'direct') {
      const provider = new DirectSunatProvider();
      try {
        await provider.getToken(clientId, clientSecret ?? undefined);
        hasCpeToken = true;
        try {
          await provider.getSireToken(company.ruc as string, cred.solUser as string, solPass, clientId, clientSecret ?? undefined);
          hasSireToken = true;
          message = 'CPE ✓ + SIRE ✓ — Conectado a SUNAT correctamente';
        } catch (e2) {
          message = 'CPE ✓ — SIRE error: ' + (e2 as Error).message;
          status = 'partial';
        }
      } catch (e1) {
        status = 'error';
        message = (e1 as Error).message;
      }
    } else {
      await new MockSunatProvider().getToken();
      hasCpeToken = true; hasSireToken = true;
      message = 'Modo simulación — OK';
    }

    await updateCredentialStatus(companyId, status);
    await createAuditLog({
      userId: user.sub, userEmail: user.email, userRole: user.role,
      action: 'CREDENTIALS_TESTED', object: `${companyId}→${status}`, ip: getIP(req),
    });
    return ok({ status, message, hasCpeToken, hasSireToken });
  } catch (e) { return err((e as Error).message, 500); }
}
