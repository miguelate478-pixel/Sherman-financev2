# ✅ INTEGRACIÓN SCRAPER SUNAT EN SHERMAN FINANCE

## 🎯 OBJETIVO

Integrar la automatización de descarga de XML mediante web scraping como **fallback** cuando las APIs de SUNAT no están disponibles.

## 📋 FLUJO DE DESCARGA DE XML (3 NIVELES)

Cuando el usuario activa "Extraer líneas del XML" en la descarga masiva, el sistema intenta obtener el XML en este orden:

### 1️⃣ **SIRE API** (Primero - Más rápido)
- Descarga masiva de XMLs desde el ZIP de propuesta SIRE
- ✅ Ventaja: Rápido, descarga múltiples XMLs a la vez
- ❌ Limitación: Solo disponible para **VENTAS** (comprobantes emitidos)

### 2️⃣ **CPE API** (Segundo - Requiere Client ID/Secret)
- Descarga individual por documento usando API REST de SUNAT
- ✅ Ventaja: Oficial, confiable, sin scraping
- ❌ Limitación: Requiere `clientId` y `clientSecret` configurados

### 3️⃣ **WEB SCRAPING** (Último recurso - Fallback)
- Automatización con Puppeteer que navega el portal SUNAT
- ✅ Ventaja: Funciona para **COMPRAS** (comprobantes recibidos)
- ✅ Ventaja: No requiere Client ID/Secret, solo credenciales SOL
- ❌ Limitación: Más lento (25-30 segundos por documento)
- ❌ Limitación: Puede fallar si SUNAT cambia su interfaz

## 🔧 ARCHIVOS MODIFICADOS

### 1. `src/lib/providers/sunat-scraper.ts` (NUEVO)
Contiene la función `downloadXmlFromSunat()` que:
- Inicia navegador headless (invisible)
- Hace login en SUNAT
- Navega por el menú de Empresas
- Busca la factura en el formulario
- Intercepta la descarga del XML
- Retorna el contenido XML como string

### 2. `src/app/api/sunat/bulk-download/route.ts` (MODIFICADO)
En la sección de "Extraer líneas del XML", se agregó el paso 3:

```typescript
// 3. Si tampoco hay XML de CPE, intentar scraping como último recurso (solo para COMPRAS)
if (!xmlForLines && op === 'COMPRAS' && cred) {
  try {
    console.log(`[BULK] Intentando scraping para ${docId}...`);
    const { downloadXmlFromSunat } = await import('@/lib/providers/sunat-scraper');
    const scraperResult = await downloadXmlFromSunat(
      {
        ruc: company.ruc as string,
        solUser: cred.solUser as string,
        solPass,
      },
      {
        rucEmisor: doc.rucEmisor,
        serie: doc.serie,
        numero: doc.numero,
        tipoComprobante: doc.tipo,
      }
    );

    if (scraperResult.xmlContent) {
      xmlForLines = scraperResult.xmlContent;
      console.log(`[BULK] XML scrapeado para ${docId}: ${xmlForLines.length} bytes`);
      hasXml = true;
      await updateDocument(docId, { hasXml: true });
    }
  } catch (scraperErr) {
    console.log(`[BULK] Error scraping para ${docId}: ${(scraperErr as Error).message}`);
  }
}
```

## 🚀 CONFIGURACIÓN EN PRODUCCIÓN (RAILWAY)

### 1. Variable de entorno
Agregar en Railway:
```bash
CHROMIUM_PATH=/usr/bin/chromium-browser
```

### 2. Instalar Chromium en el contenedor

**Opción A: nixpacks.toml** (si usas Nixpacks)
```toml
[phases.setup]
aptPkgs = ["chromium-browser"]
```

**Opción B: Dockerfile** (si usas Docker)
```dockerfile
RUN apt-get update && apt-get install -y \
    chromium-browser \
    && rm -rf /var/lib/apt/lists/*
```

**Opción C: Railway Buildpack**
Agregar en Railway settings:
```
heroku/nodejs
https://github.com/heroku/heroku-buildpack-google-chrome
```

## 📊 EJEMPLO DE USO

### Escenario: Descarga Masiva con "Extraer líneas del XML"

