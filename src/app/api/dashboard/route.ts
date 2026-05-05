import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, unauthorized } from '@/lib/response';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  const period    = searchParams.get('period') || new Date().toISOString().slice(0, 7);

  const db = getDb();

  // Calcular últimos 6 meses
  const [y, m] = period.split('-').map(Number);
  const periodos: string[] = [];
  for (let i = 5; i >= 0; i--) {
    let pm = m - i; let py = y;
    if (pm <= 0) { pm += 12; py -= 1; }
    periodos.push(`${py}-${String(pm).padStart(2,'0')}`);
  }
  const periodoInicio = periodos[0];

  const cargs = companyId ? [companyId] : [];

  // Queries paralelas
  const [docs, detrs, movs, cxc, cxp, chartRaw, topProvRaw, ultimosRaw] = await Promise.all([
    // Docs del período actual
    companyId
      ? db.query('SELECT * FROM documents WHERE "companyId"=$1 AND period=$2', [companyId, period])
      : db.query('SELECT * FROM documents WHERE period=$1', [period]),
    // Detracciones
    companyId
      ? db.query('SELECT * FROM detractions WHERE "companyId"=$1', cargs)
      : db.query('SELECT * FROM detractions'),
    // Movimientos bancarios
    companyId
      ? db.query('SELECT * FROM bank_movements WHERE "companyId"=$1', cargs)
      : db.query('SELECT * FROM bank_movements'),
    // CxC
    companyId
      ? db.query('SELECT * FROM cxc_records WHERE "companyId"=$1', cargs)
      : db.query('SELECT * FROM cxc_records'),
    // CxP
    companyId
      ? db.query('SELECT * FROM cxp_records WHERE "companyId"=$1', cargs)
      : db.query('SELECT * FROM cxp_records'),
    // Compras vs Ventas últimos 6 meses
    companyId
      ? db.query(
          `SELECT period, operation, SUM(ABS(total)) as "totalMonto", SUM(ABS(igv)) as "totalIgv", COUNT(*) as cantidad
           FROM documents WHERE "companyId"=$1 AND period >= $2
           GROUP BY period, operation ORDER BY period ASC`,
          [companyId, periodoInicio]
        )
      : db.query(
          `SELECT period, operation, SUM(ABS(total)) as "totalMonto", SUM(ABS(igv)) as "totalIgv", COUNT(*) as cantidad
           FROM documents WHERE period >= $1
           GROUP BY period, operation ORDER BY period ASC`,
          [periodoInicio]
        ),
    // Top 5 proveedores del mes actual
    companyId
      ? db.query(
          `SELECT "issuerName", "issuerRuc", SUM(ABS(total)) as "totalMonto", COUNT(*) as cantidad
           FROM documents WHERE "companyId"=$1 AND operation='COMPRA' AND period=$2
           GROUP BY "issuerRuc", "issuerName" ORDER BY "totalMonto" DESC LIMIT 5`,
          [companyId, period]
        )
      : db.query(
          `SELECT "issuerName", "issuerRuc", SUM(ABS(total)) as "totalMonto", COUNT(*) as cantidad
           FROM documents WHERE operation='COMPRA' AND period=$1
           GROUP BY "issuerRuc", "issuerName" ORDER BY "totalMonto" DESC LIMIT 5`,
          [period]
        ),
    // Últimos 5 documentos
    companyId
      ? db.query(
          `SELECT id, operation, "docType", serie, number, "issuerName", "receiverName", "issueDate", total, "sunatStatus"
           FROM documents WHERE "companyId"=$1 ORDER BY "createdAt" DESC LIMIT 5`,
          [companyId]
        )
      : db.query(
          `SELECT id, operation, "docType", serie, number, "issuerName", "receiverName", "issueDate", total, "sunatStatus"
           FROM documents ORDER BY "createdAt" DESC LIMIT 5`
        ),
  ]);

  const docList  = docs.rows;
  const detrList = detrs.rows;
  const movList  = movs.rows;
  const cxcList  = cxc.rows;
  const cxpList  = cxp.rows;

  const compras = docList.filter((d: Record<string,unknown>) => d.operation === 'COMPRA');
  const ventas  = docList.filter((d: Record<string,unknown>) => d.operation === 'VENTA');

  const totalCompras = compras.reduce((s: number, d: Record<string,unknown>) => s + Math.abs(Number(d.total)), 0);
  const totalVentas  = ventas.reduce((s: number, d: Record<string,unknown>) => s + Math.abs(Number(d.total)), 0);
  const igvCredito   = compras.filter((d: Record<string,unknown>) => d.sunatStatus === 'ACEPTADO').reduce((s: number, d: Record<string,unknown>) => s + Math.abs(Number(d.igv)), 0);
  const igvDebito    = ventas.filter((d: Record<string,unknown>) => d.sunatStatus === 'ACEPTADO').reduce((s: number, d: Record<string,unknown>) => s + Math.abs(Number(d.igv)), 0);
  const saldoBanco   = movList.length ? Number(movList[movList.length - 1].balance) : 0;

  // Construir chart data por período
  const chartMap: Record<string, { period: string; compras: number; ventas: number; igvCompras: number; igvVentas: number }> = {};
  for (const p of periodos) chartMap[p] = { period: p, compras: 0, ventas: 0, igvCompras: 0, igvVentas: 0 };
  for (const row of chartRaw.rows) {
    const p = row.period as string;
    if (!chartMap[p]) continue;
    if (row.operation === 'COMPRA') {
      chartMap[p].compras    = Math.round(Number(row.totalMonto) * 100) / 100;
      chartMap[p].igvCompras = Math.round(Number(row.totalIgv) * 100) / 100;
    } else {
      chartMap[p].ventas    = Math.round(Number(row.totalMonto) * 100) / 100;
      chartMap[p].igvVentas = Math.round(Number(row.totalIgv) * 100) / 100;
    }
  }
  const chartData = Object.values(chartMap);

  // Top proveedores
  const topProveedores = topProvRaw.rows.map((r: Record<string,unknown>) => ({
    nombre: String(r.issuerName || '').substring(0, 30),
    ruc:    String(r.issuerRuc || ''),
    monto:  Math.round(Number(r.totalMonto) * 100) / 100,
    cantidad: Number(r.cantidad),
  }));

  // Últimos documentos
  const ultimosDocs = ultimosRaw.rows.map((r: Record<string,unknown>) => ({
    id:         String(r.id),
    op:         String(r.operation),
    tipo:       String(r.docType),
    serie:      String(r.serie),
    numero:     String(r.number),
    contraparte: r.operation === 'COMPRA' ? String(r.issuerName || '') : String(r.receiverName || ''),
    fecha:      String(r.issueDate || ''),
    total:      Number(r.total),
    sunat:      String(r.sunatStatus || ''),
  }));

  // Alertas
  const alerts: { type: string; level: 'warning' | 'error' | 'info'; message: string; count?: number; amount?: number }[] = [];

  const detrPendientes = detrList.filter((d: Record<string,unknown>) => d.status === 'PENDIENTE');
  if (detrPendientes.length > 0) {
    const monto = detrPendientes.reduce((s: number, d: Record<string,unknown>) => s + Number(d.amount), 0);
    alerts.push({ type: 'detracciones', level: 'error', message: `${detrPendientes.length} detracción(es) pendiente(s) de depósito`, count: detrPendientes.length, amount: monto });
  }

  const docsObservados = docList.filter((d: Record<string,unknown>) => d.sunatStatus === 'OBSERVADO');
  if (docsObservados.length > 0) alerts.push({ type: 'sunat', level: 'warning', message: `${docsObservados.length} comprobante(s) observados en SUNAT`, count: docsObservados.length });

  const cxpVencidas = cxpList.filter((r: Record<string,unknown>) => r.status === 'VENCIDO');
  if (cxpVencidas.length > 0) {
    const monto = cxpVencidas.reduce((s: number, r: Record<string,unknown>) => s + Number(r.amount), 0);
    alerts.push({ type: 'cxp', level: 'error', message: `${cxpVencidas.length} cuenta(s) por pagar vencida(s)`, count: cxpVencidas.length, amount: monto });
  }

  const cxpPorVencer = cxpList.filter((r: Record<string,unknown>) => r.status === 'POR_VENCER');
  if (cxpPorVencer.length > 0) {
    const monto = cxpPorVencer.reduce((s: number, r: Record<string,unknown>) => s + Number(r.amount), 0);
    alerts.push({ type: 'cxp_warn', level: 'warning', message: `${cxpPorVencer.length} cuenta(s) por pagar próximas a vencer`, count: cxpPorVencer.length, amount: monto });
  }

  const cxcVencidas = cxcList.filter((r: Record<string,unknown>) => r.status === 'VENCIDO');
  if (cxcVencidas.length > 0) {
    const monto = cxcVencidas.reduce((s: number, r: Record<string,unknown>) => s + Number(r.amount), 0);
    alerts.push({ type: 'cxc', level: 'warning', message: `${cxcVencidas.length} cuenta(s) por cobrar vencida(s)`, count: cxcVencidas.length, amount: monto });
  }

  const pendientesConcar = docList.filter((d: Record<string,unknown>) => d.concarStatus === 'LISTO');
  if (pendientesConcar.length > 5) alerts.push({ type: 'concar', level: 'info', message: `${pendientesConcar.length} documentos listos para exportar a CONCAR`, count: pendientesConcar.length });

  const noConc = movList.filter((m: Record<string,unknown>) => !m.reconciled);
  if (noConc.length > 5) alerts.push({ type: 'bancos', level: 'info', message: `${noConc.length} movimientos bancarios sin conciliar`, count: noConc.length });

  return ok({
    period,
    kpis: {
      totalCompras, totalVentas,
      igvCredito, igvDebito,
      igvNeto: igvDebito - igvCredito,
      saldoBanco,
      docsTotal: docList.length, docsCompras: compras.length, docsVentas: ventas.length,
      docsAceptados: docList.filter((d: Record<string,unknown>) => d.sunatStatus === 'ACEPTADO').length,
      docsObservados: docsObservados.length,
      docsParaConcar: pendientesConcar.length,
      docsParseados: docList.filter((d: Record<string,unknown>) => d.parserStatus === 'PARSEADO').length,
      docsClasificados: docList.filter((d: Record<string,unknown>) => d.aiStatus === 'CLASIFICADO').length,
      detrPendientes: detrPendientes.length,
      detrMonto: detrPendientes.reduce((s: number, d: Record<string,unknown>) => s + Number(d.amount), 0),
      movSinConc: noConc.length,
      cxcTotal: cxcList.reduce((s: number, r: Record<string,unknown>) => s + Number(r.amount), 0),
      cxpTotal: cxpList.filter((r: Record<string,unknown>) => r.status !== 'PAGADO').reduce((s: number, r: Record<string,unknown>) => s + Number(r.amount), 0),
    },
    chartData,
    topProveedores,
    ultimosDocs,
    alerts,
  });
}
