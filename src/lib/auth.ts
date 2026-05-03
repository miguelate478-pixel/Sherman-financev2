import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'sherman-finance-v2-jwt-secret-min-32-chars-secure'
);

export interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  companyIds: string[] | null; // null = acceso a todas (Administrador sin restricción)
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch { return null; }
}

export function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export async function getUser(req: NextRequest): Promise<JWTPayload | null> {
  const token = getToken(req);
  if (!token) return null;
  return verifyToken(token);
}

// Resuelve qué companyIds puede ver el usuario.
// Admin sin restricción (companyIds=null) → ve todas o filtra por pedido
// Usuario con empresas asignadas → solo las suyas
export function resolveCompanyFilter(user: JWTPayload, requestedId?: string | null) {
  const isGlobalAdmin = user.role === 'Administrador' && user.companyIds === null;
  if (isGlobalAdmin) {
    return { companyIds: requestedId ? [requestedId] : null, allowed: true };
  }
  const assigned = user.companyIds ?? [];
  if (requestedId) {
    const ok = assigned.includes(requestedId);
    return { companyIds: ok ? [requestedId] : [], allowed: ok };
  }
  return { companyIds: assigned, allowed: assigned.length > 0 };
}
