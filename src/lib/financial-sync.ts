import { createCxcRecord, createCxpRecord, createDetraccion, findCxcByDocId, findCxpByDocId, findDetraccionByDocId } from './db';

// ══════════════════════════════════════════════════════════
//  UTILIDADES
// ══════════════════════════════════════════════════════════

// Calcular fecha de vencimiento (30 días por defecto)
function calcularVencimiento(fechaEmision: string, dias: number = 30): string {
  const fecha = new Date(fechaEmision);
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().split('T')[0];
}

// Detectar si un servicio requiere detracción
// Regla: Servicios > S/ 700 están sujetos a detracción
function requiereDetraccion(total: number, moneda: string): boolean {
  if (moneda === 'USD') {
    // Convertir a PEN (tipo de cambio aprox 3.8)
    total = total * 3.8;
  }
  return total >= 700;
}

// Inferir código de detracción SUNAT
// Sin XML, usamos código genérico para servicios
function inferirCodigoDetraccion(_total: number): string {
  // Código 031: Demás servicios gravados con el IGV (más común)
  // Sin XML no podemos determinar el tipo exacto de bien/servicio
  return '031';
}

// Calcular porcentaje de detracción según código
function obtenerPorcentajeDetraccion(codigo: string): number {
  const PORCENTAJES: Record<string, number> = {
    '001': 10, '003': 10, '004': 4,  '005': 10, '007': 10,
    '010': 10, '012': 12, '019': 10, '020': 12, '021': 10,
    '022': 12, '024': 4,  '025': 4,  '027': 10, '030': 4,
    '031': 12, // Servicios generales (por defecto)
    '037': 10, // Bienes generales
  };
  return PORCENTAJES[codigo] || 12;
}

// ══════════════════════════════════════════════════════════
//  SINCRONIZACIÓN PRINCIPAL
// ══════════════════════════════════════════════════════════

export async function syncFinancialRecords(
  doc: {
    id: string;
    companyId: string;
    operation: string;
    docType: string;
    serie: string;
    number: string;
    issuerRuc: string;
    issuerName: string;
    receiverRuc: string;
    receiverName: string;
    issueDate: string;
    dueDate: string | null;
    total: number;
    currency: string;
  }
) {
  console.log(`[SYNC] Procesando ${doc.id} - ${doc.operation} - ${doc.docType}`);

  // ═══════════════════════════════════════════════════════
  // 1. CUENTAS POR COBRAR (CXC) - Solo VENTAS con Facturas
  // ═══════════════════════════════════════════════════════
  if (doc.operation === 'VENTA' && doc.docType === '01') {
    const exists = await findCxcByDocId(doc.id);
    if (!exists) {
      const dueDate = doc.dueDate || calcularVencimiento(doc.issueDate, 30);
      
      await createCxcRecord({
        id: `CXC-${doc.id}`,
        companyId: doc.companyId,
        documentId: doc.id,
        clientRuc: doc.receiverRuc,
        clientName: doc.receiverName,
        amount: doc.total,
        dueDate,
        status: 'PENDIENTE'
      });
      
      console.log(`[SYNC] ✅ CXC creado: ${doc.receiverName} - ${doc.total} ${doc.currency}`);
    } else {
      console.log(`[SYNC] ⊙ CXC ya existe para ${doc.id}`);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 2. CUENTAS POR PAGAR (CXP) - Solo COMPRAS con Facturas
  // ═══════════════════════════════════════════════════════
  if (doc.operation === 'COMPRA' && doc.docType === '01') {
    const exists = await findCxpByDocId(doc.id);
    if (!exists) {
      const dueDate = doc.dueDate || calcularVencimiento(doc.issueDate, 30);
      
      await createCxpRecord({
        id: `CXP-${doc.id}`,
        companyId: doc.companyId,
        documentId: doc.id,
        providerRuc: doc.issuerRuc,
        providerName: doc.issuerName,
        amount: doc.total,
        dueDate,
        status: 'PENDIENTE'
      });
      
      console.log(`[SYNC] ✅ CXP creado: ${doc.issuerName} - ${doc.total} ${doc.currency}`);
    } else {
      console.log(`[SYNC] ⊙ CXP ya existe para ${doc.id}`);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 3. DETRACCIONES - Solo COMPRAS > S/ 700
  // ═══════════════════════════════════════════════════════
  if (doc.operation === 'COMPRA' && doc.docType === '01') {
    if (requiereDetraccion(doc.total, doc.currency)) {
      const exists = await findDetraccionByDocId(doc.id);
      if (!exists) {
        const codigo = inferirCodigoDetraccion(doc.total);
        const pct = obtenerPorcentajeDetraccion(codigo);
        const amount = doc.total * (pct / 100);
        
        await createDetraccion({
          id: `DET-${doc.id}`,
          companyId: doc.companyId,
          documentId: doc.id,
          provider: doc.issuerName,
          provRuc: doc.issuerRuc,
          amount,
          pct,
          code: codigo,
          account: '00-010-348912', // Cuenta Banco de la Nación
          status: 'PENDIENTE'
        });
        
        console.log(`[SYNC] ✅ Detracción creada: ${doc.issuerName} - ${pct}% - ${amount.toFixed(2)}`);
      } else {
        console.log(`[SYNC] ⊙ Detracción ya existe para ${doc.id}`);
      }
    }
  }
}
