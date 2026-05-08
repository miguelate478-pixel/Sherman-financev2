import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized, getIP } from '@/lib/response';
import { createAuditLog, queryAll, execute } from '@/lib/db';

// ── Helpers ──────────────────────────────────────────────
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function dia12MesSiguiente(dateStr: string): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + 1);
  d.setDate(12);
  return d.toISOString().split('T')[0];
}

// ── POST /api/sync/financial ──────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  try {
    const { companyId, period } = await req.json();
    if (!companyId) return err('companyId es requerido');

    console.log(`[SYNC] Iniciando sync financiero — company:${companyId} period:${period || 'todos'}`);

    // ── 1. CXC — Ventas tipo 01 y 03 ─────────────────────
    const ventasQuery = period
      ? `SELECT * FROM documents WHERE "companyId"=$1 AND operation='VENTA' AND "docType" IN ('01','03') AND period=$2`
      : `SELECT * FROM documents WHERE "companyId"=$1 AND operation='VENTA' AND "docType" IN ('01','03')`;
    const ventasArgs = period ? [companyId, period] : [companyId];
    const ventas = await queryAll(ventasQuery, ventasArgs) as Record<string, unknown>[];

    let cxcCreated = 0, cxcSkipped = 0;
    for (const doc of ventas) {
      const docId = doc.id as string;
      const existing = await queryAll('SELECT id FROM cxc_records WHERE "documentId"=$1', [docId]);
      if (existing.length > 0) { cxcSkipped++; continue; }

      const dueDate = (doc.dueDate as string) || addDays(doc.issueDate as string, 30);
      await execute(
        `INSERT INTO cxc_records (id, "companyId", "documentId", "clientRuc", "clientName", amount, "dueDate", status, "createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) ON CONFLICT (id) DO NOTHING`,
        [
          `CXC-${docId}`,
          companyId,
          docId,
          (doc.receiverRuc as string) || '',
          (doc.receiverName as string) || '',
          doc.total,
          dueDate,
          'PENDIENTE',
        ]
      );
      cxcCreated++;
      console.log(`[SYNC] ✅ CXC: ${doc.receiverName} — ${doc.total} ${doc.currency}`);
    }

    // ── 2. CXP — Compras tipo 01 ──────────────────────────
    const comprasQuery = period
      ? `SELECT * FROM documents WHERE "companyId"=$1 AND operation='COMPRA' AND "docType"='01' AND period=$2`
      : `SELECT * FROM documents WHERE "companyId"=$1 AND operation='COMPRA' AND "docType"='01'`;
    const comprasArgs = period ? [companyId, period] : [companyId];
    const compras = await queryAll(comprasQuery, comprasArgs) as Record<string, unknown>[];

    let cxpCreated = 0, cxpSkipped = 0;
    for (const doc of compras) {
      const docId = doc.id as string;
      const existing = await queryAll('SELECT id FROM cxp_records WHERE "documentId"=$1', [docId]);
      if (existing.length > 0) { cxpSkipped++; continue; }

      const dueDate = (doc.dueDate as string) || addDays(doc.issueDate as string, 30);
      await execute(
        `INSERT INTO cxp_records (id, "companyId", "documentId", "providerRuc", "providerName", amount, "dueDate", status, "createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) ON CONFLICT (id) DO NOTHING`,
        [
          `CXP-${docId}`,
          companyId,
          docId,
          (doc.issuerRuc as string) || '',
          (doc.issuerName as string) || '',
          doc.total,
          dueDate,
          'PENDIENTE',
        ]
      );
      cxpCreated++;
      console.log(`[SYNC] ✅ CXP: ${doc.issuerName} — ${doc.total} ${doc.currency}`);
    }

    // ── 3. Detracciones — Compras con detracción o total >= 700 PEN ──
    // Incluye docs que tienen hasDetraction=true O total >= 700 en PEN
    const detQuery = period
      ? `SELECT * FROM documents WHERE "companyId"=$1 AND operation='COMPRA' AND "docType"='01'
         AND (("hasDetraction"=true AND "detractionAmt" > 0) OR (currency='PEN' AND total >= 700) OR (currency='USD' AND total >= 184))
         AND period=$2`
      : `SELECT * FROM documents WHERE "companyId"=$1 AND operation='COMPRA' AND "docType"='01'
         AND (("hasDetraction"=true AND "detractionAmt" > 0) OR (currency='PEN' AND total >= 700) OR (currency='USD' AND total >= 184))`;
    const detArgs = period ? [companyId, period] : [companyId];
    const detDocs = await queryAll(detQuery, detArgs) as Record<string, unknown>[];

    let detCreated = 0, detSkipped = 0;
    for (const doc of detDocs) {
      const docId = doc.id as string;
      const existing = await queryAll('SELECT id FROM detractions WHERE "documentId"=$1', [docId]);
      if (existing.length > 0) { detSkipped++; continue; }

      // Si el doc ya tiene datos de detracción, usarlos; si no, calcular 12%
      const hasDet = doc.hasDetraction && (doc.detractionAmt as number) > 0;
      const pct    = hasDet ? (doc.detractionPct as number) || 12 : 12;
      const amount = hasDet ? (doc.detractionAmt as number) : Math.round((doc.total as number) * pct / 100 * 100) / 100;
      const code   = '031'; // Servicios generales (más común)
      const venc   = dia12MesSiguiente(doc.issueDate as string);

      await execute(
        `INSERT INTO detractions (id, "companyId", "documentId", provider, "provRuc", amount, pct, code, account, status, "createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) ON CONFLICT (id) DO NOTHING`,
        [
          `DET-${docId}`,
          companyId,
          docId,
          (doc.issuerName as string) || '',
          (doc.issuerRuc as string) || '',
          amount,
          pct,
          code,
          '00-010-348912',
          'PENDIENTE',
        ]
      );
      detCreated++;
      console.log(`[SYNC] ✅ DET: ${doc.issuerName} — ${pct}% — ${amount}`);
    }

    await createAuditLog({
      userId: user.sub, userEmail: user.email, userRole: user.role,
      action: 'SYNC_FINANCIAL',
      object: `${companyId} ${period || 'all'} CXC:${cxcCreated} CXP:${cxpCreated} DET:${detCreated}`,
      ip: getIP(req),
    });

    console.log(`[SYNC] Completado — CXC:${cxcCreated}(skip:${cxcSkipped}) CXP:${cxpCreated}(skip:${cxpSkipped}) DET:${detCreated}(skip:${detSkipped})`);

    return ok({
      success: true,
      cxcCreated, cxcSkipped,
      cxpCreated, cxpSkipped,
      detCreated, detSkipped,
      totalVentas: ventas.length,
      totalCompras: compras.length,
      totalDetDocs: detDocs.length,
      message: `Sync completado: ${cxcCreated} CXC, ${cxpCreated} CXP, ${detCreated} detracciones creadas`,
    });

  } catch (e) {
    console.error('[SYNC] Error:', (e as Error).message);
    return err(`Error: ${(e as Error).message}`, 500);
  }
}
