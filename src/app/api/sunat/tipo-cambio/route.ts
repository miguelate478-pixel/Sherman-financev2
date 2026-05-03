import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { ok, unauthorized } from '@/lib/response';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const fecha = new URL(req.url).searchParams.get('fecha') || new Date().toISOString().slice(0,10);
  try {
    const res = await fetch(`https://api.apis.net.pe/v2/sunat/tipo-cambio?fecha=${fecha}`,
      { headers:{ Accept:'application/json' }, signal:AbortSignal.timeout(4000) });
    if (res.ok) return ok({ fecha, fuente:'SBS', ...(await res.json()) });
  } catch {}
  return ok({ fecha, fuente:'fallback', compra:3.72, venta:3.75, moneda:'USD', nota:'SBS API no disponible — valores aproximados' });
}