```
Usuario: Descarga masiva de COMPRAS de Enero 2025
Sistema: Descarga 50 documentos desde SIRE
Sistema: Intenta extraer líneas de cada documento:

Documento 1 (F001-123):
  ❌ SIRE: Sin XML (compras no incluyen XML en SIRE)
  ❌ CPE API: Sin clientId/clientSecret configurado
  ✅ SCRAPING: XML descargado (28 segundos)
  ✅ Parseado: 5 líneas guardadas

Documento 2 (F001-124):
  ❌ SIRE: Sin XML
  ❌ CPE API: Sin clientId/clientSecret
  ✅ SCRAPING: XML descargado (26 segundos)
  ✅ Parseado: 12 líneas guardadas

...

Resultado: 50 documentos procesados, 45 con líneas extraídas
```

## ⚡ RENDIMIENTO

| Método | Velocidad | Documentos simultáneos | Requiere credenciales extra |
|--------|-----------|------------------------|------------------------------|
| SIRE API | ⚡⚡⚡ Muy rápido (batch) | Múltiples | No |
| CPE API | ⚡⚡ Rápido (individual) | 1 por vez | Sí (clientId/Secret) |
| Scraping | ⚡ Lento (25-30s) | 1 por vez | No |

## 🔐 SEGURIDAD

- ✅ El scraping se ejecuta en **headless mode** (invisible para el usuario)
- ✅ Las credenciales SOL se pasan directamente, no se guardan en archivos
- ✅ El navegador se cierra automáticamente después de cada descarga
- ✅ No se guardan cookies ni sesiones persistentes
- ✅ Los logs no muestran contraseñas

## 🐛 TROUBLESHOOTING

### Error: "Chromium not found"
**Solución:** Verificar que `CHROMIUM_PATH` apunta a la ubicación correcta:
- Linux: `/usr/bin/chromium-browser` o `/usr/bin/chromium`
- Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`

### Error: "Login falló"
**Solución:** Verificar credenciales SOL en la configuración de la empresa

### Error: "Timeout esperando modal"
**Solución:** La factura no existe en SUNAT o los datos son incorrectos

### Error: "No se pudo capturar el contenido XML"
**Solución:** SUNAT puede haber cambiado su interfaz. Revisar logs y actualizar selectores.

## 📈 LOGS

El scraper genera logs detallados para debugging:

```
[SCRAPER] Iniciando descarga XML para F001-123
[SCRAPER] Login en SUNAT...
[SCRAPER] Seleccionando Empresas...
[SCRAPER] Buscando formulario en iframe...
[SCRAPER] Llenando formulario para F001-123...
[SCRAPER] Consultando...
[SCRAPER] Esperando modal con factura...
[SCRAPER] Interceptando descarga XML...
[SCRAPER] Descarga es ZIP, extrayendo XML...
[SCRAPER] XML extraído del ZIP: 20508565934-01-F001-00000123.xml
[SCRAPER] ✅ XML descargado exitosamente (15234 bytes)
```

## ✅ VENTAJAS DE ESTA INTEGRACIÓN

1. **Fallback automático:** Si las APIs fallan, el scraping toma el control
2. **Sin configuración extra:** Solo necesita credenciales SOL (que ya están configuradas)
3. **Funciona para COMPRAS:** Único método que permite obtener XMLs de comprobantes recibidos
4. **Transparente:** El usuario no nota la diferencia, solo ve "líneas extraídas"
5. **Robusto:** Múltiples intentos y manejo de errores

## 🎯 PRÓXIMOS PASOS

1. ✅ Código implementado
2. ⏳ Probar en desarrollo local
3. ⏳ Desplegar a Railway con Chromium instalado
4. ⏳ Monitorear logs en producción
5. ⏳ Ajustar timeouts si es necesario

## 📝 NOTAS IMPORTANTES

- El scraping **solo se activa** si `includeDetails=true` en la descarga masiva
- El scraping **solo se usa** para documentos de **COMPRAS** (donde las APIs no funcionan)
- El scraping es **secuencial** (1 documento a la vez) para no saturar SUNAT
- Si el scraping falla, el documento queda con `parserStatus='SIN_XML'` (no bloquea el proceso)

## 🔗 REFERENCIAS

- Código original: `sunat-xml-final.mjs`
- Documentación completa: `AUTOMATIZACION-COMPLETA.md`
- Manual SUNAT SIRE: v25 (2024)
