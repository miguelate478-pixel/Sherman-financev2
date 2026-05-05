import { NextRequest } from 'next/server';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { getDb } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized } from '@/lib/response';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const { action, token } = await req.json();
    const db = getDb();

    if (action === 'setup') {
      const secret = speakeasy.generateSecret({ name: `Sherman Finance (${user.email})`, length: 20 });
      await db.query('UPDATE users SET "mfaSecret"=$1 WHERE id=$2', [secret.base32, user.sub]);
      const qrUrl = await QRCode.toDataURL(secret.otpauth_url!);
      return ok({ secret: secret.base32, qrCode: qrUrl });
    }

    if (action === 'verify') {
      const r = await db.query('SELECT "mfaSecret" FROM users WHERE id=$1', [user.sub]);
      const secret = r.rows[0]?.mfaSecret as string;
      if (!secret) return err('MFA no configurado');
      const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
      if (!valid) return err('Código inválido');
      await db.query('UPDATE users SET "mfaEnabled"=true WHERE id=$1', [user.sub]);
      return ok({ enabled: true });
    }

    if (action === 'disable') {
      await db.query('UPDATE users SET "mfaEnabled"=false,"mfaSecret"=NULL WHERE id=$1', [user.sub]);
      return ok({ disabled: true });
    }

    return err('Acción no válida');
  } catch (e) { return err((e as Error).message, 500); }
}
