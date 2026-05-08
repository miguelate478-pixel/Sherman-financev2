# Análisis: ¿Son Suficientes los Datos de SUNAT?

## 📊 Datos Disponibles en Descargas SUNAT

Cuando descargas facturas de SUNAT (COMPRAS y VENTAS), obtienes:

### Tabla `documents`
```typescript
{
  id: string,                    // ✅ Único identificador
  companyId: string,             // ✅ Tu empresa
  operation: 'COMPRA' | 'VENTA', // ✅ Tipo de operación
  docType: string,               // ✅ 01=Factura, 03=Boleta, 07=NC, 08=ND
  serie: string,                 // ✅ Serie del comprobante
  number: string,                // ✅ Número del comprobante
  
  // EMISOR (quien emite la factura)
  issuerRuc: string,             // ✅ RUC del emisor
  issuerName: string,            // ✅ Razón social del emisor
  
  // RECEPTOR (quien recibe la factura)
  receiverRuc: string,           // ✅ RUC del receptor
  receiverName: string,          // ✅ Razón social del receptor
  
  // FECHAS
  issueDate: string,             // ✅ Fecha de emisión
  dueDate: string,               // ⚠️ Fecha de vencimiento (puede ser null)
  
  // MONTOS
  currency: 'PEN' | 'USD',       // ✅ Moneda
  base: number,                  // ✅ Base imponible
  igv: number,                   // ✅ IGV
  total: number,                 // ✅ Total
  
  // DETRACCIÓN
  hasDetraction: boolean,        // ✅ ¿Tiene detracción?
  detractionPct: number,         // ✅ Porcentaje (4%, 10%, 12%)
  detractionAmt: number,         // ✅ Monto de detracción
  
  // ESTADOS
  sunatStatus: string,           // ✅ Estado SUNAT
  cdrStatus: string,             // ✅ Estado CDR
  workflow: string,              // ✅ Estado workflow
  concarStatus: string,          // ✅ Estado CONCAR
  
  // ARCHIVOS
  hasXml: boolean,               // ✅ ¿Tiene XML?
  hasPdf: boolean,               // ✅ ¿Tiene PDF?
  hasCdr: boolean,               // ✅ ¿Tiene CDR?
  
  period: string                 // ✅ Período (2025-01)
}
```

---

## ✅ MÓDULO 1: CUENTAS POR COBRAR (CXC)

### ¿Qué necesitas?
```typescript
{
  documentId: string,      // ← documents.id
  clientRuc: string,       // ← documents.receiverRuc (en VENTAS)
  clientName: string,      // ← documents.receiverName (en VENTAS)
  amount: number,          // ← documents.total
  dueDate: string,         // ← documents.dueDate (o calcular)
  status: 'PENDIENTE'      // ← Inicial
}
```

### ✅ RESPUESTA: **SÍ, es suficiente**

**Datos disponibles:**
- ✅ `documentId` → Ya tienes el ID del documento
- ✅ `clientRuc` → En VENTAS, el receptor es tu cliente
- ✅ `clientName` → Nombre del cliente
- ✅ `amount` → Total de la factura
- ⚠️ `dueDate` → **PROBLEMA**: Puede venir null desde SUNAT

**Solución para dueDate:**
```typescript
// Si dueDate viene null, calcular según condiciones de pago estándar
const dueDate = doc.dueDate || calcularVencimiento(doc.issueDate, 30); // 30 días por defecto
```

**Lógica:**
```typescript
// Solo crear CXC para VENTAS con facturas (01)
if (doc.operation === 'VENTA' && doc.docType === '01') {
  await createCxcRecord({
    id: `CXC-${doc.id}`,
    companyId: doc.companyId,
    documentId: doc.id,
    clientRuc: doc.receiverRuc,      // ← El receptor es tu cliente
    clientName: doc.receiverName,
    amount: doc.total,
    dueDate: doc.dueDate || addDays(doc.issueDate, 30),
    status: 'PENDIENTE'
  });
}
```

---

## ✅ MÓDULO 2: CUENTAS POR PAGAR (CXP)

