import { NextRequest } from 'next/server';
import { findDocumentById, updateDocument, createAuditLog } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized } from '@/lib/response';
export async function GET(req: NextRequest, { params }:{ params:Promise<{id:string}> }) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { id } = await params;
  const doc = await findDocumentById(id);
  if (!doc) return err('No encontrado', 404);
  return ok(doc);
}
export async function PATCH(req: NextRequest, { params }:{ params:Promise<{id:string}> }) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { id } = await params;
  const body = await req.json();
  const allowed = ['workflow','concarStatus','parserStatus','aiStatus','sunatStatus'];
  const data: Record<string,unknown> = {};
  allowed.forEach(k => { if(body[k]!==undefined) data[k]=body[k]; });
  await updateDocument(id, data);
  await createAuditLog({ userId:user.sub, userEmail:user.email, userRole:user.role, action:'DOC_UPDATED', object:id });
  return ok({ updated:true });
}
