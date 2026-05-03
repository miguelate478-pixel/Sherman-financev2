import { NextRequest } from 'next/server';
import { getDb, rows } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, unauthorized } from '@/lib/response';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  const period    = searchParams.get('period') || new Date().toISOString().slice(0, 7);

  const db = getDb();
  const args = companyId ? [companyId, period] : ['%', period];
  const cond = companyId ? 'companyId=? AND period=?' : "period=?";
  const cargs = companyId ? [companyId] : [];

  const [docs, detrs, movs, cxc, cxp] = await Promise.all([
    db.execute({ sql: `SELECT * FROM documents WHERE ${cond}`, args: companyId ? [companyId, period] : [period] }),
    db.execute({ sql: companyId ? 'SELECT * FROM detractions WHERE companyId=?' : 'SELECT * FROM detractions', args: cargs }),
    db.execute({ sql: companyId ? 'SELECT * FROM bank_movements WHERE companyId=?' : 'SELECT * FROM bank_movements', args: cargs }),
    db.execute({ sql: companyId ? 'SELECT * FROM cxc_records WHERE companyId=?' : 'SELECT * FROM cxc_records', args: cargs }),
    db.execute({ sql: companyId ? 'SELECT * FROM cxp_records WHERE companyId=?' : 'SELECT * FROM cxp_records', args: cargs }),
  ]);

  const docList  = rows(docs);
  const detrList = rows(detrs);
  const movList  = rows(movs);
  const cxcList  = rows(cxc);
  const cxpList  = rows(cxp);

  const compras = docList.filter(d => d.operation === 'COMPRA');
  const ventas  = docList.filter(d => d.operation === 'VENTA');

  const totalCompras = compras.reduce((s, d) => s + Math.abs(d.total as number), 0);
  const totalVentas  = ventas.reduce((s, d) => s + (d.total as number), 0);
  const igvCredito   = compras.filter(d => d.sunatStatus === 'ACEPTADO' && d.currency === 'PEN').reduce((s, d) => s + Math.abs(d.igv as number), 0);
  const saldoBanco   = movList.length ? (movList[movList.length - 1].balance as number) : 0;

  // ALERTS
  const alerts: { type: string; level: 'warning' | 'error' | 'info'; message: string; count?: number; amount?: number }[] = [];

  const detrPendientes = detrList.filter(d => d.status === 'PENDIENTE');
  if (detrPendientes.length > 0) {
    const monto = detrPendientes.reduce((s, d) => s + (d.amount as number), 0);
    alerts.push({ type: 'detracciones', level: 'error', message: `${detrPendientes.length} detracción(es) pendiente(s) de depósito`, count: detrPendientes.length, amount: monto });
  }

  const docsObservados = docList.filter(d => d.sunatStatus === 'OBSERVADO');
  if (docsObservados.length > 0) alerts.push({ type: 'sunat', level: 'warning', message: `${docsObservados.length} comprobante(s) observados en SUNAT`, count: docsObservados.length });

  const cxpVencidas = cxpList.filter(r => r.status === 'VENCIDO');
  if (cxpVencidas.length > 0) {
    const monto = cxpVencidas.reduce((s, r) => s + (r.amount as number), 0);
    alerts.push({ type: 'cxp', level: 'error', message: `${cxpVencidas.length} cuenta(s) por pagar vencida(s)`, count: cxpVencidas.length, amount: monto });
  }

  const cxpPorVencer = cxpList.filter(r => r.status === 'POR_VENCER');
  if (cxpPorVencer.length > 0) {
    const monto = cxpPorVencer.reduce((s, r) => s + (r.amount as number), 0);
    alerts.push({ type: 'cxp_warn', level: 'warning', message: `${cxpPorVencer.length} cuenta(s) por pagar próximas a vencer`, count: cxpPorVencer.length, amount: monto });
  }

  const cxcVencidas = cxcList.filter(r => r.status === 'VENCIDO');
  if (cxcVencidas.length > 0) {
    const monto = cxcVencidas.reduce((s, r) => s + (r.amount as number), 0);
    alerts.push({ type: 'cxc', level: 'warning', message: `${cxcVencidas.length} cuenta(s) por cobrar vencida(s)`, count: cxcVencidas.length, amount: monto });
  }

  const pendientesConcar = docList.filter(d => d.concarStatus === 'LISTO');
  if (pendientesConcar.length > 10) alerts.push({ type: 'concar', level: 'info', message: `${pendientesConcar.length} documentos listos para exportar a CONCAR`, count: pendientesConcar.length });

  const noConc = movList.filter(m => !m.reconciled);
  if (noConc.length > 5) alerts.push({ type: 'bancos', level: 'info', message: `${noConc.length} movimientos bancarios sin conciliar`, count: noConc.length });

  return ok({
    period,
    kpis: {
      totalCompras, totalVentas, igvCredito,
      igvNeto: ventas.filter(d => d.sunatStatus === 'ACEPTADO').reduce((s, d) => s + (d.igv as number), 0) - igvCredito,
      saldoBanco,
      docsTotal: docList.length, docsCompras: compras.length, docsVentas: ventas.length,
      docsAceptados: docList.filter(d => d.sunatStatus === 'ACEPTADO').length,
      docsObservados: docsObservados.length,
      docsParaConcar: pendientesConcar.length,
      docsParseados: docList.filter(d => d.parserStatus === 'PARSEADO').length,
      docsClasificados: docList.filter(d => d.aiStatus === 'CLASIFICADO').length,
      detrPendientes: detrPendientes.length,
      detrMonto: detrPendientes.reduce((s, d) => s + (d.amount as number), 0),
      movSinConc: noConc.length,
      cxcTotal: cxcList.reduce((s, r) => s + (r.amount as number), 0),
      cxpTotal: cxpList.filter(r => r.status !== 'PAGADO').reduce((s, r) => s + (r.amount as number), 0),
    },
    alerts,
  });
}
