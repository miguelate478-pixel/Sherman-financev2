import { NextRequest, NextResponse } from 'next/server';
import { getDocuments, getBankMovements, getDetracciones, getCxc, getCxp, getAuditLogs } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { unauthorized } from '@/lib/response';
import * as XLSX from 'xlsx';

function toExcel(rows: Record<string, unknown>[], columns: { key: string; label: string }[], sheetName = 'Datos'): Buffer {
  const header = columns.map(c => c.label);
  const data = rows.map(r => columns.map(c => {
    const v = r[c.key];
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    return v;
  }));
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  // Auto-width columns
  ws['!cols'] = columns.map((c, i) => ({
    wch: Math.max(c.label.length, ...data.map(r => String(r[i] ?? '').length), 10)
  }));
  // Bold header row
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: col })];
    if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'D9E1F2' } } };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const qToken = url.searchParams.get('token');
  let user = await getUser(req);
  if (!user && qToken) {
    const fakeReq = new NextRequest(req.url, { headers: { Authorization: `Bearer ${qToken}` } });
    user = await getUser(fakeReq);
  }
  if (!user) return unauthorized();

  const type      = url.searchParams.get('type') || 'documents';
  const companyId = url.searchParams.get('companyId') || undefined;
  const period    = url.searchParams.get('period') || undefined;

  let buffer: Buffer = Buffer.alloc(0);
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
    buffer = toExcel(docs as Record<string,unknown>[], cols, `Comprobantes ${period||'todos'}`);
    filename = `comprobantes_${period||'todos'}_${new Date().toISOString().slice(0,10)}`;
  }

  else if (type === 'COMPRA' || type === 'VENTA') {
    const filters: Record<string,string> = { operation: type };
    if (companyId) filters.companyId = companyId;
    if (period)    filters.period    = period;
    const docs = await getDocuments(filters);
    const label = type === 'COMPRA' ? 'Registro de Compras' : 'Registro de Ventas';
    const periodoTributario = period ? period.replace('-','') : '';

    // Hoja 1: Comprobantes en formato PLE SUNAT
    const headerRow = type === 'COMPRA'
      ? ['Inc.','Fecha de emisión','Fecha Vcto/Pago','Tipo CP/Doc','Serie del CDP','Año','Nro CP o Doc.','Nro Final (Rango)','Tipo Doc Identidad','Nro Doc Identidad','Apellidos Nombres/ Razon Social','BI Gravado DG','IGV/IPM DG','BI Gravado DGNG','IGV/IPM DGNG','BI Gravado DNG','IGV/IPM DNG','Valor Adq. NG','ISC','ICBPER','Otros Trib/Cargos','Total CP','Moneda','Tipo de Cambio','Tipo de Nota','Est. Comp.','CAR SUNAT']
      : ['Inc.','Fecha de emisión','Fecha Vcto/Pago','Tipo CP/Doc','Serie del CDP','Año','Nro CP o Doc.','Nro Final (Rango)','Tipo Doc Identidad','Nro Doc Identidad','Apellidos Nombres/ Razon Social','BI Gravado DG','IGV/IPM DG','BI Gravado DGNG','IGV/IPM DGNG','BI Gravado DNG','IGV/IPM DNG','Valor Adq. NG','ISC','ICBPER','Otros Trib/Cargos','Total CP','Moneda','Tipo de Cambio','Tipo de Nota','Est. Comp.'];

    const TIPO_MAP: Record<string,string> = {'01':'Factura','03':'Boleta','07':'Nota de Crédito','08':'Nota de Débito','14':'Recibo Servicios Públicos'};

    const dataRows = (docs as Record<string,unknown>[]).map(d => {
      const base   = Number(d.base ?? 0);
      const igv    = Number(d.igv ?? 0);
      const total  = Number(d.total ?? 0);
      const serie  = String(d.serie ?? '');
      const numero = String(d.number ?? '');
      const fecha  = String(d.issueDate ?? '').split('-').reverse().join('/'); // YYYY-MM-DD → DD/MM/YYYY
      const rucEmisor = type === 'COMPRA' ? String(d.issuerRuc ?? '') : String(d.receiverRuc ?? '');
      const rsEmisor  = type === 'COMPRA' ? String(d.issuerName ?? '') : String(d.receiverName ?? '');
      const tipoDoc   = TIPO_MAP[String(d.docType ?? '01')] || String(d.docType ?? '');
      const row: unknown[] = [
        '',           // Inc.
        fecha,        // Fecha emisión
        fecha,        // Fecha Vcto
        tipoDoc,      // Tipo CP
        serie,        // Serie
        '',           // Año
        numero,       // Nro CP
        '',           // Nro Final
        '6',          // Tipo Doc Identidad (RUC=6)
        rucEmisor,    // Nro Doc Identidad
        rsEmisor,     // Razón Social
        base > 0 ? base.toFixed(2) : '0.00',   // BI Gravado DG
        igv > 0  ? igv.toFixed(2)  : '0.00',   // IGV DG
        '0.00','0.00','0.00','0.00',            // DGNG, DNG
        base === 0 ? Math.abs(total).toFixed(2) : '0.00', // Valor Adq NG
        '0.00','0.00','0.00',                   // ISC, ICBPER, Otros
        Math.abs(total).toFixed(2),             // Total CP
        String(d.currency ?? 'PEN'),            // Moneda
        '1.000',                                // Tipo Cambio
        '',                                     // Tipo Nota
        '1',                                    // Est. Comp.
      ];
      if (type === 'COMPRA') row.push(''); // CAR SUNAT
      return row;
    });

    // Calcular totales
    const totalDocs = docs.length;
    const totalBase = (docs as Record<string,unknown>[]).reduce((s,d) => s + Number(d.base ?? 0), 0);
    const totalIgv  = (docs as Record<string,unknown>[]).reduce((s,d) => s + Number(d.igv ?? 0), 0);
    const totalMonto= (docs as Record<string,unknown>[]).reduce((s,d) => s + Math.abs(Number(d.total ?? 0)), 0);

    // Hoja 2: Resumen
    const resumenRows = [
      ['Concepto', 'Valor'],
      ['Período Tributario', periodoTributario],
      ['Tipo de Registro', label + ' (' + (type === 'COMPRA' ? 'RCE' : 'RVIE') + ')'],
      ['Fecha de Generación', new Date().toLocaleDateString('es-PE')],
      ['Total Comprobantes', totalDocs],
      ['Base Imponible Total', `S/ ${totalBase.toFixed(2)}`],
      ['Total IGV', `S/ ${totalIgv.toFixed(2)}`],
      ['Importe Total', `S/ ${totalMonto.toFixed(2)}`],
    ];

    const wb = XLSX.utils.book_new();

    // Hoja comprobantes
    const ws1 = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
    ws1['!cols'] = headerRow.map((h, i) => ({
      wch: Math.max(String(h).length, ...dataRows.map(r => String(r[i] ?? '').length), 8)
    }));
    XLSX.utils.book_append_sheet(wb, ws1, label.substring(0, 31));

    // Hoja resumen
    const ws2 = XLSX.utils.aoa_to_sheet(resumenRows);
    ws2['!cols'] = [{ wch: 25 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

    buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    filename = `${type === 'COMPRA' ? 'compras' : 'ventas'}_${period||'todos'}_${new Date().toISOString().slice(0,10)}`;
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
        documentId: doc.id, issuerName: doc.issuerName,
        issueDate: doc.issueDate, currency: doc.currency, ...l,
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
    buffer = toExcel(allLines, cols, 'Líneas Clasificadas');
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
    buffer = toExcel(movs as Record<string,unknown>[], cols, 'Movimientos Bancarios');
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
    buffer = toExcel(detrs as Record<string,unknown>[], cols, 'Detracciones');
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
    buffer = toExcel(data as Record<string,unknown>[], cols, 'Cuentas por Cobrar');
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
    buffer = toExcel(data as Record<string,unknown>[], cols, 'Cuentas por Pagar');
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
    buffer = toExcel(logs as Record<string,unknown>[], cols, 'Auditoría');
    filename = `auditoria_${new Date().toISOString().slice(0,10)}`;
  }

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
    },
  });
}
