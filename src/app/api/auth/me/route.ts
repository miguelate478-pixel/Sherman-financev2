import { NextRequest } from 'next/server';
import { findUserById } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, unauthorized } from '@/lib/response';

export async function GET(req: NextRequest) {
  const payload = await getUser(req);
  if (!payload) return unauthorized();
  const user = await findUserById(payload.sub);
  if (!user) return unauthorized();
  return ok({ ...user, avatar: (user.name as string).split(' ').map((n:string)=>n[0]).slice(0,2).join('') });
}
