import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized } from '@/lib/response';
import { HybridXMLProvider } from '@/lib/providers/hybrid-xml-provider';
import { findCompanyById, getCredentialByCompany } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { saveFile, getStoragePath } from '@/lib/providers/sunat';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  try {
    const { companyId, rucEmisor, tipoComprobante, serie, numero } = await req.json();

    if (!companyId || !rucEmisor || !tipoComprobante || !serie || !numero) {
      return err('Faltan parámetros requeridos');
    }

    // Obtener credenciales de la empresa
    const company = await findCompanyById(companyId);
    const cred = await getCredentialByCompany(companyId);

    if (!company || !cred) {
      return err('Empresa o credenciales no encontradas');
    }

    // Desencriptar credenciales
    const solPass = decrypt(cred.encryptedPass as string, cred.iv as string, cred.authTag as string);

    // Descargar XML usando provider híbrido
    const provider = new HybridXMLProvider();

    const result = await provider.downloadXML({
      ruc: company.ruc as string,
      solUser: cred.solUser as string,
      solPass,
      rucEmisor,
      tipoComprobante,
      serie,
      numero,
    });

    // Guardar en storage
    const period = new Date().toISOString().substring(0, 7); // YYYY-MM
    const docId = `${serie}-${numero}`;
    const storagePath = getStoragePath(company.ruc as string, period, 'COMPRAS', tipoComprobante, docId);

    saveFile(storagePath, result.fileName, result.buffer);

    // Cerrar navegador si se usó scraping
    await provider.close();

    return ok({
      fileName: result.fileName,
      size: result.buffer.length,
      provider: result.provider,
      storagePath,
    });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}

// Endpoint para descarga batch
export async function PUT(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  try {
    const { companyId, comprobantes } = await req.json();

    if (!companyId || !Array.isArray(comprobantes) || comprobantes.length === 0) {
      return err('Parámetros inválidos');
    }

    // Obtener credenciales
    const company = await findCompanyById(companyId);
    const cred = await getCredentialByCompany(companyId);

    if (!company || !cred) {
      return err('Empresa o credenciales no encontradas');
    }

    const solPass = decrypt(cred.encryptedPass as string, cred.iv as string, cred.authTag as string);

    // Preparar parámetros
    const params = comprobantes.map(comp => ({
      ruc: company.ruc as string,
      solUser: cred.solUser as string,
      solPass,
      rucEmisor: comp.rucEmisor,
      tipoComprobante: comp.tipoComprobante,
      serie: comp.serie,
      numero: comp.numero,
    }));

    // Descargar batch
    const provider = new HybridXMLProvider();
    const results = await provider.downloadXMLBatch(params);

    // Guardar archivos exitosos
    const period = new Date().toISOString().substring(0, 7);
    for (const result of results) {
      if (result.success && result.buffer) {
        const comp = comprobantes.find(c => `${c.serie}-${c.numero}` === result.comprobante);
        if (comp) {
          const storagePath = getStoragePath(
            company.ruc as string,
            period,
            'COMPRAS',
            comp.tipoComprobante,
            result.comprobante
          );
          saveFile(storagePath, result.fileName!, result.buffer);
        }
      }
    }

    // Cerrar navegador
    await provider.close();

    // Estadísticas
    const stats = {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      scraping: results.filter(r => r.provider === 'scraping').length,
      excelnegocios: results.filter(r => r.provider === 'excelnegocios').length,
    };

    return ok({
      results: results.map(r => ({
        comprobante: r.comprobante,
        success: r.success,
        provider: r.provider,
        error: r.error,
      })),
      stats,
    });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
