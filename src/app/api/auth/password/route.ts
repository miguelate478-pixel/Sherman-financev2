import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { findUserById, getDb } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized } from '@/lib/response';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const { currentPassword, newPassword } = await req.json();
    if (!newPassword || newPassword.length < 8) return err('La nueva contraseña debe tener al menos 8 caracteres');
    const dbUser = await findUserById(user.sub);
    if (!dbUser) return unauthorized();
    const valid = await bcrypt.compare(currentPassword, dbUser.password as string);
    if (!valid) return err('Contraseña actual incorrecta');
    const hash = await bcrypt.hash(newPassword, 10);
    await getDb().query(
      'UPDATE users SET password=$1,"updatedAt"=$2 WHERE id=$3',
      [hash, new Date().toISOString(), user.sub]
    );
    return ok({ changed: true });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
