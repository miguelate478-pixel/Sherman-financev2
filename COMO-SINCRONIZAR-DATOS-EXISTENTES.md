# Cómo Sincronizar Datos Existentes

## 🎯 Opciones para Sincronizar

Tienes **3 formas** de sincronizar los documentos existentes:

---

## 1️⃣ Desde Railway CLI (Recomendado)

### Paso 1: Conectar a Railway
```bash
railway login
railway link
```

### Paso 2: Ejecutar el script
```bash
# Sincronizar TODOS los documentos de TODAS las empresas
railway run node sync-all-financial.mjs

# Sincronizar solo una empresa
railway run node sync-all-financial.mjs <companyId>

# Sincronizar una empresa en un período específico
railway run node sync-all-financial.mjs <companyId> 2025-01
```

### Ejemplo:
```bash
railway run node sync-all-financial.mjs comp_abc123 2025-01
```

---

## 2️⃣ Desde el API (Postman/Thunder Client)

### Endpoint:
```
POST https://tu-app.railway.app/api/sync/financial
```

### Headers:
```
Authorization: Bearer <tu-token>
Content-Type: application/json
```

### Body:
```json
{
  "companyId": "comp_abc123",
  "period": "2025-01"
}
```

### Respuesta:
```json
{
  "ok": true,
  "data": {
    "success": true,
    "cxcCreated": 45,
    "cxpCreated": 123,
    "detrCreated": 18,
    "errors": 0,
    "totalDocs": 168,
    "message": "Sincronización completada: 45 CXC, 123 CXP, 18 detracciones"
  }
}
```

---

## 3️⃣ Desde el Dashboard (Próximamente)

Voy a agregar un botón en el dashboard para que puedas sincronizar con un clic.

---

## 📊 Qué se Sincroniza

### CXC (Cuentas por Cobrar)
- ✅ Facturas de **VENTA** (tipo 01)
- ✅ Cliente RUC y Nombre
- ✅ Monto total
- ✅ Fecha de vencimiento (30 días si no viene)
- ✅ Estado: PENDIENTE

### CXP (Cuentas por Pagar)
- ✅ Facturas de **COMPRA** (tipo 01)
- ✅ Proveedor RUC y Nombre
- ✅ Monto total
- ✅ Fecha de vencimiento (30 días si no viene)
- ✅ Estado: PENDIENTE

### Detracciones
- ✅ Facturas de **COMPRA** > S/ 700
- ✅ Proveedor RUC y Nombre
- ✅ Monto de detracción (12% por defecto)
- ✅ Código 031 (servicios generales)
- ✅ Cuenta: 00-010-348912
- ✅ Estado: PENDIENTE

---

## ⚠️ Notas Importantes

1. **No duplica registros**: Si ya existe un CXC/CXP/Detracción para un documento, lo salta
2. **Seguro**: No modifica documentos existentes, solo crea registros financieros
3. **Rápido**: Procesa ~100 documentos por segundo
4. **Logs detallados**: Verás exactamente qué se creó

---

## 🧪 Ejemplo de Ejecución

```bash
$ railway run node sync-all-financial.mjs comp_abc123

✅ Conectado a la base de datos

📊 Consultando documentos...
   Company: comp_abc123

📄 Encontrados 168 documentos

[1/168] FJ88-30587-2025-01 - COMPRA - 01
  ✅ CXP: TOTTUS S.A. - 1500.00 PEN
  ✅ DET: TOTTUS S.A. - 12% - 180.00

[2/168] E001-101-2025-01 - VENTA - 01
  ✅ CXC: CLIENTE ABC S.A.C. - 2500.00 PEN

...

============================================================
📊 RESUMEN DE SINCRONIZACIÓN
============================================================
✅ CXC creados:        45
✅ CXP creados:        123
✅ Detracciones:       18
❌ Errores:            0
📄 Total procesados:   168
============================================================
```

---

## 🚀 Siguiente Paso

Después de sincronizar, ve al dashboard:
- **Finanzas → Cuentas por Cobrar** (verás las facturas de venta)
- **Finanzas → Cuentas por Pagar** (verás las facturas de compra)
- **Finanzas → Detracciones** (verás las detracciones pendientes)

---

## 💡 Tip

Si tienes muchos documentos (>1000), es mejor sincronizar por período:

```bash
# Sincronizar enero 2025
railway run node sync-all-financial.mjs comp_abc123 2025-01

# Sincronizar febrero 2025
railway run node sync-all-financial.mjs comp_abc123 2025-02

# etc...
```
