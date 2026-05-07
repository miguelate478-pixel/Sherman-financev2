# ✅ CHECKLIST DE DEPLOYMENT - SCRAPER SUNAT

## 🎯 OBJETIVO
Que el scraping de XMLs funcione 100% en Railway sin errores.

---

## 📋 CAMBIOS REALIZADOS

### ✅ 1. Dockerfile completo
- ✅ Instala Chromium del sistema (`/usr/bin/chromium`)
- ✅ Instala TODAS las dependencias (libnss3, libgbm1, etc.)
- ✅ Instala deps de Node ANTES del build
- ✅ Hace build de Next.js correctamente
- ✅ Limpia devDependencies después del build
- ✅ Configura variables de entorno correctas

### ✅ 2. Scraper inteligente
- ✅ Busca Chromium en orden de prioridad
- ✅ Usa CHROMIUM_PATH si existe (desarrollo local)
- ✅ Busca en rutas del sistema (Railway)
- ✅ Fallback a @sparticuz/chromium si es necesario

### ✅ 3. Optimizaciones
- ✅ `.dockerignore` para build más rápido
- ✅ Build local exitoso (sin errores TypeScript)
- ✅ Código probado localmente

---

## 🔍 VERIFICACIÓN EN RAILWAY

### PASO 1: Verificar que Railway use el Dockerfile

**En los logs de BUILD busca:**
```
#1 [internal] load build definition from Dockerfile
```

✅ Si ves esto = Railway está usando el Dockerfile  
❌ Si ves "nixpacks" = Railway NO detectó el Dockerfile

---

### PASO 2: Verificar instalación de Chromium

**En los logs de BUILD busca:**
```
#5 [3/8] RUN apt-get update && apt-get install -y chromium...
```

✅ Si ves esto = Chromium se está instalando  
❌ Si NO lo ves = El Dockerfile tiene un problema

---

### PASO 3: Verificar que el build termine OK

**En los logs de BUILD busca:**
```
#8 [6/8] RUN npm run build
...
✓ Compiled successfully
```

✅ Si ves esto = Build exitoso  
❌ Si ves errores = Hay un problema de compilación

---

### PASO 4: Verificar deployment

**En los logs de DEPLOY busca:**
```
✓ Ready in XXXms
```

✅ Si ves esto = App corriendo  
❌ Si ves errores = Hay un problema de runtime

---

## 🧪 PRUEBA EN PRODUCCIÓN

### 1. Ir a la interfaz de Descarga Masiva

### 2. Configurar:
- **Operación:** Solo Compras
- **Período:** 2025-04
- **Comprobantes:** Todos
- **Archivos:** XML, PDF, CDR
- ✅ **Extraer líneas de detalle (XML)** ← IMPORTANTE
- ✅ **Clasificar con IA** ← OPCIONAL

### 3. Click en "Iniciar descarga masiva"

### 4. Verificar logs en Railway

**✅ LOGS CORRECTOS:**
```
[SCRAPER] Usando CHROMIUM_PATH: /usr/bin/chromium
[SCRAPER] Login en SUNAT...
[SCRAPER] Click en Empresas...
[SCRAPER] Navegación por menú...
[SCRAPER] Formulario llenado...
[SCRAPER] Consultando...
[SCRAPER] Modal con factura abierto
[SCRAPER] FC03-3964588: XML 1234 bytes
[BULK] FC03-3964588-2025-04: 5/5 líneas guardadas ✓
```

**❌ LOGS CON ERROR:**
```
/tmp/chromium: error while loading shared libraries: libnss3.so
```
→ Si ves esto, el Dockerfile NO se aplicó correctamente

---

## 🚨 SI ALGO FALLA

### Error: "libnss3.so: cannot open shared object file"
**Causa:** Dockerfile no se aplicó  
**Solución:** 
1. Verificar que el archivo `Dockerfile` existe en la raíz del repo
2. En Railway, ir a Settings → Redeploy
3. Verificar logs de BUILD

### Error: "Browser was not found at executablePath"
**Causa:** Chromium no se instaló  
**Solución:**
1. Verificar logs de BUILD
2. Buscar errores en `apt-get install`
3. Verificar que el Dockerfile tenga la línea `RUN apt-get update && apt-get install -y chromium`

### Error: "Failed to launch browser"
**Causa:** Faltan dependencias  
**Solución:**
1. Verificar que TODAS las librerías estén en el Dockerfile
2. Agregar cualquier librería faltante que aparezca en el error

---

## 📊 RESULTADO ESPERADO

Después de este deployment:

| Funcionalidad | Estado |
|---------------|--------|
| Descarga SIRE (VENTAS) | ✅ Ya funcionaba |
| Descarga CPE API | ✅ Ya funcionaba |
| **Scraping (COMPRAS)** | ✅ **DEBE FUNCIONAR AHORA** |
| Extracción de líneas | ✅ Debe funcionar |
| Clasificación con IA | ✅ Debe funcionar |

---

## 🎯 COMMITS FINALES

1. `3750021` - fix: usar @sparticuz/chromium (falló)
2. `682af76` - fix: agregar Dockerfile (falló por deps)
3. `0851b13` - fix: Dockerfile corregido + dockerignore ✅ **ESTE DEBE FUNCIONAR**

---

## ⏱️ TIEMPO ESTIMADO

- **Build en Railway:** 3-5 minutos
- **Deployment:** 1-2 minutos
- **Primera prueba de scraping:** 25-30 segundos por documento

---

## 📞 SI NECESITAS AYUDA

Si después de este deployment TODAVÍA hay errores:

1. **Copia los logs COMPLETOS de BUILD** (desde el inicio hasta el final)
2. **Copia los logs de RUNTIME** (cuando haces la prueba)
3. **Toma screenshot del error** en la interfaz
4. Envíame todo eso para diagnosticar

---

**Fecha:** 2026-05-07  
**Commit:** `0851b13`  
**Status:** ✅ Listo para deployment  
**Confianza:** 95% - Dockerfile completo y probado localmente
