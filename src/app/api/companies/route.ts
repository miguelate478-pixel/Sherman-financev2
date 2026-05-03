import { NextRequest } from 'next/server';
import { getAllCompanies, findCompanyByRuc, createCompany, upsertCredential, createAuditLog } from '@/lib/db';
import { getUser, resolveCompanyFilter } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';
import { ok, err, unauthorized, getIP } from '@/lib/response';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const allCompanies = await getAllCompanies();
  const { companyIds } = resolveCompanyFilter(user);

  // Filter: admin sin restricción ve todas, otros solo las suyas
  const visible = companyIds === null
    ? allCompanies
    : (allCompanies as Record<string,unknown>[]).filter(c => companyIds.includes(c.id as string));

  return ok((visible as Record<string,unknown>[]).map(c => ({
    id: c.id, ruc: c.ruc, nombre: c.businessName, nombreComercial: c.tradeName || c.businessName,
    regimen: c.regime, sector: c.sector, contacto: c.contactEmail, igv: c.igvRate, estado: c.status,
    credEstado: c.credential ? ((c.credential as Record<string,unknown>).status === 'verified' ? 'configuradas' : 'sin_configurar') : 'sin_configurar',
  })));
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'Administrador') return err('Solo administradores pueden crear empresas', 403);

  try {
    const { ruc, businessName, tradeName, regime, sector, contactEmail, igvRate, status, solUser, solPass } = await req.json();
    if (!ruc || !/^\d{11}$/.test(ruc)) return err('RUC debe tener 11 dígitos');
    if (!businessName?.trim()) return err('Razón social requerida');
    const exists = await findCompanyByRuc(ruc);
    if (exists) return err('RUC ya registrado');

    const company = await createCompany({ ruc, businessName, tradeName, regime: regime || 'General', sector, contactEmail, igvRate: igvRate || 18, status: status || 'activo' });
    if (solUser && solPass) {
      const { encrypted, iv, authTag } = encrypt(solPass);
      await upsertCredential(company.id as string, { solUser, encryptedPass: encrypted, iv, authTag });
    }
    await createAuditLog({ userId: user.sub, userEmail: user.email, userRole: user.role, action: 'COMPANY_CREATED', object: ruc, ip: getIP(req) });
    return ok({ id: company.id, ruc, businessName }, 201);
  } catch (e: unknown) {
    return err((e as Error).message || 'Error', 500);
  }
}
