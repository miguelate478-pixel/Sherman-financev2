import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized, getIP } from '@/lib/response';
import { getCredentialByCompany, findCompanyById, createAuditLog } from '@/lib/db';
import { decrypt } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  try {
    const { companyId, rucEmisor, tipoComprobante, serie, numero } = await req.json() as {
      companyId: string;
      rucEmisor: string;
      tipoComprobante: string;
      serie: string;
      numero: string;
    };

    if (!companyId || !rucEmisor || !tipoComprobante || !serie || !numero) {
      return err('Todos los campos son requeridos');
    }
    if (!/^\d{11}$/.test(rucEmisor)) return err('RUC emisor debe tener 11 dígitos');

    const company = await findCompanyById(companyId);
    const cred    = await getCredentialByCompany(companyId);
    if (!company) return err('Empresa no encontrada');
    if (!cred)    return err('Sin credenciales SOL configuradas');

    if (process.env.SUNAT_PROVIDER !== 'direct') {
      return err('Consulta XML solo disponible en modo producción (SUNAT_PROVIDER=direct)');
    }

    const solPass = decrypt(cred.encryptedPass as string, cred.iv as string, cred.authTag as string);

    console.log(`[CONSULTAR-XML] ${rucEmisor} ${tipoComprobante} ${serie}-${numero} para empresa ${company.ruc}`);

    // Timeout de 60 segundos
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const { downloadXmlFromSunat } = await import('@/lib/providers/sunat-scraper');

      const result = await downloadXmlFromSunat(
        { ruc: company.ruc as string, solUser: cred.solUser as string, solPass },
        { rucEmisor, tipoComprobante, serie, numero }
      );

      clearTimeout(timeout);

      if (!result.xmlContent) {
        return ok({
          success: false,
          error: result.error || 'XML no disponible',
          logs: result.logs,
          lines: [],
        });
      }

      // Parsear XML para extraer líneas
      const { parseXmlUbl } = await import('@/lib/xml-parser');
      let lines: unknown[] = [];
      let parseError = '';

      try {
        const parsed = await parseXmlUbl(result.xmlContent);
        lines = parsed.lines;
        console.log(`[CONSULTAR-XML] ${lines.length} líneas parseadas`);
      } catch (pe) {
        parseError = (pe as Error).message;
        console.error('[CONSULTAR-XML] Error parseando XML:', parseError);
      }

      await createAuditLog({
        userId: user.sub, userEmail: user.email, userRole: user.role,
        action: 'CONSULTAR_XML_INDIVIDUAL',
        object: `${rucEmisor} ${tipoComprobante} ${serie}-${numero} → ${lines.length} líneas`,
        ip: getIP(req),
      });

      return ok({
        success: true,
        xmlContent: result.xmlContent,
        xmlSize: result.xmlContent.length,
        lines,
        parseError: parseError || undefined,
        logs: result.logs,
      });

    } catch (e) {
      clearTimeout(timeout);
      if ((e as Error).name === 'AbortError') {
        return err('Timeout: la consulta tardó más de 60 segundos. SUNAT puede estar lento.', 408);
      }
      throw e;
    }

  } catch (e) {
    console.error('[CONSULTAR-XML] Error:', (e as Error).message);
    return err((e as Error).message, 500);
  }
}
