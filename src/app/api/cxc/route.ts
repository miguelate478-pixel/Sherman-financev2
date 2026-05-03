import { NextRequest } from 'next/server';
import { getCxc } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, unauthorized } from '@/lib/response';
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { resolveCompanyFilter } = await import('@/lib/auth');
  const p = new URL(req.url).searchParams;
  const { companyIds } = resolveCompanyFilter(user, p.get('companyId'));
  return ok(await getCxc(companyIds !== null ? companyIds[0] : undefined));
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { id, amount } = await req.json();
  const { markCxcPaid } = await import('@/lib/db');
  await markCxcPaid(id, amount);
  return ok({ updated: true });
}
