import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { ok, err } from '@/lib/response';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return err('Token requerido');
  try {
    const r = await getDb().execute({
      sql: "SELECT id FROM users WHERE resetToken=? AND resetExpires > datetime('now')",
      args: [token],
    });
    return r.rows.length ? ok({ valid: true }) : err('Token inválido o expirado');
  } catch { return err('Token inválido'); }
}

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();
    if (!token || !newPassword || newPassword.length < 8) return err('Token y contraseña (mín. 8 chars) requeridos');
    const db = getDb();
    const r = await db.execute({
      sql: "SELECT id FROM users WHERE resetToken=? AND resetExpires > datetime('now')",
      args: [token],
    });
    if (!r.rows.length) return err('Token inválido o expirado');
    await db.execute({
      sql: 'UPDATE users SET password=?,resetToken=NULL,resetExpires=NULL,updatedAt=? WHERE id=?',
      args: [await bcrypt.hash(newPassword, 10), new Date().toISOString(), r.rows[0][0]],
    });
    return ok({ changed: true });
  } catch (e) { return err((e as Error).message, 500); }
}
