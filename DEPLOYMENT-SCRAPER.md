# 🚀 DEPLOYMENT: SCRAPER SUNAT EN RAILWAY

## 📋 CHECKLIST DE DEPLOYMENT

### ✅ PASO 1: Verificar código local

```bash
# Verificar que los archivos existen
ls -la src/lib/providers/sunat-scraper.ts
ls -la src/app/api/sunat/bulk-download/route.ts

# Verificar que puppeteer-core está instalado
npm list puppeteer-core
```

### ✅ PASO 2: Configurar Chromium en Railway

**Opción A: Usando nixpacks.toml** (Recomendado)

Crear o editar `nixpacks.toml` en la raíz del proyecto:

```toml
[phases.setup]
aptPkgs = ["chromium-browser", "chromium-chromedriver"]

[phases.build]
cmds = ["npm install", "npm run build"]

[start]
cmd = "npm run start"
```

**Opción B: Usando Dockerfile**

Crear `Dockerfile` en la raíz:

```dockerfile
FROM node:22-slim

# Instalar Chromium y dependencias
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV CHROMIUM_PATH=/usr/bin/chromium

EXPOSE 3000

CMD ["npm", "start"]
```

**Opción C: Usando Buildpacks** (Más simple)

En Railway Dashboard:
1. Ve a tu proyecto
2. Settings → Build
3. Agregar buildpack:
   ```
   https://github.com/heroku/heroku-buildpack-google-chrome
   ```

### ✅ PASO 3: Configurar variables de entorno en Railway

En Railway Dashboard → Variables:

```bash
# Ruta de Chromium (según tu método de instalación)
CHROMIUM_PATH=/usr/bin/chromium-browser

# O si usas el buildpack de Heroku:
CHROMIUM_PATH=/app/.apt/usr/bin/google-chrome-stable

# Otras variables existentes (mantener)
SUNAT_PROVIDER=direct
DATABASE_URL=postgresql://...
# etc.
```

### ✅ PASO 4: Commit y push

```bash
git add .
git commit -m "feat: integrar scraper SUNAT headless para descarga de XML

- Agregar sunat-scraper.ts con automatización Puppeteer
- Integrar scraper como fallback en bulk-download
- Agregar soporte para extraer líneas de COMPRAS
- Configurar Chromium para Railway"

git push origin main
```

### ✅ PASO 5: Verificar deployment en Railway

1. **Ver logs de build:**
   ```
   Railway Dashboard → Deployments → Ver logs
   ```

2. **Buscar en logs:**
   ```
   ✓ Installing chromium-browser
   ✓ npm run build
   ✓ Build completed
   ```

3. **Verificar que Chromium está instalado:**
   En Railway Shell (si está disponible):
   ```bash
   which chromium-browser
   # Debe mostrar: /usr/bin/chromium-browser
   
   chromium-browser --version
   # Debe mostrar: Chromium 120.x.x
   ```

### ✅ PASO 6: Probar en producción

1. **Login en Sherman Finance**
2. **Ir a Descarga Masiva**
3. **Configurar:**
   - Período: Enero 2025
   - Operación: COMPRAS
   - ✅ Activar "Extraer líneas del XML"
4. **Iniciar descarga**
5. **Ver logs en Railway:**
   ```
   [BULK] includeDetails para F001-123...
   [BULK] Intentando scraping para F001-123...
   [SCRAPER] Iniciando descarga XML para F001-123
   [SCRAPER] Login en SUNAT...
   [SCRAPER] ✅ XML descargado exitosamente (15234 bytes)
   [BULK] XML scrapeado para F001-123: 15234 bytes
   [BULK] F001-123: 5/5 líneas guardadas
   ```

## 🐛 TROUBLESHOOTING

### Error: "Chromium not found"

**Síntoma:**
```
Error: Failed to launch the browser process!
/usr/bin/chromium-browser: not found
```

**Solución:**
1. Verificar que `nixpacks.toml` tiene `chromium-browser` en `aptPkgs`
2. Verificar que `CHROMIUM_PATH` apunta a la ruta correcta
3. Rebuild en Railway

### Error: "libgobject-2.0.so.0: cannot open shared object file"

**Síntoma:**
```
Error while loading shared libraries: libgobject-2.0.so.0
```

