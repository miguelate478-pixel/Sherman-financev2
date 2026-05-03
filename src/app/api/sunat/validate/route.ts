import { NextRequest } from 'next/server';
import { findCompanyById, updateDocument, createAuditLog } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized } from '@/lib/response';
import { getSunatProvider } from '@/lib/providers/sunat';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const { ruc, numRuc, codComp, serie, numero, fecha, monto, documentId } = await req.json();
    const provider = getSunatProvider();
    const token    = await provider.getToken();
    const queryRuc = ruc || numRuc;
    const result   = await provider.validateDocument({ ruc:queryRuc, token, numRuc, codComp, serie, numero, fecha, monto:parseFloat(monto)||0 });
    if (documentId) {
      const status = result.estadoCp==='1'?'ACEPTADO':result.estadoCp==='2'?'ANULADO':'OBSERVADO';
      await updateDocument(documentId, { sunatStatus:status });
    }
    await createAuditLog({ userId:user.sub, userEmail:user.email, userRole:user.role, action:'CPE_VALIDADO', object:`${numRuc}-${codComp}-${serie}-${numero}` });
    return ok(result);
  } catch(e) { return err((e as Error).message, 500); }
}
