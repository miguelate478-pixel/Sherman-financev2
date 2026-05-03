import { NextRequest } from 'next/server';
import { getCxp } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, unauthorized } from '@/lib/response';
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { resolveCompanyFilter } = await import('@/lib/auth');
  const p = new URL(req.url).searchParams;
  const { companyIds } = resolveCompanyFilter(user, p.get('companyId'));
  return ok(await getCxp(companyIds !== null ? companyIds[0] : undefined));
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { id, amount } = await req.json();
  const { markCxpPaid } = await import('@/lib/db');
  await markCxpPaid(id, amount);
  return ok({ updated: true });
}
