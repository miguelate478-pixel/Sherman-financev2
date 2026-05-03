import { NextRequest } from 'next/server';
import { getAllUsers, createUser, updateUserStatus, createAuditLog, getDb } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized, forbidden, getIP } from '@/lib/response';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const users = await getAllUsers();
  return ok(users.map((u: Record<string,unknown>) => ({
    id: u.id, nombre: u.name, email: u.email, rol: u.role,
    mfa: !!u.mfaEnabled, estado: u.status,
    ultimo: u.lastLogin ? new Date(u.lastLogin as string).toLocaleString('es-PE') : '—',
    companyIds: u.companyIds ? (() => { try { return JSON.parse(u.companyIds as string); } catch { return []; } })() : null,
  })));
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'Administrador') return forbidden();

  try {
    const { name, email, role, mfaEnabled, password, companyIds } = await req.json();
    if (!name?.trim()) return err('Nombre requerido');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Email inválido');

    const pass = password || 'TempPass123!';
    const hash = await bcrypt.hash(pass, 10);

    // companyIds: null = acceso a todo (admin), [] o array = solo esas empresas
    const companyIdsJson = companyIds !== undefined && companyIds !== null
      ? JSON.stringify(Array.isArray(companyIds) ? companyIds : [])
      : null;

    const newUser = await createUser({ name, email, password: hash, role: role || 'Contador', mfaEnabled: !!mfaEnabled, companyIds: companyIdsJson });

    await createAuditLog({ userId: user.sub, userEmail: user.email, userRole: user.role, action: 'USER_CREATED', object: email, ip: getIP(req) });

    try {
      const { sendWelcomeEmail } = await import('@/lib/email');
      await sendWelcomeEmail(email, name, pass);
    } catch {}

    return ok({ ...newUser, tempPassword: pass }, 201);
  } catch (e: unknown) {
    return err((e as Error).message || 'Error', 500);
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'Administrador') return forbidden();

  try {
    const { id, status, companyIds, role } = await req.json();
    const db = getDb();
    const now = new Date().toISOString();

    if (status !== undefined) {
      await updateUserStatus(id, status);
    }

    if (companyIds !== undefined) {
      // null = acceso total, array = empresas específicas
      const val = companyIds === null ? null : JSON.stringify(Array.isArray(companyIds) ? companyIds : []);
      await db.execute({ sql: 'UPDATE users SET companyIds=?,updatedAt=? WHERE id=?', args: [val, now, id] });
    }

    if (role !== undefined) {
      await db.execute({ sql: 'UPDATE users SET role=?,updatedAt=? WHERE id=?', args: [role, now, id] });
    }

    await createAuditLog({ userId: user.sub, userEmail: user.email, userRole: user.role, action: 'USER_UPDATED', object: id, ip: getIP(req) });
    return ok({ updated: true });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
