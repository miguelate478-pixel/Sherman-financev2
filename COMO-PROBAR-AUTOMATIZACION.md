# 🎯 CÓMO PROBAR LA AUTOMATIZACIÓN DE DESCARGA

## ✅ ESTADO ACTUAL

**Código desplegado:** Commit `a5d0387`  
**Solución:** @sparticuz/chromium (sin Dockerfile)  
**Status:** Esperando que Railway termine el deployment (3-5 minutos)

---

## 📋 PASOS PARA PROBAR

### OPCIÓN 1: Botón "Descargar XMLs via Portal SUNAT" (MORADO)

Este botón usa **browser automation** para descargar XMLs directamente del portal SUNAT.

**Pasos:**

1. Ve a: https://sherman-financev2-production.up.railway.app/dashboard
2. Selecciona empresa: **SHERMAN INMOBILIARIA S.A.C.**
3. Configura período: **2025-04**
4. Click en el botón **MORADO**: "🌐 Descargar XMLs via Portal SUNAT"
5. Espera 30-40 segundos (primera vez descarga Chromium)

**Logs esperados:**
```
🌐 Iniciando browser automation (portal e-factura SUNAT)...
⏳ Esto puede tardar 2-3 minutos mientras Chromium navega el portal...
[BROWSER] Cargando @sparticuz/chromium para Railway...
[BROWSER] Chromium de @sparticuz: /tmp/chromium
[BROWSER] Login en SUNAT...
[BROWSER] Navegando menú...
[BROWSER] XMLs obtenidos del portal: 5
✅ 5 docs parseados con líneas via portal SUNAT
```

---

### OPCIÓN 2: Botón "Iniciar descarga masiva" (AZUL) con scraping como fallback

Este botón intenta 3 métodos en orden:
1. SIRE API (rápido, solo VENTAS)
2. CPE API (requiere clientId/Secret)
3. **Scraping** (fallback para COMPRAS sin XML)

**Pasos:**

1. Ve a: https://sherman-financev2-production.up.railway.app/dashboard
2. Selecciona empresa: **SHERMAN INMOBILIARIA S.A.C.**
3. Configura:
   - **Operación:** Solo Compras
   - **Período:** 2025-04
   - **Comprobantes:** Todos (Facturas, Boletas, N.Crédito, N.Débito)
   - **Archivos:** XML, PDF, CDR
   - ✅ **Extraer líneas de detalle (XML)** ← IMPORTANTE
   - ✅ **Clasificar con IA** (opcional)
4. Click en **"Iniciar descarga masiva"**
5. Espera 1-2 minutos

**Logs esperados:**
```
[BULK] Estado credenciales — clientId: true | clientSecret: true
[SIRE] Token obtenido OK
[SIRE] Total comprobantes: 14
[BULK] FC03-3964588-2025-04: doc existente, procesando líneas
[CPE] Descargando XML: ...
[CPE] HTTP 404 para FC03-3964588 xml
[BULK] Intentando scraping para FC03-3964588-2025-04...
[SCRAPER] Usando @sparticuz/chromium: /tmp/chromium
[SCRAPER] Login en SUNAT...
[SCRAPER] FC03-3964588: XML 1234 bytes
[BULK] FC03-3964588-2025-04: 5/5 líneas guardadas ✓
```

---

## 🔍 VERIFICAR EN RAILWAY

### Ver logs en tiempo real:

1. Ve a: https://railway.app
2. Selecciona tu proyecto
3. Click en el servicio (deployment)
4. Click en "View Logs"
5. Busca líneas que contengan `[SCRAPER]` o `[BROWSER]`

---

## ✅ SEÑALES DE ÉXITO

### ✅ La automatización FUNCIONA si ves:

```
[SCRAPER] Usando @sparticuz/chromium: /tmp/chromium
[SCRAPER] Login en SUNAT...
[SCRAPER] Click en Empresas...
[SCRAPER] Navegación por menú...
[SCRAPER] Formulario llenado...
[SCRAPER] Consultando...
[SCRAPER] Modal con factura abierto
[SCRAPER] FC03-3964588: XML 1234 bytes
[BULK] FC03-3964588-2025-04: 5/5 líneas guardadas ✓
```

### ❌ La automatización FALLA si ves:

```
❌ Error browser: Chromium no encontrado
❌ Failed to launch the browser process
❌ /tmp/chromium: error while loading shared libraries
```

---

## ⏱️ TIEMPOS ESPERADOS

| Acción | Tiempo |
|--------|--------|
| Deployment en Railway | 3-5 minutos |
| Primera descarga (descarga Chromium) | 30-40 segundos |
| Descargas siguientes | 25-30 segundos por documento |
| Descarga masiva (14 docs) | 6-8 minutos |

---

## 🎯 QUÉ HACE LA AUTOMATIZACIÓN

### Flujo completo:

1. **Login automático** en e-menu.sunat.gob.pe
2. **Click en "Empresas"** (data-id="2")
3. **Navegación por menú** (4 clicks):
   - Comprobantes de pago
   - Comprobantes de Pago (nivel 2)
   - Consulta de Comprobantes de Pago
   - Nueva Consulta
4. **Llenar formulario**:
   - Seleccionar "Recibido"
   - RUC Emisor
   - Tipo: Factura
   - Serie
   - Número
5. **Consultar**
6. **Esperar modal** con resultado
7. **Click en botón XML** (segundo botón verde)
8. **Interceptar descarga** del XML
9. **Parsear XML** y extraer líneas
10. **Guardar en BD** con clasificación IA (opcional)

---

## 📊 RESULTADO ESPERADO

Después de la automatización:

| Antes | Después |
|-------|---------|
| ❌ Sin XMLs de compras | ✅ XMLs descargados |
| ❌ Sin líneas de detalle | ✅ Líneas extraídas |
| ❌ Sin clasificación | ✅ Clasificado con IA |
| ❌ Proceso manual | ✅ 100% automático |

---

## 🚨 SI ALGO FALLA

### 1. Verificar que Railway terminó el deployment

- Ve a Railway Dashboard
- Verifica que el deployment esté "Active"
- Verifica que no haya errores en Build Logs

### 2. Verificar que la app esté UP

- Abre: https://sherman-financev2-production.up.railway.app
- Debería cargar el login
- Si ves "Application failed to respond" → Railway aún está desplegando

### 3. Verificar logs de Runtime

- En Railway, ve a "View Logs"
- Busca `[SCRAPER]` o `[BROWSER]`
- Si no aparecen → El scraping no se está ejecutando
- Si aparecen con errores → Copia el error completo

---

## 💡 TIPS

1. **Primera ejecución es más lenta** (descarga Chromium)
2. **Ejecuciones siguientes son más rápidas** (Chromium ya descargado)
3. **Los logs son tu mejor amigo** - siempre revisa los logs en Railway
4. **Paciencia** - El scraping tarda 25-30 segundos por documento

---

## 📞 SI NECESITAS AYUDA

Si después de 5 minutos la automatización NO funciona:

1. Copia los **logs completos de Runtime** (últimos 100 líneas)
2. Toma **screenshot del error** en la interfaz
3. Verifica que Railway muestre el deployment como **"Active"**
4. Envíame toda esa información

---

**La automatización está lista. Solo falta que Railway termine el deployment y podrás probarla.**

---

**Última actualización:** 2026-05-07  
**Commit actual:** `a5d0387`  
**Solución:** @sparticuz/chromium (simple y probada)
