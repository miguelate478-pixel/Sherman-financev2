import { NextRequest, NextResponse } from 'next/server';
import { getDocuments, findCompanyById } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { err, unauthorized } from '@/lib/response';

// ══════════════════════════════════════════════════════════
//  PLE — Libros Electrónicos SUNAT
//  Formato TXT según estructura SUNAT v5.2
//  Registro 8.1: Registro de Compras
//  Registro 14.1: Registro de Ventas e Ingresos
// ══════════════════════════════════════════════════════════

function pad(v: unknown, n: number, right = false): string {
  const s = String(v ?? '');
  return right ? s.slice(0, n).padEnd(n) : s.slice(0, n).padStart(n);
}

function fmtDate(d: string): string {
  // Convert YYYY-MM-DD to DD/MM/YYYY
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return '';
  return Math.abs(n).toFixed(decimals);
}

function periodToYearMonth(period: string): { year: string; month: string } {
  const [y, m] = period.split('-');
  return { year: y, month: m };
}

// Tipo de comprobante SUNAT codes
const TIPO_MAP: Record<string, string> = {
  '01': '01', '03': '03', '07': '07', '08': '08',
  '09': '09', '11': '11', '12': '12', '20': '20',
  '37': '37', '56': '56', '87': '87', '91': '91',
};

