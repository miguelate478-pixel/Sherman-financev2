import { NextRequest } from 'next/server';
import { getAuditLogs, createAuditLog } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, unauthorized } from '@/lib/response';
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const logs = await getAuditLogs();
  return ok(logs.map((l:Record<string,unknown>)=>({id:l.id,ts:new Date(l.createdAt as string).toLocaleString('es-PE'),user:l.userEmail,rol:l.userRole,accion:l.action,obj:l.object||'—',ip:l.ip||'—'})));
}
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { action, object } = await req.json();
  await createAuditLog({ userId:user.sub, userEmail:user.email, userRole:user.role, action, object });
  return ok({ logged:true });
}
