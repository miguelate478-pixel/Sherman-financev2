import { NextRequest } from 'next/server';
import { getBankMovements, updateBankMovement, createAuditLog } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, unauthorized, getIP } from '@/lib/response';
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { resolveCompanyFilter } = await import('@/lib/auth');
  const p = new URL(req.url).searchParams;
  const { companyIds } = resolveCompanyFilter(user, p.get('companyId'));
  const targetCompanyId = companyIds !== null ? companyIds[0] : undefined;
  const m = await getBankMovements(targetCompanyId);
  return ok(m.map((mv:Record<string,unknown>)=>({id:mv.id,fecha:mv.date,desc:mv.description,tipo:mv.type,monto:mv.amount,saldo:mv.balance,conciliado:!!mv.reconciled,match:mv.matchDocId,match_rs:mv.matchName})));
}
export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { id, matchDocId, matchName } = await req.json();
  await updateBankMovement(id, matchDocId, matchName);
  await createAuditLog({ userId:user.sub, userEmail:user.email, userRole:user.role, action:'BANCO_CONCILIADO', object:id, ip:getIP(req) });
  return ok({ updated:true });
}
