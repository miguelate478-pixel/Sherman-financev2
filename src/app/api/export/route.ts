import { NextRequest, NextResponse } from 'next/server';
import { getDocuments, getBankMovements, getDetracciones, getCxc, getCxp, getAuditLogs } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { unauthorized } from '@/lib/response';

function escapeCSV(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCSV(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const header = columns.map(c => escapeCSV(c.label)).join(',');
  const body   = rows.map(r => columns.map(c => escapeCSV(r[c.key])).join(',')).join('\n');
  return `\uFEFF${header}\n${body}`; // BOM for Excel UTF-8
}

export async function GET(req: NextRequest) {
  // Support token as query param for direct browser downloads
  const url = new URL(req.url);
  const qToken = url.searchParams.get('token');
  let user = await getUser(req);
  if (!user && qToken) {
    // Try token from query param (for direct browser downloads)
    const fakeReq = new NextRequest(req.url, {
      headers: { Authorization: `Bearer ${qToken}` },
    });
    user = await getUser(fakeReq);
  }
  if (!user) return unauthorized();

  const type      = url.searchParams.get('type') || 'documents';
  const companyId = url.searchParams.get('companyId') || undefined;
  const period    = url.searchParams.get('period') || undefined;
  const format    = url.searchParams.get('format') || 'csv';

  let csv = '';
  let filename = `${type}_${new Date().toISOString().slice(0,10)}`;

  if (type === 'documents') {
    const filters: Record<string,string> = {};
    if (companyId) filters.companyId = companyId;
    if (period)    filters.period    = period;
    const docs = await getDocuments(filters);
    const cols = [
      { key:'id',          label:'ID Documento' },
      { key:'operation',   label:'Operación' },
      { key:'docType',     label:'Tipo Comprobante' },
      { key:'serie',       label:'Serie' },
      { key:'number',      label:'Número' },
      { key:'issueDate',   label:'Fecha Emisión' },
      { key:'dueDate',     label:'Fecha Vencimiento' },
      { key:'issuerRuc',   label:'RUC Emisor' },
      { key:'issuerName',  label:'Razón Social Emisor' },
      { key:'receiverRuc', label:'RUC Receptor' },
      { key:'receiverName',label:'Razón Social Receptor' },
      { key:'currency',    label:'Moneda' },
      { key:'base',        label:'Base Imponible' },
      { key:'igv',         label:'IGV' },
      { key:'total',       label:'Total' },
      { key:'sunatStatus', label:'Estado SUNAT' },
      { key:'cdrStatus',   label:'Estado CDR' },
      { key:'workflow',    label:'Flujo Contable' },
      { key:'concarStatus',label:'Estado CONCAR' },
      { key:'parserStatus',label:'Estado Parser XML' },
      { key:'aiStatus',    label:'Estado IA' },
      { key:'period',      label:'Período' },
    ];
    csv = toCSV(docs as Record<string,unknown>[], cols);
    filename = `comprobantes_${period||'todos'}_${new Date().toISOString().slice(0,10)}`;
  }

  else if (type === 'document_lines') {
    const filters: Record<string,string> = {};
    if (companyId) filters.companyId = companyId;
    if (period)    filters.period    = period;
    const docs = await getDocuments(filters);
    const allLines: Record<string,unknown>[] = [];
    for (const doc of docs as Record<string,unknown>[]) {
      const lines = (doc.lines as Record<string,unknown>[]) || [];
      lines.forEach(l => allLines.push({
        documentId: doc.id,
        issuerName: doc.issuerName,
        issueDate:  doc.issueDate,
        currency:   doc.currency,
        ...l,
      }));
    }
    const cols = [
      { key:'documentId',  label:'ID Documento' },
      { key:'issuerName',  label:'Proveedor' },
      { key:'issueDate',   label:'Fecha' },
      { key:'lineNumber',  label:'Línea' },
      { key:'code',        label:'Código' },
      { key:'description', label:'Descripción / Concepto' },
      { key:'quantity',    label:'Cantidad' },
      { key:'unit',        label:'U.M.' },
      { key:'unitValue',   label:'Valor Unitario' },
      { key:'igvAmount',   label:'IGV Línea' },
      { key:'lineTotal',   label:'Total Línea' },
      { key:'pcgeAccount', label:'Cuenta PCGE' },
      { key:'costCenter',  label:'Centro de Costo' },
      { key:'category',    label:'Categoría' },
      { key:'iaConfidence',label:'Confianza IA (%)' },
    ];
    csv = toCSV(allLines, cols);
    filename = `lineas_clasificadas_${period||'todos'}_${new Date().toISOString().slice(0,10)}`;
  }

  else if (type === 'banks') {
    const movs = await getBankMovements(companyId);
    const cols = [
      { key:'date',        label:'Fecha' },
      { key:'description', label:'Descripción' },
      { key:'type',        label:'Tipo' },
      { key:'amount',      label:'Monto' },
      { key:'balance',     label:'Saldo' },
      { key:'reconciled',  label:'Conciliado' },
      { key:'matchDocId',  label:'Doc. Cruzado' },
      { key:'matchName',   label:'Razón Social Cruzada' },
    ];
    csv = toCSV(movs as Record<string,unknown>[], cols);
    filename = `bancos_${new Date().toISOString().slice(0,10)}`;
  }

  else if (type === 'detracciones') {
    const detrs = await getDetracciones(companyId);
    const cols = [
      { key:'documentId',  label:'Documento' },
      { key:'provider',    label:'Proveedor' },
      { key:'provRuc',     label:'RUC' },
      { key:'amount',      label:'Monto Detracción' },
      { key:'pct',         label:'% Detracción' },
      { key:'code',        label:'Código' },
      { key:'account',     label:'Cuenta Detracción' },
      { key:'status',      label:'Estado' },
      { key:'depositDate', label:'Fecha Depósito' },
    ];
    csv = toCSV(detrs as Record<string,unknown>[], cols);
    filename = `detracciones_${new Date().toISOString().slice(0,10)}`;
  }

  else if (type === 'cxc') {
    const data = await getCxc(companyId);
    const cols = [
      { key:'clientRuc',  label:'RUC Cliente' },
      { key:'clientName', label:'Cliente' },
      { key:'amount',     label:'Monto' },
      { key:'dueDate',    label:'Vencimiento' },
      { key:'status',     label:'Estado' },
      { key:'paidDate',   label:'Fecha Cobro' },
      { key:'paidAmount', label:'Monto Cobrado' },
    ];
    csv = toCSV(data as Record<string,unknown>[], cols);
    filename = `cxc_${new Date().toISOString().slice(0,10)}`;
  }

  else if (type === 'cxp') {
    const data = await getCxp(companyId);
    const cols = [
      { key:'providerRuc',  label:'RUC Proveedor' },
      { key:'providerName', label:'Proveedor' },
      { key:'amount',       label:'Monto' },
      { key:'dueDate',      label:'Vencimiento' },
      { key:'status',       label:'Estado' },
      { key:'paidDate',     label:'Fecha Pago' },
      { key:'paidAmount',   label:'Monto Pagado' },
    ];
    csv = toCSV(data as Record<string,unknown>[], cols);
    filename = `cxp_${new Date().toISOString().slice(0,10)}`;
  }

  else if (type === 'audit') {
    const logs = await getAuditLogs();
    const cols = [
      { key:'createdAt', label:'Fecha/Hora' },
      { key:'userEmail', label:'Usuario' },
      { key:'userRole',  label:'Rol' },
      { key:'action',    label:'Acción' },
      { key:'object',    label:'Objeto' },
      { key:'ip',        label:'IP' },
    ];
    csv = toCSV(logs as Record<string,unknown>[], cols);
    filename = `auditoria_${new Date().toISOString().slice(0,10)}`;
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  });
}