### ¿Qué necesitas?
```typescript
{
  documentId: string,       // ← documents.id
  providerRuc: string,      // ← documents.issuerRuc (en COMPRAS)
  providerName: string,     // ← documents.issuerName (en COMPRAS)
  amount: number,           // ← documents.total
  dueDate: string,          // ← documents.dueDate (o calcular)
  status: 'PENDIENTE'       // ← Inicial
}
```

### ✅ RESPUESTA: **SÍ, es suficiente**

**Datos disponibles:**
- ✅ `documentId` → Ya tienes el ID del documento
- ✅ `providerRuc` → En COMPRAS, el emisor es tu proveedor
- ✅ `providerName` → Nombre del proveedor
- ✅ `amount` → Total de la factura
- ⚠️ `dueDate` → **PROBLEMA**: Puede venir null desde SUNAT

**Lógica:**
```typescript
// Solo crear CXP para COMPRAS con facturas (01)
if (doc.operation === 'COMPRA' && doc.docType === '01') {
  await createCxpRecord({
    id: `CXP-${doc.id}`,
    companyId: doc.companyId,
    documentId: doc.id,
    providerRuc: doc.issuerRuc,      // ← El emisor es tu proveedor
    providerName: doc.issuerName,
    amount: doc.total,
    dueDate: doc.dueDate || addDays(doc.issueDate, 30),
    status: 'PENDIENTE'
  });
}
```

---

## ✅ MÓDULO 3: DETRACCIONES

### ¿Qué necesitas?
```typescript
{
  documentId: string,       // ← documents.id
  provider: string,         // ← documents.issuerName
  provRuc: string,          // ← documents.issuerRuc
  amount: number,           // ← documents.detractionAmt
  pct: number,              // ← documents.detractionPct
  code: string,             // ⚠️ Código de bien/servicio SUNAT
  account: string,          // ⚠️ Cuenta bancaria de detracciones
  status: 'PENDIENTE'       // ← Inicial
}
```

### ⚠️ RESPUESTA: **CASI suficiente, faltan 2 datos**

**Datos disponibles:**
- ✅ `documentId` → Ya tienes el ID
- ✅ `provider` → Nombre del proveedor
- ✅ `provRuc` → RUC del proveedor
- ✅ `amount` → Monto de detracción (ya calculado)
- ✅ `pct` → Porcentaje de detracción
- ❌ `code` → **FALTA**: Código de bien/servicio SUNAT (001-040)
- ❌ `account` → **FALTA**: Cuenta bancaria de detracciones

**Solución:**

1. **Código de bien/servicio**: Puedes inferirlo o pedirlo al usuario
```typescript
// Códigos comunes de detracción SUNAT
const CODIGOS_DETRACCION = {
  '001': 'Azúcar',
  '003': 'Alcohol etílico',
  '004': 'Recursos hidrobiológicos',
  '005': 'Maíz amarillo duro',
  '007': 'Caña de azúcar',
  '010': 'Algodón',
  '012': 'Intermediación laboral',
  '019': 'Arrendamiento de bienes',
  '020': 'Mantenimiento y reparación',
  '021': 'Movimiento de carga',
  '022': 'Otros servicios empresariales',
  '024': 'Transporte de bienes por vía terrestre',
  '025': 'Transporte público de pasajeros',
  '027': 'Seguros',
  '030': 'Contratos de construcción',
  '031': 'Demás servicios gravados con el IGV',
  '037': 'Demás bienes gravados con el IGV'
};

// Inferir código según descripción o monto
function detectarCodigoDetraccion(doc: Document): string {
  // Si es servicio y monto > 700 → código 031 (servicios generales)
  if (doc.total >= 700) {
    return '031'; // Demás servicios gravados con el IGV
  }
  return '037'; // Demás bienes gravados con el IGV (por defecto)
}
```

2. **Cuenta bancaria**: Configurar por empresa
```typescript
// Agregar campo en tabla companies
ALTER TABLE companies ADD COLUMN "detractionAccount" TEXT DEFAULT '00-010-348912';

// O usar cuenta fija
const CUENTA_DETRACCIONES = '00-010-348912'; // Banco de la Nación
```

