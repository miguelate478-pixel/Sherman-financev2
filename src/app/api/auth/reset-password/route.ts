import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { ok, err } from '@/lib/response';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return err('Token requerido');
  try {
    const db = getDb();
    const r = await db.query(
      'SELECT id FROM users WHERE "resetToken"=$1 AND "resetExpires" > $2',
      [token, new Date().toISOString()]
    );
    return r.rows.length ? ok({ valid: true }) : err('Token inválido o expirado');
  } catch { return err('Token inválido'); }
}

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();
    if (!token || !newPassword || newPassword.length < 8) return err('Token y contraseña (mín. 8 chars) requeridos');
    const db = getDb();
    const r = await db.query(
      'SELECT id FROM users WHERE "resetToken"=$1 AND "resetExpires" > $2',
      [token, new Date().toISOString()]
    );
    if (!r.rows.length) return err('Token inválido o expirado');
    await db.query(
      'UPDATE users SET password=$1,"resetToken"=NULL,"resetExpires"=NULL,"updatedAt"=$2 WHERE id=$3',
      [await bcrypt.hash(newPassword, 10), new Date().toISOString(), r.rows[0].id]
    );
    return ok({ changed: true });
  } catch (e) { return err((e as Error).message, 500); }
}
