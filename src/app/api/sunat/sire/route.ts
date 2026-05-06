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
      let clientId: string | undefined = cred.clientId as string || undefined;
      let clientSecret: string | undefined;
      if (cred.encClientSecret) {
        try {
          const p = JSON.parse(cred.encClientSecret as string) as { enc:string; iv:string; tag:string };
          clientSecret = decrypt(p.enc, p.iv, p.tag);
        } catch {}
      }
      sireToken = await provider.getSireToken(company.ruc as string, cred.solUser as string, solPass, clientId, clientSecret);
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
      const clientId: string | undefined = cred.clientId as string || undefined;
      let clientSecret: string | undefined;
      if (cred.encClientSecret) {
        try {
          const p = JSON.parse(cred.encClientSecret as string) as { enc:string; iv:string; tag:string };
          clientSecret = decrypt(p.enc, p.iv, p.tag);
        } catch {}
      }
      sireToken = await provider.getSireToken(company.ruc as string, cred.solUser as string, solPass, clientId, clientSecret);
    } else {
      sireToken = await provider.getSireToken(company.ruc as string, '', '');
    }

    // Llamar directamente al endpoint de polling y devolver la respuesta RAW completa
    const periodo = searchParams.get('period') || '';
    const codLibro = searchParams.get('codLibro') || '080000';
    const rawUrl = `https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets`
      + `?perIni=${periodo}&perFin=${periodo}&page=1&perPage=20&numTicket=${ticket}&codLibro=${codLibro}&codOrigenEnvio=2`;

    const rawRes = await fetch(rawUrl, {
      headers: {
        'Authorization': `Bearer ${sireToken}`,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'es-419,es;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://e-factura.sunat.gob.pe',
        'Referer': 'https://e-factura.sunat.gob.pe/',
      },
      signal: AbortSignal.timeout(10000),
    });
    const rawText = await rawRes.text();
    console.log(`[SIRE-DIAG] HTTP ${rawRes.status} URL: ${rawUrl}`);
    console.log(`[SIRE-DIAG] RAW: ${rawText}`);

    let parsed: unknown;
    try { parsed = JSON.parse(rawText); } catch { parsed = rawText; }

    // También devolver el resultado de consultarTicket para comparar
    const result = await provider.consultarTicket(ticket, sireToken, periodo || undefined);
    return ok({ sunatRaw: parsed, sunatStatus: rawRes.status, consultarTicketResult: result });
  } catch(e) { return err((e as Error).message, 500); }
}
