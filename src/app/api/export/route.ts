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
  ws['!cols'] = columns.map((c, i) => ({
    wch: Math.max(c.label.length, ...data.map(r => String(r[i] ?? '').length), 10)
  }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
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
    const tipoReg = type === 'COMPRA' ? 'RCE' : 'RVIE';
    const periodoTributario = period ? period.replace('-','') : '';

    const TIPO_MAP: Record<string,string> = {
      '01':'Factura','03':'Boleta de Venta','07':'Nota de Crédito',
      '08':'Nota de Débito','14':'Recibo de Servicios Públicos Electrónico'
    };

    // Hoja 1: Detalle individual por comprobante (igual al portal SUNAT)
    const headerRow = [
      'Inc.','Fecha de emisión','Fecha Vcto/Pago','Tipo CP/Doc','Serie del CDP','Año',
      'Nro CP o Doc. Nro Inicial (Rango)','Nro Final (Rango)',
      'Tipo Doc Identidad','Nro Doc Identidad','Apellidos Nombres/ Razon Social',
      'BI Gravado DG','IGV/IPM DG','BI Gravado DGNG','IGV/IPM DGNG',
      'BI Gravado DNG','IGV/IPM DNG','Valor Adq. NG','ISC','ICBPER',
      'Otros Trib/Cargos','Total CP','Moneda','Tipo de Cambio',
      'Tipo de Nota','Est. Comp.','CAR SUNAT'
    ];

    const dataRows = (docs as Record<string,unknown>[]).map(d => {
      const base   = Number(d.base  ?? 0);
      const igv    = Number(d.igv   ?? 0);
      const total  = Math.abs(Number(d.total ?? 0));
      const serie  = String(d.serie  ?? '');
      const numero = String(d.number ?? '');
      const fecha  = String(d.issueDate ?? '').split('-').reverse().join('/');
      // Fecha vencimiento: usar fecVencPag guardado, o dueDate, o vacío
      const fecVencRaw = String((d as Record<string,unknown>).fecVencPag ?? d.dueDate ?? '');
      const venc = fecVencRaw ? fecVencRaw.split('-').reverse().join('/').replace(/^\/+/,'') : '';
      const moneda = String(d.currency  ?? 'PEN');
      const codTipo = String(d.docType  ?? '01'); // Código numérico: 01, 03, 07, 08, 14
      // Tipo de Cambio
      const tc = Number((d as Record<string,unknown>).tipoCambio ?? 1);
      const annCDP = String((d as Record<string,unknown>).annCDP ?? '');

      const rucProv = type === 'COMPRA' ? String(d.issuerRuc  ?? '') : String(d.receiverRuc  ?? '');
      const rsProv  = type === 'COMPRA' ? String(d.issuerName ?? '') : String(d.receiverName ?? '');

      const biGravado = Number(d.base  ?? 0);
      const igvMonto  = Number(d.igv   ?? 0);
      const valNG     = Number((d as Record<string,unknown>).valNG ?? (biGravado === 0 && igvMonto === 0 ? total : 0));
      const isc       = Number((d as Record<string,unknown>).isc ?? 0);
      const icbper    = Number((d as Record<string,unknown>).icbper ?? 0);
      const otrosTrib = Number((d as Record<string,unknown>).otrosTrib ?? 0);

      return [
        '',          // Inc.
        fecha,       // Fecha emisión
        venc,        // Fecha Vcto/Pago
        codTipo,     // Tipo CP/Doc — código numérico (01, 14, etc.)
        serie,       // Serie del CDP
        annCDP,      // Año
        numero,      // Nro CP
        '',          // Nro Final
        '6',         // Tipo Doc Identidad
        rucProv,     // Nro Doc Identidad
        rsProv,      // Razón Social
        biGravado > 0 ? biGravado.toFixed(2) : '0.00',
        igvMonto  > 0 ? igvMonto.toFixed(2)  : '0.00',
        '0.00','0.00',
        '0.00','0.00',
        valNG > 0 ? valNG.toFixed(2) : '0.00',
        isc.toFixed(2),
        icbper.toFixed(2),
        otrosTrib.toFixed(2),
        total.toFixed(2),
        moneda,
        tc.toFixed(3),
        '',          // Tipo de Nota
        '1',         // Est. Comp.
        '',          // CAR SUNAT
      ];
    });

    // Fila Total
    const totBase  = (docs as Record<string,unknown>[]).reduce((s,d) => s + Number(d.base  ?? 0), 0);
    const totIgv   = (docs as Record<string,unknown>[]).reduce((s,d) => s + Number(d.igv   ?? 0), 0);
    const totTotal = (docs as Record<string,unknown>[]).reduce((s,d) => s + Math.abs(Number(d.total ?? 0)), 0);
    dataRows.push([
      'Total','','','','','','','','','','',
      totBase.toFixed(2), totIgv.toFixed(2),
      '0.00','0.00','0.00','0.00','0.00','0.00','0.00','0.00',
      totTotal.toFixed(2),'','','','','',
    ]);

    // Hoja 2: Resumen por tipo
    const grupos: Record<string,{label:string;count:number;base:number;igv:number;total:number}> = {};
    for (const d of docs as Record<string,unknown>[]) {
      const cod = String(d.docType ?? '01');
      const lbl = TIPO_MAP[cod] || cod;
      if (!grupos[cod]) grupos[cod] = {label:lbl,count:0,base:0,igv:0,total:0};
      grupos[cod].count++;
      grupos[cod].base  += Number(d.base  ?? 0);
      grupos[cod].igv   += Number(d.igv   ?? 0);
      grupos[cod].total += Math.abs(Number(d.total ?? 0));
    }
    const resumenHeader = ['Tipo de Documento','Total Documentos','BI Gravado DG','IGV / IPM DG','BI Gravado DGNG','IGV / IPM DGNG','BI Gravado DNG','IGV / IPM DNG','Valor Adq. NG','ISC','ICBPER','Otros Trib/ Cargos','Total CP'];
    const resumenRows = Object.entries(grupos).map(([cod,g]) => [
      `${cod}-${g.label}`, g.count,
      g.base.toFixed(2), g.igv.toFixed(2),
      '0.00','0.00','0.00','0.00','0.00','0.00','0.00','0.00',
      g.total.toFixed(2),
    ]);
    resumenRows.push(['TOTAL', Object.values(grupos).reduce((s,g)=>s+g.count,0),
      totBase.toFixed(2), totIgv.toFixed(2),
      '0.00','0.00','0.00','0.00','0.00','0.00','0.00','0.00',
      totTotal.toFixed(2),
    ]);

    // Hoja 3: Resumen general
    const infoRows = [
      ['Concepto','Valor'],
      ['Período Tributario', periodoTributario],
      ['Tipo de Registro', `${label} (${tipoReg})`],
      ['Fecha de Generación', new Date().toLocaleDateString('es-PE')],
      ['Total Comprobantes', docs.length],
      ['Base Imponible Total', `S/ ${totBase.toFixed(2)}`],
      ['Total IGV', `S/ ${totIgv.toFixed(2)}`],
      ['Importe Total', `S/ ${totTotal.toFixed(2)}`],
    ];

    const wb = XLSX.utils.book_new();

    // Hoja 1: Detalle con formato profesional
    const ws1 = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
    // Anchos de columna
    ws1['!cols'] = headerRow.map((h,i) => ({wch: Math.max(String(h).length, ...dataRows.map(r=>String(r[i]??'').length), 8)}));
    // Freeze primera fila
    ws1['!freeze'] = { xSplit: 0, ySplit: 1 };
    // Título de la empresa en A1 antes de los datos — agregar fila de título
    XLSX.utils.book_append_sheet(wb, ws1, label.substring(0,31));

    const ws2 = XLSX.utils.aoa_to_sheet([resumenHeader, ...resumenRows]);
    ws2['!cols'] = resumenHeader.map((h,i) => ({wch: Math.max(String(h).length, ...resumenRows.map(r=>String(r[i]??'').length), 10)}));
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

    const ws3 = XLSX.utils.aoa_to_sheet(infoRows);
    ws3['!cols'] = [{wch:25},{wch:40}];
    XLSX.utils.book_append_sheet(wb, ws3, 'Info');

    buffer = Buffer.from(XLSX.write(wb, { type:'buffer', bookType:'xlsx' }));
    filename = `${type==='COMPRA'?'compras':'ventas'}_${period||'todos'}_${new Date().toISOString().slice(0,10)}`;
  }

  else if (type === 'resumen_mensual') {
    // Resumen mensual: agrupa todos los documentos por período y tipo de operación
    const filters: Record<string,string> = {};
    if (companyId) filters.companyId = companyId;
    // Sin filtro de period para traer todos los meses
    const docs = await getDocuments(filters);

    // Agrupar por período + operación
    const grupos: Record<string, {
      period: string; operation: string;
      facturas: number; boletas: number; notasCredito: number; notasDebito: number; otros: number;
      totalDocs: number; base: number; igv: number; total: number;
    }> = {};

    for (const d of docs as Record<string,unknown>[]) {
      const per = String(d.period ?? '');
      const op  = String(d.operation ?? '');
      const key = `${per}|${op}`;
      if (!grupos[key]) grupos[key] = {
        period: per, operation: op,
        facturas: 0, boletas: 0, notasCredito: 0, notasDebito: 0, otros: 0,
        totalDocs: 0, base: 0, igv: 0, total: 0,
      };
      const g = grupos[key];
      const tipo = String(d.docType ?? '');
      if (tipo === '01') g.facturas++;
      else if (tipo === '03') g.boletas++;
      else if (tipo === '07') g.notasCredito++;
      else if (tipo === '08') g.notasDebito++;
      else g.otros++;
      g.totalDocs++;
      g.base  += Number(d.base  ?? 0);
      g.igv   += Number(d.igv   ?? 0);
      g.total += Math.abs(Number(d.total ?? 0));
    }

    // Ordenar por período DESC, luego COMPRA antes que VENTA
    const rows = Object.values(grupos).sort((a, b) => {
      if (b.period !== a.period) return b.period.localeCompare(a.period);
      return a.operation.localeCompare(b.operation);
    });

    // Calcular totales generales
    const totCompras = rows.filter(r => r.operation === 'COMPRA');
    const totVentas  = rows.filter(r => r.operation === 'VENTA');
    const sumBase  = (arr: typeof rows) => arr.reduce((s,r) => s + r.base,  0);
    const sumIgv   = (arr: typeof rows) => arr.reduce((s,r) => s + r.igv,   0);
    const sumTotal = (arr: typeof rows) => arr.reduce((s,r) => s + r.total, 0);

    // ── Hoja 1: Resumen por mes ──────────────────────────
    const h1 = ['Período','Operación','Facturas','Boletas','N.Crédito','N.Débito','Otros','Total Docs','Base Imponible','IGV','Total'];
    const d1 = rows.map(r => [
      r.period, r.operation,
      r.facturas, r.boletas, r.notasCredito, r.notasDebito, r.otros, r.totalDocs,
      r.base.toFixed(2), r.igv.toFixed(2), r.total.toFixed(2),
    ]);
    // Fila de totales compras
    d1.push(['TOTAL COMPRAS','',
      totCompras.reduce((s,r)=>s+r.facturas,0),
      totCompras.reduce((s,r)=>s+r.boletas,0),
      totCompras.reduce((s,r)=>s+r.notasCredito,0),
      totCompras.reduce((s,r)=>s+r.notasDebito,0),
      totCompras.reduce((s,r)=>s+r.otros,0),
      totCompras.reduce((s,r)=>s+r.totalDocs,0),
      sumBase(totCompras).toFixed(2), sumIgv(totCompras).toFixed(2), sumTotal(totCompras).toFixed(2),
    ]);
    // Fila de totales ventas
    d1.push(['TOTAL VENTAS','',
      totVentas.reduce((s,r)=>s+r.facturas,0),
      totVentas.reduce((s,r)=>s+r.boletas,0),
      totVentas.reduce((s,r)=>s+r.notasCredito,0),
      totVentas.reduce((s,r)=>s+r.notasDebito,0),
      totVentas.reduce((s,r)=>s+r.otros,0),
      totVentas.reduce((s,r)=>s+r.totalDocs,0),
      sumBase(totVentas).toFixed(2), sumIgv(totVentas).toFixed(2), sumTotal(totVentas).toFixed(2),
    ]);
    // IGV neto
    d1.push(['IGV NETO A PAGAR','','','','','','','',
      '',
      (sumIgv(totVentas) - sumIgv(totCompras)).toFixed(2),
      '',
    ]);

    // ── Hoja 2: Comparativo Compras vs Ventas ────────────
    const periodos = [...new Set(rows.map(r => r.period))].sort((a,b) => b.localeCompare(a));
    const h2 = ['Período','Base Compras','IGV Compras','Total Compras','Base Ventas','IGV Ventas','Total Ventas','IGV Neto','Diferencia Total'];
    const d2 = periodos.map(per => {
      const c = rows.find(r => r.period === per && r.operation === 'COMPRA');
      const v = rows.find(r => r.period === per && r.operation === 'VENTA');
      const bc = c?.base ?? 0, ic = c?.igv ?? 0, tc = c?.total ?? 0;
      const bv = v?.base ?? 0, iv = v?.igv ?? 0, tv = v?.total ?? 0;
      return [per,
        bc.toFixed(2), ic.toFixed(2), tc.toFixed(2),
        bv.toFixed(2), iv.toFixed(2), tv.toFixed(2),
        (iv - ic).toFixed(2),
        (tv - tc).toFixed(2),
      ];
    });

    // ── Hoja 3: Info ─────────────────────────────────────
    const d3 = [
      ['Concepto','Valor'],
      ['Fecha de generación', new Date().toLocaleDateString('es-PE')],
      ['Total períodos', periodos.length],
      ['Total documentos', docs.length],
      ['Total compras (S/)', sumTotal(totCompras).toFixed(2)],
      ['Total ventas (S/)', sumTotal(totVentas).toFixed(2)],
      ['IGV crédito fiscal (S/)', sumIgv(totCompras).toFixed(2)],
      ['IGV débito fiscal (S/)', sumIgv(totVentas).toFixed(2)],
      ['IGV neto a pagar (S/)', (sumIgv(totVentas) - sumIgv(totCompras)).toFixed(2)],
    ];

    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.aoa_to_sheet([h1, ...d1]);
    ws1['!cols'] = h1.map((h, i) => ({ wch: Math.max(String(h).length, ...d1.map(r => String(r[i] ?? '').length), 10) }));
    ws1['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen por Mes');

    const ws2 = XLSX.utils.aoa_to_sheet([h2, ...d2]);
    ws2['!cols'] = h2.map((h, i) => ({ wch: Math.max(String(h).length, ...d2.map(r => String(r[i] ?? '').length), 12) }));
    ws2['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws2, 'Comparativo');

    const ws3 = XLSX.utils.aoa_to_sheet(d3);
    ws3['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Info');

    buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    filename = `resumen_mensual_${new Date().toISOString().slice(0,10)}`;
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