**Lógica:**
```typescript
// Solo crear detracción si hasDetraction = true
if (doc.operation === 'COMPRA' && doc.hasDetraction && doc.detractionAmt > 0) {
  await createDetraccion({
    id: `DET-${doc.id}`,
    companyId: doc.companyId,
    documentId: doc.id,
    provider: doc.issuerName,
    provRuc: doc.issuerRuc,
    amount: doc.detractionAmt,
    pct: doc.detractionPct,
    code: detectarCodigoDetraccion(doc), // ← Inferir o configurar
    account: company.detractionAccount || '00-010-348912', // ← Configurar
    status: 'PENDIENTE'
  });
}
```

---

## ❌ MÓDULO 4: BANCOS (Movimientos Bancarios)

### ¿Qué necesitas?
```typescript
{
  companyId: string,
  date: string,              // Fecha del movimiento
  description: string,       // Descripción del banco
  type: 'INGRESO' | 'EGRESO',
  amount: number,
  balance: number,           // Saldo después del movimiento
  reconciled: false
}
```

### ❌ RESPUESTA: **NO, no es suficiente**

**Problema:** SUNAT **NO proporciona** movimientos bancarios. Solo proporciona facturas.

**Solución:** Necesitas **importar extractos bancarios** desde:
1. **CSV del banco** (BCP, BBVA, Interbank, etc.)
2. **API bancaria** (si el banco lo permite)
3. **Scraping bancario** (última opción)

**Formato típico de extracto bancario:**
```csv
Fecha,Descripción,Cargo,Abono,Saldo
2025-01-15,"TRANSFERENCIA RECIBIDA - CLIENTE ABC",0.00,5000.00,25000.00
2025-01-16,"PAGO PROVEEDOR XYZ",3000.00,0.00,22000.00
2025-01-17,"DETRACCION DEPOSITADA",500.00,0.00,21500.00
```

---

## ❌ MÓDULO 5: CONCILIACIÓN BANCARIA

### ¿Qué necesitas?
- ✅ Documentos (facturas) → Ya los tienes
- ❌ Movimientos bancarios → **NO los tienes**

**Conclusión:** No puedes hacer conciliación automática sin movimientos bancarios.

---

## 📋 RESUMEN: ¿Es Suficiente?

| Módulo | ¿Suficiente? | Datos Faltantes | Solución |
|--------|--------------|-----------------|----------|
| **CXC** | ✅ **SÍ** | `dueDate` (a veces null) | Calcular 30 días por defecto |
| **CXP** | ✅ **SÍ** | `dueDate` (a veces null) | Calcular 30 días por defecto |
| **Detracciones** | ⚠️ **CASI** | `code` (código SUNAT)<br/>`account` (cuenta banco) | Inferir código<br/>Configurar cuenta |
| **Bancos** | ❌ **NO** | Movimientos bancarios completos | Importar CSV del banco |
| **Conciliación** | ❌ **NO** | Movimientos bancarios | Importar CSV del banco |

---

## 🎯 Plan de Implementación

### FASE 1: Automatizar CXC, CXP, Detracciones (1-2 días)
✅ **Puedes hacerlo YA** con los datos de SUNAT

```typescript
// En bulk-download/route.ts, después de createDocument()
await syncFinancialRecords(doc, companyId);
```

### FASE 2: Importador de Extractos Bancarios (3-5 días)
❌ **Necesitas implementar** importador de CSV

```typescript
// Nuevo endpoint: /api/banks/import
POST /api/banks/import
{
  companyId: string,
  bankName: 'BCP' | 'BBVA' | 'INTERBANK',
  file: File (CSV)
}
```

### FASE 3: Conciliación Automática (1 semana)
❌ **Requiere** movimientos bancarios + algoritmo de matching

```typescript
// Matching por monto y fecha
function autoMatch(bankMov, documents) {
  // Buscar documento con monto similar (+/- 1%) y fecha cercana (+/- 3 días)
}
```

---

## ✅ Recomendación Final

**SÍ, puedes empezar YA con:**
1. ✅ Cuentas por Cobrar (CXC)
2. ✅ Cuentas por Pagar (CXP)
3. ✅ Detracciones (con código inferido)

**Necesitas implementar después:**
4. ❌ Importador de extractos bancarios
5. ❌ Conciliación automática

**Prioridad:**
1. **HOY**: Implementar sincronización automática CXC/CXP/Detracciones
2. **Esta semana**: Importador de CSV bancario
3. **Próxima semana**: Matching automático para conciliación

¿Empezamos con la implementación de CXC/CXP/Detracciones?
