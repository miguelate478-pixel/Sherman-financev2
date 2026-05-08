# Chromium Args para Railway/Docker

## Cambios Realizados

Se actualizaron los argumentos de Chromium en todos los archivos de scraping para asegurar compatibilidad con Railway y Docker.

## Args Actualizados

```javascript
args: [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-zygote',
  '--single-process',
  '--disable-extensions',
  '--disable-background-networking',
]
```

## Archivos Modificados

1. ✅ **`src/lib/providers/sunat-scraper.ts`**
   - Scraper principal para descarga individual de XMLs
   - Usado por: `/api/sunat/sire`, `/api/sunat/bulk-download`

2. ✅ **`src/lib/providers/sunat-scraping.ts`**
   - Provider de scraping con clase `SunatScrapingProvider`
   - Usado por: `hybrid-xml-provider.ts`

3. ✅ **`src/lib/sunat-browser.ts`**
   - Browser automation para descarga masiva
   - Función: `downloadXmlsViaBrowser()`

## Por Qué Estos Args Son Críticos

### `--no-sandbox`
- **Requerido** en contenedores Docker/Railway
- Sin este flag, Chromium falla silenciosamente
- Permite que Chromium corra sin privilegios de sandbox

### `--disable-setuid-sandbox`
- Complementa `--no-sandbox`
- Evita problemas de permisos en contenedores

### `--disable-dev-shm-usage`
- **Crítico** para Railway/Docker
- `/dev/shm` es limitado en contenedores (64MB por defecto)
- Sin este flag, Chromium se queda sin memoria compartida
- Fuerza uso de `/tmp` en lugar de `/dev/shm`

### `--disable-gpu`
- Desactiva aceleración GPU
- GPU no disponible en contenedores headless

### `--no-zygote`
- Desactiva proceso zygote de Chromium
- Reduce uso de memoria en contenedores

### `--single-process`
- Corre Chromium en un solo proceso
- Reduce uso de memoria y evita problemas de IPC
- **Importante**: Puede ser más lento pero más estable

### `--disable-extensions`
- Desactiva extensiones de Chrome
- Reduce overhead innecesario

### `--disable-background-networking`
- Desactiva conexiones de fondo
- Reduce uso de red y memoria

## Antes vs Después

### ANTES (Fallaba en Railway)
```javascript
args: [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--start-maximized', // ❌ No funciona en headless
]
```

### DESPUÉS (Funciona en Railway)
```javascript
args: [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-zygote',           // ✅ Reduce memoria
  '--single-process',      // ✅ Más estable
  '--disable-extensions',  // ✅ Menos overhead
  '--disable-background-networking', // ✅ Menos red
]
```

## Verificación

Para verificar que funciona en Railway:

```bash
# 1. Build local
npm run build

# 2. Deploy a Railway
git push origin master

# 3. Verificar logs en Railway
# Buscar: "[SCRAPER] Login OK" o "[Scraping] Login exitoso"

# 4. Probar endpoint
curl -X POST https://tu-app.railway.app/api/sunat/download-xml \
  -H "Content-Type: application/json" \
  -d '{
    "rucEmisor": "20508565934",
    "serie": "FJ88",
    "numero": "30587"
  }'
```

## Troubleshooting

### Si sigue fallando en Railway:

1. **Verificar que Chromium esté instalado**
   ```bash
   # En Railway, agregar a Dockerfile o nixpacks.toml:
   chromium
   ```

2. **Verificar memoria disponible**
   ```bash
   # Railway debe tener al menos 512MB RAM
   # Chromium + Node.js necesitan ~400-500MB
   ```

3. **Verificar logs**
   ```bash
   # Buscar errores como:
   # - "Failed to launch browser"
   # - "ENOENT: no such file or directory"
   # - "Cannot find module 'puppeteer'"
   ```

4. **Verificar CHROMIUM_PATH**
   ```bash
   # En Railway, configurar variable de entorno:
   CHROMIUM_PATH=/usr/bin/chromium
   # o
   CHROMIUM_PATH=/usr/bin/chromium-browser
   ```

## Recursos

- [Puppeteer Troubleshooting](https://pptr.dev/troubleshooting)
- [Running Puppeteer in Docker](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-in-docker)
- [Railway Docs - Chromium](https://docs.railway.app/guides/puppeteer)

---

**Fecha**: 2026-05-08  
**Commit**: `b52bc0f` - "fix: actualizar args de Chromium para Railway/Docker compatibility"
