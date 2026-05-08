# Explicación: Módulos Financieros en Sherman Finance

## 📋 Resumen

Los módulos de **Bancos**, **Conciliación**, **Cuentas por Cobrar (CXC)**, **Cuentas por Pagar (CXP)** y **Detracciones** SÍ están implementados en tu aplicación, pero actualmente **solo leen datos de la base de datos** - no generan datos automáticamente desde los documentos SUNAT.

## 🔍 Estado Actual de Cada Módulo

### 1. 🏦 BANCOS
**Ubicación:** `/api/banks/route.ts`
**Tabla:** `bank_movements`

**Funcionalidad:**
- ✅ **GET**: Lista movimientos bancarios de una empresa
- ✅ **PATCH**: Marca un movimiento como conciliado (asocia con un documento)

**Campos:**
```typescript
{
  id: string,
  companyId: string,
  date: string,           // Fecha del movimiento
  description: string,    // Descripción
  type: string,          // INGRESO / EGRESO
  amount: number,        // Monto
  balance: number,       // Saldo
  reconciled: boolean,   // ¿Conciliado?
  matchDocId: string,    // ID del documento asociado
  matchName: string      // Nombre del match
}
```

**⚠️ PROBLEMA:** Los movimientos bancarios NO se crean automáticamente. Debes:
1. Importarlos manualmente desde un CSV del banco
2. O crearlos manualmente en la BD

---

### 2. ⇌ CONCILIACIÓN BANCARIA
**Ubicación:** Mismo endpoint que Bancos (`/api/banks`)
**Vista:** `src/app/dashboard/page.tsx` - función `ConciliacionView`

**Funcionalidad:**
- Muestra movimientos bancarios vs documentos contables
- Permite "matchear" un movimiento bancario con un documento
- Actualiza el campo `reconciled` y guarda `matchDocId`

**Flujo:**
1. Usuario ve lista de movimientos bancarios sin conciliar
2. Usuario ve lista de documentos (facturas, boletas)
3. Usuario hace clic en "Conciliar" para asociar movimiento con documento
4. Se marca como conciliado en la BD

**⚠️ PROBLEMA:** No hay matching automático. Todo es manual.

---

### 3. → CUENTAS POR COBRAR (CXC)
**Ubicación:** `/api/cxc/route.ts`
**Tabla:** `cxc_records`

**Funcionalidad:**
- ✅ **GET**: Lista cuentas por cobrar de una empresa
- ✅ **PATCH**: Marca una cuenta como cobrada

**Campos:**
```typescript
{
  id: string,
  companyId: string,
  documentId: string,     // Referencia al documento (factura de venta)
  clientRuc: string,      // RUC del cliente
  clientName: string,     // Nombre del cliente
  amount: number,         // Monto a cobrar
  dueDate: string,        // Fecha de vencimiento
  status: string,         // PENDIENTE / COBRADO / VENCIDO
  paidDate: string,       // Fecha de pago
  paidAmount: number      // Monto pagado
}
```

**⚠️ PROBLEMA:** Los registros CXC NO se crean automáticamente desde las facturas de venta.

---

### 4. ← CUENTAS POR PAGAR (CXP)
**Ubicación:** `/api/cxp/route.ts`
**Tabla:** `cxp_records`

**Funcionalidad:**
- ✅ **GET**: Lista cuentas por pagar de una empresa
- ✅ **PATCH**: Marca una cuenta como pagada

**Campos:**
```typescript
{
  id: string,
  companyId: string,
  documentId: string,      // Referencia al documento (factura de compra)
  providerRuc: string,     // RUC del proveedor
  providerName: string,    // Nombre del proveedor
  amount: number,          // Monto a pagar
  dueDate: string,         // Fecha de vencimiento
  status: string,          // PENDIENTE / PAGADO / VENCIDO
  paidDate: string,        // Fecha de pago
  paidAmount: number       // Monto pagado
}
```

**⚠️ PROBLEMA:** Los registros CXP NO se crean automáticamente desde las facturas de compra.

---

### 5. ◑ DETRACCIONES
**Ubicación:** `/api/detracciones/route.ts`
**Tabla:** `detractions`

