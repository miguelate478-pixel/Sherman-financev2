import { NextRequest } from 'next/server';
import { getDocuments, updateDocument, createAuditLog, getDb } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized, getIP } from '@/lib/response';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { resolveCompanyFilter } = await import('@/lib/auth');
  const p = new URL(req.url).searchParams;
  const requestedCompanyId = p.get('companyId');
  const { companyIds, allowed } = resolveCompanyFilter(user, requestedCompanyId);
  if (!allowed && companyIds !== null && companyIds.length === 0) return ok([]);
  const filters: Record<string,string> = {};
  ['type','period','workflow','concarStatus','sunatStatus'].forEach(k => { const v=p.get(k==='type'?'type':k); if(v) filters[k==='type'?'operation':k]=v; });
  // Apply company filter
  if (companyIds !== null && companyIds.length === 1) {
    filters.companyId = companyIds[0];
  }
  const docs = await getDocuments(filters);
  return ok(docs.map((d: Record<string,unknown>) => ({
    id:d.id, op:d.operation, tipo:d.docType, serie:d.serie, num:d.number,
    ruc_e:d.issuerRuc, rs_e:d.issuerName, ruc_r:d.receiverRuc, rs_r:d.receiverName,
    fecha:d.issueDate, venc:d.dueDate, moneda:d.currency,
    base:d.base, igv:d.igv, total:d.total,
    detraccion:!!d.hasDetraction, pct_d:d.detractionPct, monto_d:d.detractionAmt,
    sunat:d.sunatStatus, cdr:d.cdrStatus, hash:d.hashSha256,
    xml:!!d.hasXml, pdf:!!d.hasPdf, cdr_f:!!d.hasCdr,
    workflow:d.workflow, concar:d.concarStatus, period:d.period,
    parserStatus:d.parserStatus, aiStatus:d.aiStatus,
    lineas: ((d.lines as Record<string,unknown>[])||[]).map(l => ({
      n:l.lineNumber, cod:l.code, desc:l.description, qty:l.quantity, um:l.unit,
      val:l.unitValue, igv_l:l.igvAmount, total_l:l.lineTotal, afect:l.affectType,
      cuenta:l.pcgeAccount, cc:l.costCenter, cat:l.category,
      ia:l.iaConfidence, rev:!!l.needsReview, rec:!!l.isRecurrent, aprobado:!!l.approved,
    })),
  })));
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const { id, workflow, concarStatus, parserStatus, aiStatus, sunatStatus } = await req.json();
    const data: Record<string,unknown> = {};
    if (workflow)     data.workflow     = workflow;
    if (concarStatus) data.concarStatus = concarStatus;
    if (parserStatus) data.parserStatus = parserStatus;
    if (aiStatus)     data.aiStatus     = aiStatus;
    if (sunatStatus)  data.sunatStatus  = sunatStatus;
    await updateDocument(id, data);
    await createAuditLog({ userId:user.sub, userEmail:user.email, userRole:user.role, action:'DOC_UPDATED', object:id, ip:getIP(req) });
    return ok({ updated:true });
  } catch { return err('Error', 500); }
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const { ids } = await req.json() as { ids: string[] };
    if (!ids?.length) return err('ids requeridos');
    const db = getDb();
    for (const id of ids) {
      await db.query('DELETE FROM documents WHERE id=$1', [id]);
    }
    return ok({ deleted: ids.length });
  } catch(e) { return err((e as Error).message, 500); }
}
