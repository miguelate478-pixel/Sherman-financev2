import { NextRequest } from 'next/server';
import { getAllCompanies, queryAll } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, unauthorized, err } from '@/lib/response';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'Administrador') return err('Solo Administradores', 403);

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || new Date().toISOString().slice(0, 7);

  const companies = await getAllCompanies() as Record<string, unknown>[];
  // Incluir todas las empresas (activas, prueba, o sin status definido)
  // Solo excluir las explícitamente inactivas
  const activas = companies.filter(c => c.status !== 'inactivo');

  const results = await Promise.all(activas.map(async (company) => {
    const cid = company.id as string;

    const [docs, detrRows, cxpRows, obsRows] = await Promise.all([
      queryAll(
        `SELECT operation, SUM(ABS(total)) as monto, SUM(ABS(igv)) as igv_sum, COUNT(*) as cnt
         FROM documents WHERE "companyId"=$1 AND period=$2
         GROUP BY operation`,
        [cid, period]
      ),
      queryAll(
        `SELECT COUNT(*) as n, SUM(amount) as monto FROM detractions
         WHERE "companyId"=$1 AND status='PENDIENTE'`,
        [cid]
      ),
      queryAll(
        `SELECT COUNT(*) as n, SUM(amount) as monto FROM cxp_records
         WHERE "companyId"=$1 AND status='PENDIENTE' AND "dueDate"::date <= CURRENT_DATE`,
        [cid]
      ),
      queryAll(
        `SELECT COUNT(*) as n FROM documents
         WHERE "companyId"=$1 AND "sunatStatus"='OBSERVADO'`,
        [cid]
      ),
    ]);

    const comprasRow = docs.find(d => d.operation === 'COMPRA') as Record<string,unknown> | undefined;
    const ventasRow  = docs.find(d => d.operation === 'VENTA')  as Record<string,unknown> | undefined;

    const totalCompras = Number(comprasRow?.monto || 0);
    const totalVentas  = Number(ventasRow?.monto  || 0);
    const igvCredito   = Number(comprasRow?.igv_sum || 0);
    const igvDebito    = Number(ventasRow?.igv_sum  || 0);
    const igvNeto      = igvDebito - igvCredito;

    const detrPendN  = parseInt(String((detrRows[0] as Record<string,string>)?.n  || '0'));
    const detrMonto  = Number((detrRows[0] as Record<string,unknown>)?.monto || 0);
    const cxpVencN   = parseInt(String((cxpRows[0] as Record<string,string>)?.n   || '0'));
    const cxpMonto   = Number((cxpRows[0] as Record<string,unknown>)?.monto || 0);
    const obsN       = parseInt(String((obsRows[0] as Record<string,string>)?.n   || '0'));

    // Semáforo
    let semaforo: 'verde' | 'amarillo' | 'rojo' = 'verde';
    if (cxpVencN > 0 || obsN > 0) semaforo = 'rojo';
    else if (detrPendN > 0) semaforo = 'amarillo';

    // Día 12 del mes siguiente para detracciones
    const [y, m] = period.split('-').map(Number);
    let dm = m + 1, dy = y;
    if (dm > 12) { dm = 1; dy++; }
    const fechaLimiteDetr = `12/${String(dm).padStart(2,'0')}/${dy}`;

    return {
      id:           cid,
      nombre:       String(company.businessName || company.nombre || company.ruc || ''),
      ruc:          String(company.ruc || ''),
      sector:       String(company.sector || ''),
      credEstado:   (company.credential as Record<string,unknown>)?.status || 'sin_configurar',
      totalCompras,
      totalVentas,
      igvCredito,
      igvDebito,
      igvNeto,
      docsCompras:  Number(comprasRow?.cnt || 0),
      docsVentas:   Number(ventasRow?.cnt  || 0),
      detrPendN,
      detrMonto,
      cxpVencN,
      cxpMonto,
      obsN,
      semaforo,
      fechaLimiteDetr,
    };
  }));

  // Ordenar: rojos primero, luego amarillos, luego verdes
  const orden = { rojo: 0, amarillo: 1, verde: 2 };
  results.sort((a, b) => orden[a.semaforo] - orden[b.semaforo]);

  return ok({ period, empresas: results, total: results.length });
}