**Funcionalidad:**
- ✅ **GET**: Lista detracciones de una empresa
- ✅ **PATCH**: Marca una detracción como depositada

**Campos:**
```typescript
{
  id: string,
  companyId: string,
  documentId: string,      // Referencia al documento
  provider: string,        // Nombre del proveedor
  provRuc: string,         // RUC del proveedor
  amount: number,          // Monto de la detracción
  pct: number,             // Porcentaje (4%, 10%, 12%, etc.)
  code: string,            // Código de bien/servicio SUNAT
  account: string,         // Cuenta bancaria de detracciones
  status: string,          // PENDIENTE / DEPOSITADO
  depositDate: string      // Fecha de depósito
}
```

**⚠️ PROBLEMA:** Los registros de detracciones NO se crean automáticamente desde las facturas.

---

## 🚨 Problema Principal

### Los datos NO se generan automáticamente

Actualmente, cuando descargas facturas desde SUNAT:
1. ✅ Se guardan en la tabla `documents`
2. ✅ Se parsean las líneas (si hay XML)
3. ✅ Se clasifican con IA
4. ❌ **NO se crean registros en CXC**
5. ❌ **NO se crean registros en CXP**
6. ❌ **NO se crean registros de detracciones**
7. ❌ **NO se importan movimientos bancarios**

### ¿Por qué no funcionan?

Las tablas están **vacías** porque:
- No hay código que cree registros CXC/CXP desde los documentos
- No hay importador de extractos bancarios
- No hay detector automático de detracciones

---

## ✅ Solución: Automatizar la Creación de Registros

### Opción 1: Crear registros al descargar documentos

Modificar `src/app/api/sunat/bulk-download/route.ts` para que después de guardar un documento:

```typescript
// Después de createDocument()...

// Si es VENTA → crear CXC
if (op === 'VENTAS' && doc.tipo === '01') {
  await createCxcRecord({
    id: `CXC-${docId}`,
    companyId,
    documentId: docId,
    clientRuc: doc.rucReceptor,
    clientName: doc.rsReceptor,
    amount: doc.total,
    dueDate: doc.fecVencPag || calcularVencimiento(doc.fecha, 30),
    status: 'PENDIENTE'
  });
}

// Si es COMPRA → crear CXP
if (op === 'COMPRAS' && doc.tipo === '01') {
  await createCxpRecord({
    id: `CXP-${docId}`,
    companyId,
    documentId: docId,
    providerRuc: doc.rucEmisor,
    providerName: doc.rsEmisor,
    amount: doc.total,
    dueDate: doc.fecVencPag || calcularVencimiento(doc.fecha, 30),
    status: 'PENDIENTE'
  });
}

// Si tiene detracción → crear registro
if (doc.detraccion && doc.pct_d > 0) {
  await createDetraccion({
    id: `DET-${docId}`,
    companyId,
    documentId: docId,
    provider: doc.rsEmisor,
    provRuc: doc.rucEmisor,
    amount: doc.monto_d,
    pct: doc.pct_d,
    code: detectarCodigoDetraccion(doc),
    account: '00-010-348912', // Cuenta de detracciones
    status: 'PENDIENTE'
  });
}
```

### Opción 2: Crear endpoint de sincronización

Crear `/api/sync/financial` que:
1. Lee todos los documentos sin CXC/CXP
2. Crea los registros faltantes
3. Detecta detracciones automáticamente

### Opción 3: Importador de extractos bancarios

Crear `/api/banks/import` que:
1. Recibe un CSV del banco
2. Parsea las columnas (fecha, descripción, monto, saldo)
3. Crea registros en `bank_movements`
4. Opcionalmente intenta matching automático con documentos

---

## 📊 Vista en el Dashboard

El dashboard SÍ tiene las vistas implementadas:

### Bancos
- Muestra movimientos bancarios
- Permite filtrar por conciliados/no conciliados
- Muestra saldo actual

### Conciliación
- Lista movimientos bancarios sin conciliar
- Lista documentos disponibles
- Botón "Conciliar" para hacer match manual

