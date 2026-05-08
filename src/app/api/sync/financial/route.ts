import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized, getIP } from '@/lib/response';
import { getDocuments, createAuditLog } from '@/lib/db';
import { syncFinancialRecords } from '@/lib/financial-sync';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  
  try {
    const { companyId, period } = await req.json();
    
    if (!companyId) {
      return err('companyId es requerido');
    }
    
    console.log(`[SYNC-API] Iniciando sincronización para companyId: ${companyId}, period: ${period || 'todos'}`);
    
    // Obtener documentos del período (o todos si no se especifica)
    const docs = await getDocuments({ companyId, period });
    
    console.log(`[SYNC-API] Encontrados ${(docs as any[]).length} documentos`);
    
    let cxcCreated = 0, cxpCreated = 0, detrCreated = 0, errors = 0;
    
    for (const doc of docs as any[]) {
      try {
        // Contar antes de sincronizar para saber qué se creó
        const isVentaFactura = doc.operation === 'VENTA' && doc.docType === '01';
        const isCompraFactura = doc.operation === 'COMPRA' && doc.docType === '01';
        const esDetraccion = doc.operation === 'COMPRA' && doc.total >= 700;
        
        await syncFinancialRecords({
          id: doc.id,
          companyId: doc.companyId,
          operation: doc.operation,
          docType: doc.docType,
          serie: doc.serie,
          number: doc.number,
          issuerRuc: doc.issuerRuc,
          issuerName: doc.issuerName,
          receiverRuc: doc.receiverRuc,
          receiverName: doc.receiverName,
          issueDate: doc.issueDate,
          dueDate: doc.dueDate,
          total: doc.total,
          currency: doc.currency,
        });
        
        // Incrementar contadores
        if (isVentaFactura) cxcCreated++;
        if (isCompraFactura) cxpCreated++;
        if (esDetraccion) detrCreated++;
        
      } catch (e) {
        console.error(`[SYNC-API] Error en ${doc.id}:`, (e as Error).message);
        errors++;
      }
    }
    
    await createAuditLog({
      userId: user.sub,
      userEmail: user.email,
      userRole: user.role,
      action: 'SYNC_FINANCIAL',
      object: `${companyId} ${period || 'all'} - CXC:${cxcCreated} CXP:${cxpCreated} DET:${detrCreated}`,
      ip: getIP(req),
    });
    
    console.log(`[SYNC-API] Completado - CXC:${cxcCreated} CXP:${cxpCreated} DET:${detrCreated} Errores:${errors}`);
    
    return ok({
      success: true,
      cxcCreated,
      cxpCreated,
      detrCreated,
      errors,
      totalDocs: (docs as any[]).length,
      message: `Sincronización completada: ${cxcCreated} CXC, ${cxpCreated} CXP, ${detrCreated} detracciones`
    });
    
  } catch (e) {
    console.error('[SYNC-API] Error general:', (e as Error).message);
    return err(`Error: ${(e as Error).message}`, 500);
  }
}
