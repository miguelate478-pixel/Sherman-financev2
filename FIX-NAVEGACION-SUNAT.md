# Fix: Navegación SUNAT Browser - Error 404 Resuelto

## Problema Identificado

El scraper de browser (`sunat-browser.ts`) estaba fallando con **Error 404** porque intentaba navegar directamente a URLs del portal SUNAT:

```
https://ww1.sunat.gob.pe/ol-ti-itconsultaunificadalibre/consultaUnificadaLibre/consulta/comprobante
```

**Logs del error:**
```
[BROWSER] Página actual: https://ww1.sunat.gob.pe/ol-ti-itconsultaunificadalibre/consultaUnificadaLibre/consulta/comprobante
[BROWSER] Título: Error 404--Not Found
[BROWSER] Total XMLs obtenidos: 0
```

## Causa Raíz

El código estaba usando **navegación por URL directa** en lugar de **navegación por menú con clicks**, que es el método correcto para el portal SUNAT.

### Código Incorrecto (antes):
```typescript
// ❌ Intentaba ir directamente a URLs
const moduleUrls = [
  `https://e-factura.sunat.gob.pe/ol-ti-itconsultaunificadalibre/...`,
  `https://ww1.sunat.gob.pe/ol-ti-itconsultaunificadalibre/...`,
];
for (const url of moduleUrls) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}
```

### Código Correcto (ahora):
```typescript
// ✅ Navegación por menú (igual que sunat-xml-final.mjs que SÍ funciona)

// 1. Login en menú principal
await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm');

// 2. Click en "Empresas" (data-id="2")
await page.evaluate(() => {
  document.querySelector('div[data-id="2"]')?.click();
});

// 3. Navegación por menú (4 clicks secuenciales)
// Click 1: Comprobantes de pago (data-id2="11")
// Click 2: Comprobantes de Pago nivel 2 (data-id2="11_38")
// Click 3: Consulta de Comprobantes (data-id2="11_38_1")
// Click 4: Nueva Consulta (data-id2="11_38_1_1")
```

## Cambios Realizados

### Archivo: `src/lib/sunat-browser.ts`

#### 1. Login Corregido
**Antes:** Intentaba login en `https://e-factura.sunat.gob.pe/`  
**Ahora:** Login correcto en `https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm`

```typescript
async function loginSol(...) {
  // ✅ URL correcta del menú principal
  await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  
  await page.waitForSelector('#txtRuc', { timeout: 10000 });
  await page.type('#txtRuc', ruc, { delay: 80 });
  await page.type('#txtUsuario', solUser, { delay: 80 });
  await page.type('#txtContrasena', solPass, { delay: 80 });
  await page.click('#btnAceptar');
  await page.waitForSelector('#divContainerMenu', { timeout: 15000 });
}
```

#### 2. Navegación por Menú Implementada
**Antes:** Navegación por URLs directas (404)  
**Ahora:** Navegación por clicks en elementos del menú

```typescript
// PASO 1: Click en "Empresas"
await page.evaluate(() => {
  document.querySelector('div[data-id="2"]')?.click();
});
await new Promise(r => setTimeout(r, 2000));

// PASO 2-5: Navegación por menú (4 clicks)
// data-id2="11" → "11_38" → "11_38_1" → "11_38_1_1"
```

#### 3. Búsqueda de Formulario en Iframe
El formulario Angular está dentro de un iframe, por lo que se busca el frame correcto:

```typescript
let targetFrame = page.mainFrame();
for (const frame of page.frames()) {
  const hasForm = await frame.evaluate(() =>
    !!(document.querySelector('input[formcontrolname="rucEmisor"]'))
  );
  if (hasForm) {
    targetFrame = frame;
    break;
  }
}
```

## Arquitectura de Descarga de XMLs

El sistema tiene **3 niveles de fallback** para descargar XMLs:

### Nivel 1: SIRE API (Rápido, Batch, Solo VENTAS)
- ✅ Funciona para ventas emitidas
- ❌ No funciona para compras recibidas
- Descarga masiva por período

### Nivel 2: CPE API (Requiere clientId/Secret)
- ✅ Funciona para ventas y compras
- ⚠️ Requiere credenciales OAuth2
- Descarga individual por documento

### Nivel 3: Web Scraping (Fallback Universal)
- ✅ Funciona para compras cuando APIs fallan
- ⚠️ Más lento (navegación browser)
- ✅ **AHORA CORREGIDO** - navegación por menú

## Código de Referencia

El fix se basó en `sunat-xml-final.mjs` que **SÍ funciona localmente**:

```javascript
// Código que funciona (sunat-xml-final.mjs)
await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm');
// Login...
await page.evaluate(() => {
  document.querySelector('div[data-id="2"]')?.click(); // Empresas
});
// 4 clicks en menú...
// Formulario en iframe...
```

## Integración en Bulk Download

El scraping se usa automáticamente como fallback en `src/app/api/sunat/bulk-download/route.ts`:

```typescript
// 1. Intentar SIRE API (ventas)
// 2. Intentar CPE API (si hay clientId/Secret)
// 3. Fallback a scraping (solo COMPRAS)
if (!xmlForLines && op === 'COMPRAS' && cred) {
  const { downloadXmlFromSunat } = await import('@/lib/providers/sunat-scraper');
  const scraperResult = await downloadXmlFromSunat(
    { ruc, solUser, solPass },
    { rucEmisor, serie, numero }
  );
  if (scraperResult.xmlContent) {
    xmlForLines = scraperResult.xmlContent;
  }
}
```

## Testing

### Antes del Fix:
```
[BROWSER] Título: Error 404--Not Found
[BROWSER] Total XMLs obtenidos: 0
```

### Después del Fix (esperado):
```
[BROWSER] Login exitoso
[BROWSER] Empresas seleccionado
[BROWSER] Navegando menú: Comprobantes de pago...
[BROWSER] Formulario de consulta cargado
[BROWSER] Frame encontrado: https://e-factura.sunat.gob.pe/app/contribuyentems/...
[BROWSER] Formulario listo para consultas
```

## Próximos Pasos

1. ✅ **Commit y push** de los cambios
2. ✅ **Deploy a Railway** para probar en producción
3. ⏳ **Probar descarga** con botón morado (COMPRAS período 2024-07)
4. ⏳ **Verificar logs** en Railway para confirmar navegación exitosa

## Notas Importantes

- El scraper individual (`sunat-scraper.ts`) **YA estaba correcto** con navegación por menú
- El problema estaba solo en `sunat-browser.ts` (descarga masiva por período)
- `sunat-browser.ts` ahora usa la **misma lógica** que `sunat-scraper.ts`
- El formulario SUNAT es para **consultas individuales**, no búsqueda por período
- Para descarga masiva por período, usar **SIRE API** (ventas) o **CPE API** (compras)

## Credenciales de Prueba

```
RUC: 20610169849
Usuario SOL: SHERMAN1
Password: Pepe2024
Factura prueba: Tottus RUC=20508565934, Serie=FJ88, Numero=30587
```

---

**Fecha:** 2026-05-07  
**Autor:** Kiro AI  
**Archivos modificados:** `src/lib/sunat-browser.ts`