### CXC (Cuentas por Cobrar)
- Lista facturas de venta pendientes de cobro
- Muestra fecha de vencimiento
- Botón "Marcar como cobrado"
- Alerta de facturas vencidas

### CXP (Cuentas por Pagar)
- Lista facturas de compra pendientes de pago
- Muestra fecha de vencimiento
- Botón "Marcar como pagado"
- Alerta de facturas vencidas

### Detracciones
- Lista detracciones pendientes
- Muestra monto y porcentaje
- Botón "Marcar como depositado"
- Alerta si hay detracciones pendientes cerca del día 12

---

## 🎯 Recomendaciones

### Corto Plazo (1-2 días)
1. **Crear función de sincronización** que genere CXC/CXP desde documentos existentes
2. **Agregar lógica de detección de detracciones** (servicios sujetos a detracción)
3. **Probar con datos reales** para verificar que funciona

### Mediano Plazo (1 semana)
1. **Importador de extractos bancarios** (CSV de BCP, BBVA, Interbank)
2. **Matching automático** banco vs documentos (por monto y fecha)
3. **Alertas automáticas** de vencimientos

### Largo Plazo (1 mes)
1. **Integración con APIs bancarias** (scraping o API oficial)
2. **Predicción de flujo de caja** con IA
3. **Conciliación automática** con machine learning

---

## 🔧 Código de Ejemplo: Sincronización

```typescript
// src/app/api/sync/financial/route.ts
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  
  const { companyId } = await req.json();
  
  // 1. Obtener documentos sin CXC/CXP
  const docs = await getDocuments({ companyId });
  
  let cxcCreated = 0, cxpCreated = 0, detrCreated = 0;
  
  for (const doc of docs) {
    // Crear CXC para ventas
    if (doc.operation === 'VENTA' && doc.docType === '01') {
      const exists = await findCxcByDocId(doc.id);
      if (!exists) {
        await createCxcRecord({
          id: `CXC-${doc.id}`,
          companyId,
          documentId: doc.id,
          clientRuc: doc.receiverRuc,
          clientName: doc.receiverName,
          amount: doc.total,
          dueDate: doc.dueDate || addDays(doc.issueDate, 30),
          status: 'PENDIENTE'
        });
        cxcCreated++;
      }
    }
    
    // Crear CXP para compras
    if (doc.operation === 'COMPRA' && doc.docType === '01') {
      const exists = await findCxpByDocId(doc.id);
      if (!exists) {
        await createCxpRecord({
          id: `CXP-${doc.id}`,
          companyId,
          documentId: doc.id,
          providerRuc: doc.issuerRuc,
          providerName: doc.issuerName,
          amount: doc.total,
          dueDate: doc.dueDate || addDays(doc.issueDate, 30),
          status: 'PENDIENTE'
        });
        cxpCreated++;
      }
    }
    
    // Detectar detracciones (servicios > S/ 700)
    if (doc.operation === 'COMPRA' && doc.total >= 700) {
      const codigo = detectarCodigoDetraccion(doc);
      if (codigo) {
        const exists = await findDetraccionByDocId(doc.id);
        if (!exists) {
          const pct = obtenerPorcentajeDetraccion(codigo);
          await createDetraccion({
            id: `DET-${doc.id}`,
            companyId,
            documentId: doc.id,
            provider: doc.issuerName,
            provRuc: doc.issuerRuc,
            amount: doc.total * (pct / 100),
            pct,
            code: codigo,
            account: '00-010-348912',
            status: 'PENDIENTE'
          });
          detrCreated++;
        }
      }
    }
  }
  
  return ok({
    cxcCreated,
    cxpCreated,
    detrCreated,
    message: `Sincronización completada: ${cxcCreated} CXC, ${cxpCreated} CXP, ${detrCreated} detracciones`
  });
}
```

---

## 📝 Conclusión

Los módulos financieros **están implementados** pero **no están conectados** con el flujo de descarga de SUNAT. Necesitas:

1. ✅ **Agregar lógica de creación automática** de CXC/CXP/Detracciones
2. ✅ **Crear importador de extractos bancarios**
3. ✅ **Implementar matching automático** para conciliación

¿Quieres que implemente alguna de estas funcionalidades?
