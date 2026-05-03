import { NextRequest } from 'next/server';
import { findUserByEmail, getDb } from '@/lib/db';
import { ok, err } from '@/lib/response';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return err('Email requerido');
    const user = await findUserByEmail(email);
    if (!user) return ok({ sent: true }); // don't reveal existence
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3_600_000).toISOString();
    const db = getDb();
    await db.execute({
      sql: 'UPDATE users SET resetToken=?,resetExpires=? WHERE id=?',
      args: [token, expires, String(user.id)],
    });
    try {
      const { sendPasswordResetEmail } = await import('@/lib/email');
      await sendPasswordResetEmail(String(email), token);
    } catch {
      console.log('[RESET URL]', `${process.env.APP_URL||'http://localhost:3000'}/reset-password?token=${token}`);
    }
    return ok({ sent: true });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
