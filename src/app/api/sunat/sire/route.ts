import { NextRequest } from 'next/server';
import { findCompanyById, getCredentialByCompany, createAuditLog } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized, getIP } from '@/lib/response';
import { getSunatProvider } from '@/lib/providers/sunat';
import { decrypt } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  try {
    const { companyId, period, tipo } = await req.json() as { companyId:string; period:string; tipo:'RVIE'|'RCE' };
    if (!companyId||!period||!tipo) return err('companyId, period y tipo requeridos');
    const company = await findCompanyById(companyId);
    const cred    = await getCredentialByCompany(companyId);
    if (!company) return err('Empresa no encontrada');
    if (!cred)    return err('Sin credenciales SOL. Ve a Centro SUNAT → Credenciales SOL.');
    const provider = getSunatProvider();
    let sireToken:string;
    if (process.env.SUNAT_PROVIDER==='direct') {
      const solPass = decrypt(cred.encryptedPass as string, cred.iv as string, cred.authTag as string);
      sireToken = await provider.getSireToken(company.ruc as string, cred.solUser as string, solPass);
    } else {
      sireToken = await provider.getSireToken(company.ruc as string, '', '');
    }
    const ticket = await provider.getSirePropuesta(company.ruc as string, period, tipo, sireToken);
    await createAuditLog({ userId:user.sub, userEmail:user.email, userRole:user.role, action:`SIRE_${tipo}_SOLICITADO`, object:`${company.ruc} ${period}`, ip:getIP(req) });
    return ok({ numTicket:ticket.numTicket, estado:ticket.estado, mensaje:ticket.estado==='06'?'Propuesta lista':ticket.estado==='07'?'Error SIRE':'Procesando...', archivo:ticket.archivoReporte?.[0]?.nomArchivoReporte });
  } catch(e) { return err((e as Error).message, 500); }
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { searchParams } = new URL(req.url);
  const ticket = searchParams.get('ticket'), companyId = searchParams.get('companyId');
  if (!ticket||!companyId) return err('ticket y companyId requeridos');
  try {
    const cred = await getCredentialByCompany(companyId);
    const company = await findCompanyById(companyId);
    if (!cred||!company) return err('Sin configuración');
    const provider = getSunatProvider();
    let sireToken:string;
    if (process.env.SUNAT_PROVIDER==='direct') {
      const solPass = decrypt(cred.encryptedPass as string, cred.iv as string, cred.authTag as string);
      sireToken = await provider.getSireToken(company.ruc as string, cred.solUser as string, solPass);
    } else {
      sireToken = await provider.getSireToken(company.ruc as string, '', '');
    }
    const result = await provider.consultarTicket(ticket, sireToken);
    return ok(result);
  } catch(e) { return err((e as Error).message, 500); }
}
