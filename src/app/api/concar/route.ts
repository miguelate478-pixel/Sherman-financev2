import { NextRequest } from 'next/server';
import { createConcarBatch, getConcarBatches, approveConcarBatch, updateDocument, getDocuments, createAuditLog } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized, getIP } from '@/lib/response';
import { getConcarProvider } from '@/lib/providers/concar';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const action = new URL(req.url).searchParams.get('action') || 'test';
  const provider = getConcarProvider();

  if (action === 'test') {
    const result = await provider.testConnection();
    await createAuditLog({ userId:user.sub, userEmail:user.email, userRole:user.role, action:'CONCAR_TEST', object:result.database, ip:getIP(req) });
    return ok(result);
  }

  if (action === 'accounts') {
    return ok(await provider.getAccounts());
  }

  if (action === 'export') {
    const { documentIds, companyId, period } = await req.json();
    if (!documentIds?.length) return err('Sin documentos seleccionados');

    // Get full document data
    const docs = await getDocuments({ companyId, period });
    const selectedDocs = docs.filter((d: Record<string,unknown>) => documentIds.includes(d.id));

    // Generate SQL via provider
    const exportResult = await provider.exportBatch(selectedDocs, period || '2026-04');

    // Save batch to DB
    const hash = randomBytes(4).toString('hex');
    const batchId = await createConcarBatch({ companyId: companyId || 'unknown', period: period || '2026-04', exportedBy: user.email, hashLote: hash }, documentIds);
    for (const id of documentIds) await updateDocument(id, { concarStatus: 'PREPARADO' });

    await createAuditLog({ userId:user.sub, userEmail:user.email, userRole:user.role, action:'CONCAR_LOTE_PREPARADO', object:`${batchId} ${documentIds.length} docs`, ip:getIP(req) });
    return ok({ batchId, hash, docsCount: documentIds.length, status: 'PREPARADO', sql: exportResult.sql });
  }

  if (action === 'approve') {
    if (user.role !== 'Supervisor' && user.role !== 'Administrador') return err('Solo Supervisores pueden aprobar lotes CONCAR', 403);
    const { batchId } = await req.json();
    await approveConcarBatch(batchId, user.email);
    await createAuditLog({ userId:user.sub, userEmail:user.email, userRole:user.role, action:'CONCAR_LOTE_APROBADO', object:batchId, ip:getIP(req) });
    return ok({ approved: true });
  }

  if (action === 'sql-preview') {
    const { documentIds, companyId, period } = await req.json();
    const docs = await getDocuments({ companyId, period });
    const selected = docs.filter((d: Record<string,unknown>) => documentIds.includes(d.id));
    const result = await provider.exportBatch(selected, period || '2026-04');
    return ok({ sql: result.sql });
  }

  return err('Acción no reconocida');
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const action = new URL(req.url).searchParams.get('action');
  if (action === 'accounts') return ok(await getConcarProvider().getAccounts());
  if (action === 'schema') return ok([
    {s:'dbo',t:'CM_COMPRO',cols:42,desc:'Comprobantes contables'},
    {s:'dbo',t:'CM_DETCOM',cols:28,desc:'Detalle comprobantes'},
    {s:'dbo',t:'MA_CUENTA',cols:18,desc:'Plan de cuentas PCGE'},
    {s:'dbo',t:'MA_CENTRO',cols:12,desc:'Centros de costo'},
    {s:'dbo',t:'MA_PROVE', cols:24,desc:'Maestro proveedores'},
  ]);
  return ok(await getConcarBatches());
}
