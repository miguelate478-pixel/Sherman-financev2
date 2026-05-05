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
  const cargs = companyId ? [companyId] : [];

  const [docs, detrs, movs, cxc, cxp] = await Promise.all([
    companyId
      ? db.query('SELECT * FROM documents WHERE "companyId"=$1 AND period=$2', [companyId, period])
      : db.query('SELECT * FROM documents WHERE period=$1', [period]),
    companyId
      ? db.query('SELECT * FROM detractions WHERE "companyId"=$1', cargs)
      : db.query('SELECT * FROM detractions'),
    companyId
      ? db.query('SELECT * FROM bank_movements WHERE "companyId"=$1', cargs)
      : db.query('SELECT * FROM bank_movements'),
    companyId
      ? db.query('SELECT * FROM cxc_records WHERE "companyId"=$1', cargs)
      : db.query('SELECT * FROM cxc_records'),
    companyId
      ? db.query('SELECT * FROM cxp_records WHERE "companyId"=$1', cargs)
      : db.query('SELECT * FROM cxp_records'),
  ]);

  const docList  = docs.rows;
  const detrList = detrs.rows;
  const movList  = movs.rows;
  const cxcList  = cxc.rows;
  const cxpList  = cxp.rows;

  const compras = docList.filter((d: Record<string,unknown>) => d.operation === 'COMPRA');
  const ventas  = docList.filter((d: Record<string,unknown>) => d.operation === 'VENTA');

  const totalCompras = compras.reduce((s: number, d: Record<string,unknown>) => s + Math.abs(d.total as number), 0);
  const totalVentas  = ventas.reduce((s: number, d: Record<string,unknown>) => s + (d.total as number), 0);
  const igvCredito   = compras.filter((d: Record<string,unknown>) => d.sunatStatus === 'ACEPTADO' && d.currency === 'PEN').reduce((s: number, d: Record<string,unknown>) => s + Math.abs(d.igv as number), 0);
  const saldoBanco   = movList.length ? (movList[movList.length - 1].balance as number) : 0;

  const alerts: { type: string; level: 'warning' | 'error' | 'info'; message: string; count?: number; amount?: number }[] = [];

  const detrPendientes = detrList.filter((d: Record<string,unknown>) => d.status === 'PENDIENTE');
  if (detrPendientes.length > 0) {
    const monto = detrPendientes.reduce((s: number, d: Record<string,unknown>) => s + (d.amount as number), 0);
    alerts.push({ type: 'detracciones', level: 'error', message: `${detrPendientes.length} detracción(es) pendiente(s) de depósito`, count: detrPendientes.length, amount: monto });
  }

  const docsObservados = docList.filter((d: Record<string,unknown>) => d.sunatStatus === 'OBSERVADO');
  if (docsObservados.length > 0) alerts.push({ type: 'sunat', level: 'warning', message: `${docsObservados.length} comprobante(s) observados en SUNAT`, count: docsObservados.length });

  const cxpVencidas = cxpList.filter((r: Record<string,unknown>) => r.status === 'VENCIDO');
  if (cxpVencidas.length > 0) {
    const monto = cxpVencidas.reduce((s: number, r: Record<string,unknown>) => s + (r.amount as number), 0);
    alerts.push({ type: 'cxp', level: 'error', message: `${cxpVencidas.length} cuenta(s) por pagar vencida(s)`, count: cxpVencidas.length, amount: monto });
  }

  const cxpPorVencer = cxpList.filter((r: Record<string,unknown>) => r.status === 'POR_VENCER');
  if (cxpPorVencer.length > 0) {
    const monto = cxpPorVencer.reduce((s: number, r: Record<string,unknown>) => s + (r.amount as number), 0);
    alerts.push({ type: 'cxp_warn', level: 'warning', message: `${cxpPorVencer.length} cuenta(s) por pagar próximas a vencer`, count: cxpPorVencer.length, amount: monto });
  }

  const cxcVencidas = cxcList.filter((r: Record<string,unknown>) => r.status === 'VENCIDO');
  if (cxcVencidas.length > 0) {
    const monto = cxcVencidas.reduce((s: number, r: Record<string,unknown>) => s + (r.amount as number), 0);
    alerts.push({ type: 'cxc', level: 'warning', message: `${cxcVencidas.length} cuenta(s) por cobrar vencida(s)`, count: cxcVencidas.length, amount: monto });
  }

  const pendientesConcar = docList.filter((d: Record<string,unknown>) => d.concarStatus === 'LISTO');
  if (pendientesConcar.length > 10) alerts.push({ type: 'concar', level: 'info', message: `${pendientesConcar.length} documentos listos para exportar a CONCAR`, count: pendientesConcar.length });

  const noConc = movList.filter((m: Record<string,unknown>) => !m.reconciled);
  if (noConc.length > 5) alerts.push({ type: 'bancos', level: 'info', message: `${noConc.length} movimientos bancarios sin conciliar`, count: noConc.length });

  return ok({
    period,
    kpis: {
      totalCompras, totalVentas, igvCredito,
      igvNeto: ventas.filter((d: Record<string,unknown>) => d.sunatStatus === 'ACEPTADO').reduce((s: number, d: Record<string,unknown>) => s + (d.igv as number), 0) - igvCredito,
      saldoBanco,
      docsTotal: docList.length, docsCompras: compras.length, docsVentas: ventas.length,
      docsAceptados: docList.filter((d: Record<string,unknown>) => d.sunatStatus === 'ACEPTADO').length,
      docsObservados: docsObservados.length,
      docsParaConcar: pendientesConcar.length,
      docsParseados: docList.filter((d: Record<string,unknown>) => d.parserStatus === 'PARSEADO').length,
      docsClasificados: docList.filter((d: Record<string,unknown>) => d.aiStatus === 'CLASIFICADO').length,
      detrPendientes: detrPendientes.length,
      detrMonto: detrPendientes.reduce((s: number, d: Record<string,unknown>) => s + (d.amount as number), 0),
      movSinConc: noConc.length,
      cxcTotal: cxcList.reduce((s: number, r: Record<string,unknown>) => s + (r.amount as number), 0),
      cxpTotal: cxpList.filter((r: Record<string,unknown>) => r.status !== 'PAGADO').reduce((s: number, r: Record<string,unknown>) => s + (r.amount as number), 0),
    },
    alerts,
  });
}
