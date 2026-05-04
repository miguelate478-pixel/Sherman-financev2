import { NextRequest } from 'next/server';
import { findCompanyById, updateDocument, createAuditLog, getCredentialByCompany } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized } from '@/lib/response';
import { getSunatProvider } from '@/lib/providers/sunat';
import { decrypt } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const { ruc, numRuc, codComp, serie, numero, fecha, monto, documentId, companyId } = await req.json();
    const provider = getSunatProvider();

    // Use credentials from DB if available
    let clientId: string | undefined;
    let clientSecret: string | undefined;
    if (companyId && process.env.SUNAT_PROVIDER === 'direct') {
      const cred = await getCredentialByCompany(companyId);
      if (cred?.clientId) {
        clientId = cred.clientId as string;
        if (cred.encClientSecret) {
          try {
            const p = JSON.parse(cred.encClientSecret as string) as { enc:string; iv:string; tag:string };
            clientSecret = decrypt(p.enc, p.iv, p.tag);
          } catch {}
        }
      }
    }

    const token    = await provider.getToken(clientId, clientSecret);
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