// Moneda codes
const MONEDA_MAP: Record<string, string> = {
  'PEN': 'PEN', 'USD': 'USD', 'EUR': 'EUR', 'GBP': 'GBP',
};

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  const period    = searchParams.get('period') || '2026-04';
  const tipo      = searchParams.get('tipo') || '81'; // 81=Compras, 141=Ventas

  if (!companyId) return err('companyId requerido');

  const company = await findCompanyById(companyId);
  if (!company) return err('Empresa no encontrada');

  const { year, month } = periodToYearMonth(period);
  const operation = tipo === '141' ? 'VENTA' : 'COMPRA';
  const docs = await getDocuments({ companyId, period, operation });
  const rucEmpresa = company.ruc as string;

  let lines: string[] = [];
  let filename = '';
  let totalDocs = 0;

  if (tipo === '81') {
    // ── REGISTRO DE COMPRAS (Formato 8.1) ──────────────
    filename = `LE${rucEmpresa}${year}${month}00080100001101_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.txt`;
    
    lines = (docs as Record<string, unknown>[]).map((doc, idx) => {
      const correlativo = String(idx + 1).padStart(8, '0');
      const cuo = `${year}${month}${correlativo}`;
      const fechaEm   = fmtDate(doc.issueDate as string);
      const fechaVenc = fmtDate((doc.dueDate as string) || (doc.issueDate as string));
      const tipoDoc   = TIPO_MAP[doc.docType as string] || '01';
      const moneda    = MONEDA_MAP[doc.currency as string] || 'PEN';
      const base18    = fmtNum(doc.base as number);
      const igv       = fmtNum(doc.igv as number);
      const total     = fmtNum(doc.total as number);
      const rucProv   = (doc.issuerRuc as string) || '';
      const rsProv    = ((doc.issuerName as string) || '').slice(0, 60);
      const serie     = (doc.serie as string) || '';
      const numero    = (doc.number as string) || '';
      const tipoProv  = rucProv.length === 11 ? '6' : '1'; // 6=RUC, 1=DNI
      const estadoCP  = doc.sunatStatus === 'ACEPTADO' ? '1' : '9';

      // Campos formato 8.1 (separados por |)
      return [
        cuo,                    // C1: Código único operación
        `M${correlativo}`,      // C2: Correlativo del mes
        fechaEm,                // C3: Fecha emisión comprobante
        fechaVenc,              // C4: Fecha vencimiento
        tipoDoc,                // C5: Tipo comprobante
        serie,                  // C6: Serie
        '',                     // C7: Año de emisión DUA (solo para importaciones)
        numero,                 // C8: Número comprobante
        '',                     // C9: Número final (para liquidaciones)
        tipoProv,               // C10: Tipo doc. identidad proveedor
        rucProv,                // C11: Número doc. identidad proveedor
        rsProv,                 // C12: Apellidos y nombres/razón social
        base18,                 // C13: Base imponible adq. gravadas DI → 10
        '0.00',                 // C14: Base imponible adq. gravadas DI → 20
        base18,                 // C15: Base imponible adq. gravadas que dan derecho a crédito
        '0.00',                 // C16: Base imponible adq. gravadas que no dan derecho
        '0.00',                 // C17: Adquisiciones no gravadas
        '0.00',                 // C18: ISC
        igv,                    // C19: IGV y/o IPM con derecho a crédito fiscal
        '0.00',                 // C20: IGV y/o IPM sin derecho
        '0.00',                 // C21: ICBPER
        '0.00',                 // C22: Otros tributos y cargos
        total,                  // C23: Importe total
        moneda,                 // C24: Moneda
        '1.000',                // C25: Tipo de cambio
        '',                     // C26: Fecha emisión CP modificado
        '',                     // C27: Tipo CP modificado
        '',                     // C28: Serie CP modificado
        '',                     // C29: Código dep. aduanero
        '',                     // C30: Número CP modificado
        '',                     // C31: Número DUA
        (doc.hashSha256 as string || '').slice(0, 20), // C32: Número de retención
        estadoCP,               // C33: Estado (1=activo, 9=anulado)
        '',                     // C34: Código CCI
        '',                     // C35: Detracción (monto)
        '',                     // C36: Sujeto no domiciliado
        '1',                    // C37: Indicador
      ].join('|') + '|';
    });
    totalDocs = docs.length;

  } else if (tipo === '141') {
    // ── REGISTRO DE VENTAS (Formato 14.1) ──────────────
    filename = `LE${rucEmpresa}${year}${month}00140100001101_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.txt`;

    lines = (docs as Record<string, unknown>[]).map((doc, idx) => {
      const correlativo = String(idx + 1).padStart(8, '0');
      const cuo = `${year}${month}${correlativo}`;
      const fechaEm = fmtDate(doc.issueDate as string);
      const tipoDoc = TIPO_MAP[doc.docType as string] || '01';
      const moneda  = MONEDA_MAP[doc.currency as string] || 'PEN';
      const base18  = fmtNum(doc.base as number);
      const igv     = fmtNum(doc.igv as number);
      const total   = fmtNum(doc.total as number);
      // receiverRuc/receiverName ya vienen normalizados desde bulk-download
      // (numDocCliente → receiverRuc, razonSocialCliente → receiverName)
      const rucCli  = (doc.receiverRuc as string) || '';
      const rsCli   = ((doc.receiverName as string) || '').slice(0, 60);
      const serie   = (doc.serie as string) || '';
      const numero  = (doc.number as string) || '';
      // tipoCli: 6=RUC(11 dígitos), 1=DNI(8 dígitos), 4=Carnet extranjería, 0=sin doc
      const tipoCli = rucCli.length === 11 ? '6' : rucCli.length === 8 ? '1' : '0';
      const estadoCP = doc.sunatStatus === 'ACEPTADO' ? '1' : '9';

      return [
        cuo,            // C1: CUO
        `M${correlativo}`, // C2: Correlativo
        fechaEm,        // C3: Fecha emisión
        '',             // C4: Fecha vencimiento
        tipoDoc,        // C5: Tipo comprobante
        serie,          // C6: Serie
        numero,         // C7: Número
        tipoCli,        // C8: Tipo doc identidad cliente
        rucCli,         // C9: Número doc identidad cliente
        rsCli,          // C10: Apellidos/razón social cliente
        '0.00',         // C11: Exportación
        base18,         // C12: Base imponible operaciones gravadas
        '0.00',         // C13: Descuento base imponible
        igv,            // C14: IGV y/o IPM
        '0.00',         // C15: Descuento IGV
        '0.00',         // C16: Operaciones exoneradas
        '0.00',         // C17: Operaciones inafectas
        '0.00',         // C18: ISC
        '0.00',         // C19: ICBPER
        '0.00',         // C20: Otros tributos
        total,          // C21: Importe total
        moneda,         // C22: Moneda
        '1.000',        // C23: Tipo cambio
        '',             // C24: Fecha emisión CP modificado
        '',             // C25: Tipo CP modificado
        '',             // C26: Número serie CP modificado
        '',             // C27: Número CP modificado
        estadoCP,       // C28: Estado
        '',             // C29: Indicador del estado
      ].join('|') + '|';
    });
    totalDocs = docs.length;
  }

  // Build PLE file content
  const content = lines.join('\r\n');

  // Totals summary (last line)
  const totalLine = `TOTALES|||${fmtNum(
    (docs as Record<string,unknown>[]).reduce((s, d) => s + Math.abs(d.base as number), 0)
  )}|||${fmtNum(
    (docs as Record<string,unknown>[]).reduce((s, d) => s + Math.abs(d.igv as number), 0)
  )}|||${fmtNum(
    (docs as Record<string,unknown>[]).reduce((s, d) => s + Math.abs(d.total as number), 0)
  )}|`;

  const fullContent = content + (lines.length ? '\r\n' : '') + totalLine;

  return new NextResponse(fullContent, {
    status: 200,
    headers: {
      'Content-Type':        'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-PLE-Tipo':          tipo,
      'X-PLE-Period':        period,
      'X-PLE-Empresa':       rucEmpresa,
      'X-PLE-Total-Docs':    String(totalDocs),
    },
  });
}
