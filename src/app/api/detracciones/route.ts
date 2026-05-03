import { NextRequest } from 'next/server';
import { getDetracciones, updateDetraccion, createAuditLog } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, unauthorized, getIP } from '@/lib/response';
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { resolveCompanyFilter } = await import('@/lib/auth');
  const p = new URL(req.url).searchParams;
  const { companyIds } = resolveCompanyFilter(user, p.get('companyId'));
  const d = await getDetracciones(companyIds !== null ? companyIds[0] : undefined);
  return ok(d.map((x:Record<string,unknown>)=>({id:x.id,doc:x.documentId,proveedor:x.provider,ruc:x.provRuc,monto:x.amount,pct:x.pct,codigo:x.code,cuenta_detr:x.account,estado:x.status,fecha_dep:x.depositDate})));
}
export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { documentId } = await req.json();
  const date = await updateDetraccion(documentId);
  await createAuditLog({ userId:user.sub, userEmail:user.email, userRole:user.role, action:'DETRACCION_DEPOSITADA', object:documentId, ip:getIP(req) });
  return ok({ updated:true, depositDate:date });
}