**Solución:**
Agregar más dependencias en `nixpacks.toml`:
```toml
[phases.setup]
aptPkgs = [
  "chromium-browser",
  "chromium-chromedriver",
  "libglib2.0-0",
  "libnss3",
  "libatk1.0-0",
  "libatk-bridge2.0-0",
  "libcups2",
  "libdrm2",
  "libxkbcommon0",
  "libxcomposite1",
  "libxdamage1",
  "libxfixes3",
  "libxrandr2",
  "libgbm1",
  "libasound2"
]
```

### Error: "Timeout esperando modal"

**Síntoma:**
```
[SCRAPER] Error: Timeout esperando modal con factura
```

**Solución:**
1. Verificar que la factura existe en SUNAT
2. Verificar credenciales SOL
3. Aumentar timeout en `sunat-scraper.ts`:
   ```typescript
   await targetFrame.waitForSelector('ngb-modal-window', {
     timeout: 15000, // Aumentar de 10000 a 15000
   });
   ```

### Error: "Login falló"

**Síntoma:**
```
[SCRAPER] Error: Login falló - no se cargó el menú
```

**Solución:**
1. Verificar credenciales en la configuración de la empresa
2. Verificar que el RUC, usuario y contraseña son correctos
3. Probar login manual en https://e-menu.sunat.gob.pe

### Scraping muy lento

**Síntoma:**
Cada documento tarda más de 40 segundos

**Solución:**
1. Verificar conexión a internet del servidor Railway
2. Reducir timeouts innecesarios en `sunat-scraper.ts`
3. Considerar usar CPE API en lugar de scraping (más rápido)

## 📊 MONITOREO

### Métricas a vigilar:

1. **Tiempo promedio de scraping:**
   - Normal: 25-30 segundos
   - Alerta: > 40 segundos

2. **Tasa de éxito:**
   - Normal: > 90%
   - Alerta: < 80%

3. **Uso de memoria:**
   - Normal: +200MB por instancia de Chromium
   - Alerta: > 500MB

4. **Logs de error:**
   - Buscar: `[SCRAPER] Error:`
   - Buscar: `Chromium not found`
   - Buscar: `Timeout`

## 🔧 OPTIMIZACIONES FUTURAS

### 1. Pool de navegadores
En lugar de abrir/cerrar Chromium por cada documento, mantener un pool:

```typescript
class BrowserPool {
  private browsers: Browser[] = [];
  
  async getBrowser() {
    if (this.browsers.length === 0) {
      return await puppeteer.launch({...});
    }
    return this.browsers.pop();
  }
  
  async releaseBrowser(browser: Browser) {
    this.browsers.push(browser);
  }
}
```

### 2. Paralelización
Descargar múltiples XMLs en paralelo (con límite):

```typescript
const CONCURRENT_SCRAPERS = 3;
const queue = [...documentos];
const results = [];

while (queue.length > 0) {
  const batch = queue.splice(0, CONCURRENT_SCRAPERS);
  const batchResults = await Promise.all(
    batch.map(doc => downloadXmlFromSunat(creds, doc))
  );
  results.push(...batchResults);
}
```

### 3. Cache de sesión
Reutilizar la sesión de login para múltiples descargas:

```typescript
// Guardar cookies después del login
const cookies = await page.cookies();
await fs.writeFile('session.json', JSON.stringify(cookies));

// Reutilizar en siguiente descarga
const cookies = JSON.parse(await fs.readFile('session.json'));
await page.setCookie(...cookies);
```

## ✅ CHECKLIST FINAL

- [ ] Código commiteado y pusheado
- [ ] `nixpacks.toml` o `Dockerfile` configurado
- [ ] Variable `CHROMIUM_PATH` configurada en Railway
- [ ] Build exitoso en Railway
- [ ] Chromium instalado (verificar en logs)
- [ ] Prueba de descarga masiva con "Extraer líneas"
- [ ] Logs muestran `[SCRAPER]` funcionando
- [ ] XMLs parseados y líneas guardadas en BD
- [ ] Documentación actualizada

## 📞 SOPORTE

Si tienes problemas:
1. Revisar logs de Railway
2. Buscar errores específicos en esta guía
3. Verificar que Chromium está instalado: `which chromium-browser`
4. Probar localmente primero: `node test-scraper.mjs`
