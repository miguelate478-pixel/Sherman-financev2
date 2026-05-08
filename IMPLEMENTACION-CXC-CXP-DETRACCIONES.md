# Implementación: CXC, CXP y Detracciones (SIN XMLs)

## 📊 Datos Disponibles desde SIRE (Sin XMLs)

```typescript
interface SunatDocument {
  // IDENTIFICACIÓN
  id: string,                    // ✅ ID único
  tipo: string,                  // ✅ 01=Factura, 03=Boleta, etc.
  serie: string,                 // ✅ Serie
  numero: string,                // ✅ Número
  
  // FECHAS
  fecha: string,                 // ✅ Fecha de emisión
  fecVencPag?: string,           // ⚠️ Fecha vencimiento (puede ser undefined)
  
  // MONTOS
  total: number,                 // ✅ Total
  moneda: string,                // ✅ PEN/USD
  biGravadaDG?: number,          // ⚠️ Base imponible (puede ser undefined)
  igvDG?: number,                // ⚠️ IGV (puede ser undefined)
  
  // EMISOR
  rucEmisor: string,             // ✅ RUC emisor
  rsEmisor: string,              // ✅ Razón social emisor
  
  // RECEPTOR
  rucReceptor: string,           // ✅ RUC receptor
  rsReceptor: string,            // ✅ Razón social receptor
  
  // CLIENTE (solo en VENTAS)
  tipoDocCliente?: string,       // ⚠️ Tipo doc cliente
  numDocCliente?: string,        // ⚠️ Número doc cliente
  razonSocialCliente?: string,   // ⚠️ Razón social cliente
  
  // ESTADOS
  sunatStatus: string,           // ✅ Estado SUNAT
  cdrStatus: string              // ✅ Estado CDR
}
```

## ⚠️ LIMITACIONES SIN XML

**NO tienes:**
- ❌ Detalle de líneas del comprobante
- ❌ Información de detracción (monto, porcentaje, código)
- ❌ Condiciones de pago específicas
- ❌ Datos adicionales del XML

**Solución:** Trabajar solo con datos del resumen SIRE.

---

## 🎯 IMPLEMENTACIÓN

### Paso 1: Crear Funciones de Base de Datos

```typescript
// src/lib/db.ts

// ── CXC ────────────────────────────────────────────────────
export async function createCxcRecord(data: {
  id: string;
  companyId: string;
  documentId: string;
  clientRuc: string;
  clientName: string;
  amount: number;
  dueDate: string;
  status: string;
}) {
  await execute(
    `INSERT INTO cxc_records (id, "companyId", "documentId", "clientRuc", "clientName", amount, "dueDate", status, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [data.id, data.companyId, data.documentId, data.clientRuc, data.clientName, data.amount, data.dueDate, data.status]
  );
}

export async function findCxcByDocId(documentId: string) {
  const rows = await queryAll('SELECT * FROM cxc_records WHERE "documentId"=$1', [documentId]);
  return rows[0] || null;
}

