import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { ok, unauthorized } from '@/lib/response';
import { queryAll } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    
    if (!companyId) {
      return ok({ error: 'companyId es requerido' });
    }
    
    // Contar documentos
    const docs = await queryAll(
      'SELECT COUNT(*) as total, operation, "docType" FROM documents WHERE "companyId"=$1 GROUP BY operation, "docType"',
      [companyId]
    );
    
    // Contar CXC
    const cxc = await queryAll(
      'SELECT COUNT(*) as total FROM cxc_records WHERE "companyId"=$1',
      [companyId]
    );
    
    // Contar CXP
    const cxp = await queryAll(
      'SELECT COUNT(*) as total FROM cxp_records WHERE "companyId"=$1',
      [companyId]
    );
    
    // Contar Detracciones
    const det = await queryAll(
      'SELECT COUNT(*) as total FROM detractions WHERE "companyId"=$1',
      [companyId]
    );
    
    // Documentos sin CXC/CXP
    const ventasSinCxc = await queryAll(
      `SELECT COUNT(*) as total FROM documents d
       WHERE d."companyId"=$1 AND d.operation='VENTA' AND d."docType"='01'
       AND NOT EXISTS (SELECT 1 FROM cxc_records WHERE "documentId"=d.id)`,
      [companyId]
    );
    
    const comprasSinCxp = await queryAll(
      `SELECT COUNT(*) as total FROM documents d
       WHERE d."companyId"=$1 AND d.operation='COMPRA' AND d."docType"='01'
       AND NOT EXISTS (SELECT 1 FROM cxp_records WHERE "documentId"=d.id)`,
      [companyId]
    );
    
    const comprasSinDet = await queryAll(
      `SELECT COUNT(*) as total FROM documents d
       WHERE d."companyId"=$1 AND d.operation='COMPRA' AND d."docType"='01' AND d.total >= 700
       AND NOT EXISTS (SELECT 1 FROM detractions WHERE "documentId"=d.id)`,
      [companyId]
    );
    
    return ok({
      companyId,
      documents: docs,
      financial: {
        cxc: parseInt((cxc[0] as any)?.total || '0'),
        cxp: parseInt((cxp[0] as any)?.total || '0'),
        detracciones: parseInt((det[0] as any)?.total || '0'),
      },
      pending: {
        ventasSinCxc: parseInt((ventasSinCxc[0] as any)?.total || '0'),
        comprasSinCxp: parseInt((comprasSinCxp[0] as any)?.total || '0'),
        comprasSinDet: parseInt((comprasSinDet[0] as any)?.total || '0'),
      }
    });
    
  } catch (e) {
    return ok({ error: (e as Error).message });
  }
}
