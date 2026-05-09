import { NextRequest, NextResponse } from 'next/server';
import { findCompanyById, getDocuments, queryAll } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { sendEmail, emailTemplate } from '@/lib/email';

// ── Helpers formato peruano ───────────────────────────────
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function fmtSoles(n: number): string {
  return 'S/ ' + new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
}

function fmtFecha(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${y}`;
}

function periodoLabel(period: string): string {
  const [y, m] = period.split('-');
  return `${MESES_ES[parseInt(m) - 1]} ${y}`;
}

// ── Generar PDF con PDFKit ────────────────────────────────
async function generarPDF(
  company: Record<string, unknown>,
  period: string,
  compras: Record<string, unknown>[],
  ventas: Record<string, unknown>[],
  detracciones: Record<string, unknown>[]
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFDocument = require('pdfkit') as new (opts?: Record<string, unknown>) => PDFKit.PDFDocument;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 495; // ancho útil (595 - 2*50)
    const NAVY  = '#0F172A';
    const BLUE  = '#2563EB';
    const GRAY  = '#6B7280';
    const LGRAY = '#F1F5F9';
    const RED   = '#DC2626';
    const GREEN = '#16A34A';

    // ── HEADER ──────────────────────────────────────────
    doc.rect(50, 40, W, 70).fill(NAVY);
    doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold')
       .text('Sherman Finance Control AI', 65, 55);
    doc.fontSize(10).font('Helvetica')
       .text('Sistema de Control Contable · SUNAT/SIRE', 65, 78);
    doc.fontSize(11).font('Helvetica-Bold')
       .text(`Reporte del Cliente`, W - 30, 55, { align: 'right', width: 150 });
    doc.fontSize(10).font('Helvetica').fillColor('#94A3B8')
       .text(`Período: ${periodoLabel(period)}`, W - 30, 72, { align: 'right', width: 150 });

    // ── DATOS EMPRESA ────────────────────────────────────
    doc.fillColor(NAVY).fontSize(14).font('Helvetica-Bold')
       .text(String(company.nombre || company.ruc), 50, 130);
    doc.fillColor(GRAY).fontSize(10).font('Helvetica')
       .text(`RUC: ${company.ruc}  ·  Período: ${periodoLabel(period)}  ·  Generado: ${fmtFecha(new Date().toISOString())}`, 50, 148);

    doc.moveTo(50, 165).lineTo(545, 165).strokeColor('#E2E8F0').lineWidth(1).stroke();

    // ── RESUMEN EJECUTIVO ────────────────────────────────
    let y = 178;
    doc.fillColor(NAVY).fontSize(12).font('Helvetica-Bold').text('RESUMEN EJECUTIVO', 50, y);
    y += 18;

    const totalCompras  = compras.reduce((s, d) => s + Math.abs(Number(d.total)), 0);
    const totalVentas   = ventas.reduce((s, d) => s + Math.abs(Number(d.total)), 0);
    const igvCredito    = compras.filter(d => d.sunatStatus === 'ACEPTADO').reduce((s, d) => s + Math.abs(Number(d.igv)), 0);
    const igvDebito     = ventas.filter(d => d.sunatStatus === 'ACEPTADO').reduce((s, d) => s + Math.abs(Number(d.igv)), 0);
    const igvNeto       = igvDebito - igvCredito;
    const detrPend      = detracciones.filter(d => d.status === 'PENDIENTE');
    const totalDetr     = detrPend.reduce((s, d) => s + Number(d.amount), 0);

    const kpis = [
      { label: 'Total Compras del Mes',      value: fmtSoles(totalCompras),  color: NAVY },
      { label: 'Total Ventas del Mes',        value: fmtSoles(totalVentas),   color: NAVY },
      { label: 'IGV Crédito Fiscal',          value: fmtSoles(igvCredito),    color: GREEN },
      { label: 'IGV Débito Fiscal',           value: fmtSoles(igvDebito),     color: RED },
      { label: 'IGV Neto a Pagar',            value: fmtSoles(igvNeto),       color: igvNeto > 0 ? RED : GREEN },
      { label: 'Detracciones Pendientes',     value: fmtSoles(totalDetr),     color: totalDetr > 0 ? '#D97706' : GREEN },
    ];

    // Grid 3x2
    const colW = W / 3;
    kpis.forEach((k, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 50 + col * colW;
      const ky = y + row * 58;
      doc.rect(x + 2, ky, colW - 6, 50).fill(LGRAY);
      doc.fillColor(GRAY).fontSize(8).font('Helvetica').text(k.label.toUpperCase(), x + 8, ky + 8, { width: colW - 16 });
      doc.fillColor(k.color).fontSize(13).font('Helvetica-Bold').text(k.value, x + 8, ky + 22, { width: colW - 16 });
    });

    y += 130;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E2E8F0').lineWidth(1).stroke();
    y += 14;

    // ── TABLA COMPRAS ────────────────────────────────────
    const drawTable = (
      titulo: string,
      headers: string[],
      widths: number[],
      rows: string[][],
      startY: number
    ): number => {
      // Verificar espacio — nueva página si hace falta
      if (startY > 680) { doc.addPage(); startY = 50; }

      doc.fillColor(NAVY).fontSize(11).font('Helvetica-Bold').text(titulo, 50, startY);
      startY += 14;

      // Header row
      doc.rect(50, startY, W, 18).fill(NAVY);
      let cx = 50;
      headers.forEach((h, i) => {
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
           .text(h, cx + 4, startY + 5, { width: widths[i] - 6, align: i >= 3 ? 'right' : 'left' });
        cx += widths[i];
      });
      startY += 18;

      // Data rows
      rows.forEach((row, ri) => {
        if (startY > 750) { doc.addPage(); startY = 50; }
        const bg = ri % 2 === 0 ? '#FFFFFF' : LGRAY;
        doc.rect(50, startY, W, 16).fill(bg);
        cx = 50;
        row.forEach((cell, ci) => {
          doc.fillColor(NAVY).fontSize(8).font('Helvetica')
             .text(cell, cx + 4, startY + 4, { width: widths[ci] - 6, align: ci >= 3 ? 'right' : 'left', ellipsis: true });
          cx += widths[ci];
        });
        startY += 16;
      });

      // Totals row
      if (rows.length > 0) {
        doc.rect(50, startY, W, 18).fill('#E2E8F0');
        doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold')
           .text(`${rows.length} comprobante${rows.length !== 1 ? 's' : ''}`, 54, startY + 5);
        startY += 18;
      }

      return startY + 12;
    };

    // Compras
    const comprasRows = compras.slice(0, 50).map(d => [
      String(d.issuerName || '').substring(0, 28),
      fmtFecha(String(d.issueDate || '')),
      `${d.serie}-${d.number}`,
      fmtSoles(Math.abs(Number(d.base))),
      fmtSoles(Math.abs(Number(d.igv))),
      fmtSoles(Math.abs(Number(d.total))),
    ]);

    y = drawTable(
      `COMPRAS — ${periodoLabel(period)} (${compras.length} comprobantes)`,
      ['Proveedor', 'Fecha', 'Serie-Número', 'Base Imp.', 'IGV 18%', 'Total'],
      [140, 60, 80, 75, 70, 70],
      comprasRows,
      y
    );

    if (y > 680) { doc.addPage(); y = 50; }

    // Ventas
    const ventasRows = ventas.slice(0, 50).map(d => [
      String(d.receiverName || d.issuerName || '').substring(0, 28),
      fmtFecha(String(d.issueDate || '')),
      `${d.serie}-${d.number}`,
      fmtSoles(Math.abs(Number(d.base))),
      fmtSoles(Math.abs(Number(d.igv))),
      fmtSoles(Math.abs(Number(d.total))),
    ]);

    y = drawTable(
      `VENTAS — ${periodoLabel(period)} (${ventas.length} comprobantes)`,
      ['Cliente', 'Fecha', 'Serie-Número', 'Base Imp.', 'IGV 18%', 'Total'],
      [140, 60, 80, 75, 70, 70],
      ventasRows,
      y
    );

    // Detracciones si hay
    if (detrPend.length > 0) {
      if (y > 650) { doc.addPage(); y = 50; }
      const detrRows = detrPend.slice(0, 20).map(d => [
        String(d.provider || '').substring(0, 30),
        String(d.code || '031'),
        `${d.pct}%`,
        fmtSoles(Number(d.amount)),
        String(d.status || 'PENDIENTE'),
      ]);
      y = drawTable(
        `DETRACCIONES PENDIENTES (${detrPend.length})`,
        ['Proveedor', 'Código', 'Tasa', 'Monto', 'Estado'],
        [180, 70, 60, 100, 85],
        detrRows,
        y
      );
    }

    // ── PIE DE PÁGINA ────────────────────────────────────
    const pageCount = (doc as unknown as { _pageBuffer: unknown[] })._pageBuffer?.length || 1;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.rect(50, 800, W, 28).fill('#F8FAFC');
      doc.fillColor(GRAY).fontSize(8).font('Helvetica')
         .text(
           `Preparado por Sherman Finance Control AI  ·  Información extraída del SIRE - SUNAT  ·  Generado: ${fmtFecha(new Date().toISOString())}`,
           54, 808, { width: W - 8, align: 'center' }
         );
    }

    doc.end();
  });
}

// ── GET /api/reports/cliente-pdf ──────────────────────────
export async function GET(req: NextRequest) {
  // Acepta JWT por query param (para descarga directa desde browser)
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  const period    = searchParams.get('period') || new Date().toISOString().slice(0, 7);
  const sendTo    = searchParams.get('sendEmail'); // email destino opcional

  const user = await getUser(req);
  if (!user) return new NextResponse('No autorizado', { status: 401 });
  if (!companyId) return new NextResponse('companyId requerido', { status: 400 });

  const company = await findCompanyById(companyId);
  if (!company) return new NextResponse('Empresa no encontrada', { status: 404 });

  const docs = await getDocuments({ companyId, period }) as Record<string, unknown>[];
  const compras = docs.filter(d => d.operation === 'COMPRA');
  const ventas  = docs.filter(d => d.operation === 'VENTA');
  const detracciones = await queryAll(
    `SELECT * FROM detractions WHERE "companyId"=$1`, [companyId]
  ) as Record<string, unknown>[];

  const pdfBuffer = await generarPDF(company, period, compras, ventas, detracciones);

  const [y, m] = period.split('-');
  const filename = `Reporte_${String(company.ruc)}_${MESES_ES[parseInt(m)-1]}${y}.pdf`;

  // Si se pide enviar por email
  if (sendTo) {
    const totalCompras = compras.reduce((s, d) => s + Math.abs(Number(d.total)), 0);
    const totalVentas  = ventas.reduce((s, d) => s + Math.abs(Number(d.total)), 0);

    // Resend no soporta attachments en plan gratis — enviamos link de descarga
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const html = emailTemplate(
      `Reporte Contable — ${periodoLabel(period)}`,
      `<p style="font-size:14px;color:#374151;">Adjunto el reporte contable de <strong>${company.nombre}</strong> correspondiente al período <strong>${periodoLabel(period)}</strong>.</p>
       <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
         <tr><td style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#374151;">Total Compras</td><td style="text-align:right;font-weight:700;font-size:13px;">S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:2}).format(totalCompras)}</td></tr>
         <tr><td style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#374151;">Total Ventas</td><td style="text-align:right;font-weight:700;font-size:13px;">S/ ${new Intl.NumberFormat('es-PE',{minimumFractionDigits:2}).format(totalVentas)}</td></tr>
         <tr><td style="padding:8px 0;font-size:13px;color:#374151;">Comprobantes</td><td style="text-align:right;font-weight:700;font-size:13px;">${docs.length} documentos</td></tr>
       </table>
       <p style="font-size:12px;color:#6B7280;">Para descargar el PDF completo, ingresa a Sherman Finance → Reportes → Generar Reporte para Cliente.</p>`,
      `Información extraída del SIRE - SUNAT · Sherman Finance Control AI`
    );

    await sendEmail({
      to: sendTo,
      subject: `📊 Reporte Contable ${periodoLabel(period)} — ${company.nombre}`,
      html,
    });

    return new NextResponse(JSON.stringify({ ok: true, sent: true, to: sendTo }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Descarga directa del PDF
  return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(pdfBuffer.length),
    },
  });
}
