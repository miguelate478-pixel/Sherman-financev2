import { NextRequest } from 'next/server';
import { getAllCompanies, queryAll, execute } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized } from '@/lib/response';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'Administrador') return err('Solo Administradores', 403);

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || new Date().toISOString().slice(0, 7);

  const companies = await getAllCompanies() as Record<string, unknown>[];

  const results = await Promise.all(companies.map(async (c) => {
    const cid = c.id as string;

    const [usersCount, docsMonth, lastJob] = await Promise.all([
      queryAll(`SELECT COUNT(*) as n FROM users WHERE "companyIds" LIKE $1 AND status='activo'`, [`%${cid}%`]),
      queryAll(`SELECT COUNT(*) as n FROM documents WHERE "companyId"=$1 AND period=$2`, [cid, period]),
      queryAll(`SELECT "completedAt", "docsFound" FROM bulk_jobs WHERE "companyId"=$1 ORDER BY "createdAt" DESC LIMIT 1`, [cid]),
    ]);

    const lastJobRow = lastJob[0] as Record<string, unknown> | undefined;

    return {
      id:           cid,
      nombre:       String(c.businessName || c.nombre || c.ruc || ''),
      ruc:          String(c.ruc || ''),
      sector:       String(c.sector || ''),
      status:       String(c.status || 'activo'),
      plan:         String((c as Record<string,unknown>).plan || 'Básico'),
      usuarios:     parseInt(String((usersCount[0] as Record<string,string>)?.n || '0')),
      docsEsteMes:  parseInt(String((docsMonth[0] as Record<string,string>)?.n || '0')),
      ultimaDescarga: lastJobRow?.completedAt ? String(lastJobRow.completedAt).split('T')[0] : null,
      credEstado:   (c.credential as Record<string,unknown>)?.status || 'sin_configurar',
    };
  }));

  // Métricas
  const activos   = results.filter(c => c.status === 'activo').length;
  const prueba    = results.filter(c => c.status === 'prueba').length;
  const conDescarga = results.filter(c => c.ultimaDescarga && c.ultimaDescarga >= period).length;

  const PRECIOS: Record<string, number> = { 'Básico': 99, 'Profesional': 199, 'Empresa': 399 };
  const ingresosEstimados = results
    .filter(c => c.status === 'activo')
    .reduce((s, c) => s + (PRECIOS[c.plan] || 99), 0);

  return ok({
    empresas: results,
    metricas: { activos, prueba, ingresosEstimados, conDescarga, total: results.length },
    period,
  });
}

// PATCH — cambiar estado o plan
export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'Administrador') return err('Solo Administradores', 403);

  const { id, status, plan } = await req.json();
  if (!id) return err('id requerido');

  if (status) {
    await execute(`UPDATE companies SET status=$1,"updatedAt"=NOW() WHERE id=$2`, [status, id]);
  }
  if (plan) {
    await execute(`UPDATE companies SET plan=$1,"updatedAt"=NOW() WHERE id=$2`, [plan, id]);
  }

  return ok({ updated: true });
}
