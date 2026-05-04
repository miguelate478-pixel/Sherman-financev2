import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { findUserByEmail, updateUserLastLogin, createAuditLog } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { ok, err, getIP } from '@/lib/response';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return err('Email y contraseña requeridos');

    const user = await findUserByEmail(email);
    if (!user) return err('Credenciales incorrectas', 401);
    if (user.status === 'revocado') return err('Cuenta desactivada', 403);

    const valid = await bcrypt.compare(password, user.password as string);
    if (!valid) return err('Credenciales incorrectas', 401);

    await updateUserLastLogin(user.id as string);
    await createAuditLog({
      userId: user.id, userEmail: user.email, userRole: user.role,
      action: 'LOGIN', ip: getIP(req),
    });

    // Parse companyIds — null means access to ALL companies
    let companyIds: string[] | null = null;
    if (user.companyIds) {
      try { 
        const parsed = JSON.parse(user.companyIds as string);
        // Only restrict if it's a non-empty array
        companyIds = Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
      } catch { companyIds = null; }
    }

    const token = await signToken({
      sub:        user.id as string,
      email:      user.email as string,
      name:       user.name as string,
      role:       user.role as string,
      companyIds, // null = ve todo (admin global)
    });

    const avatar = (user.name as string).split(' ').map((n: string) => n[0]).slice(0, 2).join('');
    return ok({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar, companyIds },
    });
  } catch (e) {
    console.error('[LOGIN]', e);
    return err('Error interno', 500);
  }
}
