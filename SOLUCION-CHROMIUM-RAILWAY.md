# ✅ SOLUCIÓN: Chromium en Railway

## 🔴 PROBLEMA ORIGINAL

```
/tmp/chromium: error while loading shared libraries: libnss3.so: cannot open shared object file: No such file or directory
```

**Causa raíz:** 
- `@sparticuz/chromium` descargaba el binario de Chromium a `/tmp/chromium`
- Pero **faltaban las librerías del sistema** (libnss3, libgbm, etc.)
- Railway **NO instalaba** los paquetes `apt` del `nixpacks.toml`

## ✅ SOLUCIÓN IMPLEMENTADA

### 1. **Dockerfile personalizado**

Creamos un `Dockerfile` que Railway SÍ respeta y que:
- ✅ Instala Chromium del sistema (`/usr/bin/chromium`)
- ✅ Instala TODAS las dependencias necesarias (libnss3, libgbm, etc.)
- ✅ Configura variables de entorno correctas
- ✅ Ejecuta el build y deployment

```dockerfile
FROM node:22-slim

# Instalar Chromium + dependencias
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-liberation \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libxshmfence1 \
    libglib2.0-0 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Variables de entorno
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

### 2. **Scraper inteligente con fallbacks**

Actualizamos `src/lib/providers/sunat-scraper.ts` para buscar Chromium en este orden:

1. **`CHROMIUM_PATH`** (desarrollo local o configurado)
2. **Chromium del sistema** (`/usr/bin/chromium`, `/usr/bin/chromium-browser`, etc.)
3. **`@sparticuz/chromium`** (último recurso para serverless)

```typescript
let chromiumPath: string;

if (process.env.CHROMIUM_PATH) {
  chromiumPath = process.env.CHROMIUM_PATH;
} else {
  // Buscar en rutas del sistema
  const systemPaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];
  
  const foundPath = systemPaths.find(p => fs.existsSync(p));
  
  if (foundPath) {
    chromiumPath = foundPath;
  } else {
    // Último recurso
    chromiumPath = await chromium.executablePath();
  }
}
```

## 📊 VENTAJAS DE ESTA SOLUCIÓN

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Chromium** | ❌ No se instalaba | ✅ Instalado en `/usr/bin/chromium` |
| **Dependencias** | ❌ Faltaban librerías | ✅ Todas instaladas |
| **Configuración** | ❌ `nixpacks.toml` ignorado | ✅ `Dockerfile` respetado |
| **Desarrollo local** | ✅ Funcionaba | ✅ Sigue funcionando |
| **Railway** | ❌ Fallaba | ✅ Debería funcionar |

## 🚀 PRÓXIMOS PASOS

1. **Esperar deployment de Railway** (3-5 minutos)
   - Railway detectará el `Dockerfile` automáticamente
   - Construirá la imagen con Chromium instalado

2. **Verificar logs de BUILD**
   - Buscar: `Installing chromium` o `apt-get install`
   - Confirmar que las dependencias se instalaron

3. **Probar en producción**
   - Hacer una descarga masiva con `includeDetails=true`
   - Verificar que el scraping funcione sin errores

4. **Verificar logs de RUNTIME**
   - Buscar: `[SCRAPER] Chromium del sistema encontrado: /usr/bin/chromium`
   - Confirmar que NO aparezca el error de `libnss3.so`

## 🔍 CÓMO VERIFICAR QUE FUNCIONA

### En los logs de Railway deberías ver:

```
[SCRAPER] Chromium del sistema encontrado: /usr/bin/chromium
[SCRAPER] Login en SUNAT...
[SCRAPER] Click en Empresas...
[SCRAPER] Navegación por menú...
[SCRAPER] Formulario llenado...
[SCRAPER] XML descargado: 1234 bytes
[BULK] FC03-3964588-2025-04: 5/5 líneas guardadas ✓
```

### ❌ Si ves este error, el Dockerfile NO se aplicó:

```
/tmp/chromium: error while loading shared libraries: libnss3.so
```

## 📝 ARCHIVOS MODIFICADOS

1. **`Dockerfile`** (nuevo) - Instala Chromium y dependencias
2. **`src/lib/providers/sunat-scraper.ts`** - Búsqueda inteligente de Chromium

## 🎯 COMMITS

1. `3750021` - fix: usar @sparticuz/chromium (❌ falló por falta de librerías)
2. `682af76` - fix: agregar Dockerfile con dependencias Chromium (✅ solución correcta)

---

## 💡 POR QUÉ ESTA SOLUCIÓN ES MEJOR

- **Dockerfile > nixpacks.toml**: Railway siempre respeta Dockerfile
- **Chromium del sistema > @sparticuz/chromium**: Más estable, menos problemas
- **Fallbacks múltiples**: Si falla una ruta, prueba otra
- **Compatible con desarrollo local**: Sigue usando tu Chrome instalado

---

**Fecha:** 2026-05-07  
**Status:** ✅ Desplegado - Esperando verificación en producción