// ── CXP ────────────────────────────────────────────────────
export async function createCxpRecord(data: {
  id: string;
  companyId: string;
  documentId: string;
  providerRuc: string;
  providerName: string;
  amount: number;
  dueDate: string;
  status: string;
}) {
  await execute(
    `INSERT INTO cxp_records (id, "companyId", "documentId", "providerRuc", "providerName", amount, "dueDate", status, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [data.id, data.companyId, data.documentId, data.providerRuc, data.providerName, data.amount, data.dueDate, data.status]
  );
}

export async function findCxpByDocId(documentId: string) {
  const rows = await queryAll('SELECT * FROM cxp_records WHERE "documentId"=$1', [documentId]);
  return rows[0] || null;
}

// ── DETRACCIONES ───────────────────────────────────────────
export async function createDetraccion(data: {
  id: string;
  companyId: string;
  documentId: string;
  provider: string;
  provRuc: string;
  amount: number;
  pct: number;
  code: string;
  account: string;
  status: string;
}) {
  await execute(
    `INSERT INTO detractions (id, "companyId", "documentId", provider, "provRuc", amount, pct, code, account, status, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [data.id, data.companyId, data.documentId, data.provider, data.provRuc, data.amount, data.pct, data.code, data.account, data.status]
  );
}

export async function findDetraccionByDocId(documentId: string) {
  const rows = await queryAll('SELECT * FROM detractions WHERE "documentId"=$1', [documentId]);
  return rows[0] || null;
}
```

---

### Paso 2: Función de Sincronización

```typescript
// src/lib/financial-sync.ts

import { createCxcRecord, createCxpRecord, createDetraccion, findCxcByDocId, findCxpByDocId, findDetraccionByDocId } from './db';

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
function inferirCodigoDetraccion(total: number): string {
  // Código 031: Demás servicios gravados con el IGV (más común)
  // Código 037: Demás bienes gravados con el IGV
  // Por defecto usamos 031 para servicios
  return '031';
}

// Calcular porcentaje de detracción según código
function obtenerPorcentajeDetraccion(codigo: string): number {
  const PORCENTAJES: Record<string, number> = {
    '001': 10, '003': 10, '004': 4,  '005': 10, '007': 10,
    '010': 10, '012': 12, '019': 10, '020': 12, '021': 10,
    '022': 12, '024': 4,  '025': 4,  '027': 10, '030': 4,
    '031': 12, // Servicios generales
    '037': 10, // Bienes generales
  };
  return PORCENTAJES[codigo] || 12;
}

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
```

---

### Paso 3: Integrar en Bulk Download

```typescript
// src/app/api/sunat/bulk-download/route.ts

// Importar la función de sincronización
import { syncFinancialRecords } from '@/lib/financial-sync';

// Dentro del loop de documentos, DESPUÉS de createDocument()
// Buscar esta sección (línea ~230):

if (!existing) {
  try {
    console.log('[BULK] Guardando doc:', docId, 'companyId:', companyId, 'periodo:', period);
    await createDocument({
      id: docId,
      companyId,
      bulkJobId: jobId,
      operation: op === 'COMPRAS' ? 'COMPRA' : 'VENTA',
      docType: doc.tipo,
      serie: doc.serie,
      number: doc.numero,
      issuerRuc: doc.rucEmisor,
      issuerName: doc.rsEmisor,
      receiverRuc,
      receiverName,
      issueDate: doc.fecha,
      dueDate: doc.fecVencPag || null,
      currency: doc.moneda,
      base: parseFloat(base.toFixed(2)),
      igv: parseFloat(igv.toFixed(2)),
      total: doc.total,
      sunatStatus: doc.sunatStatus,
      cdrStatus: doc.cdrStatus,
      hasXml,
      hasPdf,
      hasCdr,
      xmlPath,
      pdfPath,
      cdrPath,
      hashSha256: docHash,
      period,
      workflow: 'PENDIENTE_REVISION',
      concarStatus: 'PENDIENTE',
      parserStatus: 'PENDIENTE',
      aiStatus: 'PENDIENTE',
    });
    console.log('[BULK] Doc guardado OK:', docId);
    
    // ═══════════════════════════════════════════════════════
    // ✨ NUEVO: Sincronizar registros financieros
    // ═══════════════════════════════════════════════════════
    try {
      await syncFinancialRecords({
        id: docId,
        companyId,
        operation: op === 'COMPRAS' ? 'COMPRA' : 'VENTA',
        docType: doc.tipo,
        serie: doc.serie,
        number: doc.numero,
        issuerRuc: doc.rucEmisor,
        issuerName: doc.rsEmisor,
        receiverRuc,
        receiverName,
        issueDate: doc.fecha,
        dueDate: doc.fecVencPag || null,
        total: doc.total,
        currency: doc.moneda,
      });
    } catch (syncErr) {
      console.error(`[BULK] Error sincronizando financiero ${docId}:`, (syncErr as Error).message);
      // No fallar el documento completo si falla la sincronización
    }
    
  } catch (dbError) {
    console.error(`[BULK_DOWNLOAD] Failed to save document ${docId}:`, dbError);
    periodErrors++;
    continue;
  }
}
```

---

## 🧪 PRUEBAS

### 1. Probar con datos existentes

Crear endpoint de sincronización manual:

```typescript
// src/app/api/sync/financial/route.ts
import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized } from '@/lib/response';
import { getDocuments } from '@/lib/db';
import { syncFinancialRecords } from '@/lib/financial-sync';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  
  try {
    const { companyId, period } = await req.json();
    
    // Obtener documentos del período
    const docs = await getDocuments({ companyId, period });
    
    let cxcCreated = 0, cxpCreated = 0, detrCreated = 0;
    
    for (const doc of docs as any[]) {
      try {
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
        
        // Contar qué se creó
        if (doc.operation === 'VENTA' && doc.docType === '01') cxcCreated++;
        if (doc.operation === 'COMPRA' && doc.docType === '01') cxpCreated++;
        if (doc.operation === 'COMPRA' && doc.total >= 700) detrCreated++;
        
      } catch (e) {
        console.error(`[SYNC] Error en ${doc.id}:`, (e as Error).message);
      }
    }
    
    return ok({
      success: true,
      cxcCreated,
      cxpCreated,
      detrCreated,
      message: `Sincronización completada: ${cxcCreated} CXC, ${cxpCreated} CXP, ${detrCreated} detracciones`
    });
    
  } catch (e) {
    return err(`Error: ${(e as Error).message}`, 500);
  }
}
```

### 2. Probar desde el dashboard

```bash
# Sincronizar documentos existentes
POST /api/sync/financial
{
  "companyId": "tu-company-id",
  "period": "2025-01"
}
```

---

## 📊 RESULTADO ESPERADO

Después de ejecutar la sincronización:

### CXC (Cuentas por Cobrar)
```sql
SELECT * FROM cxc_records WHERE "companyId" = 'tu-company-id';
```
Verás todas las facturas de VENTA con:
- Cliente RUC/Nombre
- Monto
- Fecha de vencimiento
- Estado PENDIENTE

### CXP (Cuentas por Pagar)
```sql
SELECT * FROM cxp_records WHERE "companyId" = 'tu-company-id';
```
Verás todas las facturas de COMPRA con:
- Proveedor RUC/Nombre
- Monto
- Fecha de vencimiento
- Estado PENDIENTE

### Detracciones
```sql
SELECT * FROM detractions WHERE "companyId" = 'tu-company-id';
```
Verás todas las facturas de COMPRA > S/ 700 con:
- Proveedor
- Monto de detracción (12% por defecto)
- Código 031 (servicios)
- Estado PENDIENTE

---

## ⚠️ LIMITACIONES SIN XML

1. **Detracción aproximada**: Sin XML, no sabemos el porcentaje exacto
   - Solución: Usar 12% por defecto (código 031)
   - Usuario puede editar manualmente si es diferente

2. **Fecha de vencimiento**: Puede venir null desde SIRE
   - Solución: Calcular 30 días desde fecha de emisión
   - Usuario puede editar manualmente

3. **No detectamos tipo de bien/servicio**: Sin líneas del XML
   - Solución: Usar código genérico 031 (servicios)
   - Usuario puede cambiar si es necesario

---

## ✅ VENTAJAS

1. **Funciona SIN XMLs** - Solo con datos SIRE
2. **Automático** - Se crea al descargar documentos
3. **Retroactivo** - Endpoint de sincronización para docs existentes
4. **Simple** - Lógica clara y mantenible

¿Implementamos esto?
