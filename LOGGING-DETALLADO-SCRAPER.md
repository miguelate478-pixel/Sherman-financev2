# Logging Detallado del Scraper Playwright

## Objetivo

Agregar logging exhaustivo para depurar exactamente qué está pasando cuando el scraper Playwright intenta descargar XMLs.

## Logs Agregados

### 1. URL y Title después de navegar

```typescript
await page.goto('https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/web/itmConsultaRecepcion');

console.log(`[SCRAPER] URL actual después de navegar: ${page.url()}`);
console.log(`[SCRAPER] Title: ${await page.title()}`);
```

**Propósito**: Verificar que la navegación fue exitosa y no hubo redirección inesperada.

**Logs esperados**:
```
[SCRAPER] URL actual después de navegar: https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/web/itmConsultaRecepcion
[SCRAPER] Title: Consulta de Comprobantes de Pago Electrónicos Recibidos
```

### 2. Resultado detallado del fetch

```typescript
const result = await page.evaluate(async ({ tipoCodigo, serie, numero, emisorRuc, receptorRuc }) => {
  const url = `/cl-ti-itmrconsrecec/jaxrs/comprobante/xml` +
    `?numRuc=${receptorRuc}&codTipo=${tipoCodigo}&numSerie=${serie}&numCorrelativo=${numero}&numRucEmisor=${emisorRuc}`;
  
  try {
    const res = await fetch(url, { credentials: 'include' });
    const text = await res.text();
    
    return {
      status: res.status,           // HTTP status code
      url: url,                      // URL completa usada
      bodyStart: text.substring(0, 200),  // Primeros 200 chars del body
      isXml: text.trim().startsWith('<'), // ¿Es XML?
      bodyLength: text.length,       // Tamaño total del body
      fullText: text.trim().startsWith('<') && text.length > 100 ? text : null,
    };
  } catch (e) {
    return { error: e.message };
  }
}, { tipoCodigo, serie, numero, emisorRuc, receptorRuc });

console.log(`[SCRAPER] fetch result:`, JSON.stringify({
  status: result.status,
  url: result.url,
  bodyStart: result.bodyStart,
  isXml: result.isXml,
  bodyLength: result.bodyLength,
  error: result.error,
}));
```

**Propósito**: Ver exactamente qué responde SUNAT al fetch interno.

## Logs Esperados por Escenario

### ✅ Escenario 1: Éxito (XML descargado)

```
[SCRAPER] Estrategia 2: Browser con fetch autenticado
[SCRAPER] Login en SUNAT...
[SCRAPER] Login OK
[SCRAPER] Navegando directo al módulo de consulta...
[SCRAPER] URL actual después de navegar: https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/web/itmConsultaRecepcion
[SCRAPER] Title: Consulta de Comprobantes de Pago Electrónicos Recibidos
[SCRAPER] Módulo cargado
[SCRAPER] Descargando XML via fetch autenticado...
[SCRAPER] fetch result: {
  "status": 200,
  "url": "/cl-ti-itmrconsrecec/jaxrs/comprobante/xml?numRuc=20610169849&codTipo=01&numSerie=FJ88&numCorrelativo=30587&numRucEmisor=20508565934",
  "bodyStart": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\" xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\"...",
  "isXml": true,
  "bodyLength": 12345
}
[SCRAPER] FJ88-30587: 12345 bytes
```

### ❌ Escenario 2: HTTP 404 (Comprobante no encontrado)

```
[SCRAPER] Estrategia 2: Browser con fetch autenticado
[SCRAPER] Login en SUNAT...
[SCRAPER] Login OK
[SCRAPER] Navegando directo al módulo de consulta...
[SCRAPER] URL actual después de navegar: https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/web/itmConsultaRecepcion
[SCRAPER] Title: Consulta de Comprobantes de Pago Electrónicos Recibidos
[SCRAPER] Módulo cargado
[SCRAPER] Descargando XML via fetch autenticado...
[SCRAPER] fetch result: {
  "status": 404,
  "url": "/cl-ti-itmrconsrecec/jaxrs/comprobante/xml?numRuc=20610169849&codTipo=01&numSerie=FJ88&numCorrelativo=30587&numRucEmisor=20508565934",
  "bodyStart": "<!DOCTYPE html><html><head><title>Error 404 - Not Found</title></head><body><h1>404 Not Found</h1><p>El comprobante solicitado no existe</p></body></html>",
  "isXml": false,
  "bodyLength": 234
}
[SCRAPER] FJ88-30587: sin XML válido
```

### ❌ Escenario 3: Redirección inesperada (Sesión expirada)

```
[SCRAPER] Estrategia 2: Browser con fetch autenticado
[SCRAPER] Login en SUNAT...
[SCRAPER] Login OK
[SCRAPER] Navegando directo al módulo de consulta...
[SCRAPER] URL actual después de navegar: https://www.sunat.gob.pe/sol.html
[SCRAPER] Title: SUNAT Operaciones en Línea
[SCRAPER] Módulo cargado
[SCRAPER] Descargando XML via fetch autenticado...
[SCRAPER] fetch result: {
  "status": 401,
  "url": "/cl-ti-itmrconsrecec/jaxrs/comprobante/xml?numRuc=20610169849&codTipo=01&numSerie=FJ88&numCorrelativo=30587&numRucEmisor=20508565934",
  "bodyStart": "<!DOCTYPE html><html><head><title>Unauthorized</title></head><body><h1>401 Unauthorized</h1><p>Sesión no válida</p></body></html>",
  "isXml": false,
  "bodyLength": 189
}
[SCRAPER] FJ88-30587: sin XML válido
```

### ❌ Escenario 4: Error de red

```
[SCRAPER] Estrategia 2: Browser con fetch autenticado
[SCRAPER] Login en SUNAT...
[SCRAPER] Login OK
[SCRAPER] Navegando directo al módulo de consulta...
[SCRAPER] URL actual después de navegar: https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/web/itmConsultaRecepcion
[SCRAPER] Title: Consulta de Comprobantes de Pago Electrónicos Recibidos
[SCRAPER] Módulo cargado
[SCRAPER] Descargando XML via fetch autenticado...
[SCRAPER] fetch result: {
  "error": "Failed to fetch"
}
[SCRAPER] FJ88-30587: sin XML válido
```

## Información Capturada

| Campo | Descripción | Uso |
|-------|-------------|-----|
| **status** | HTTP status code (200, 404, 401, etc.) | Identificar tipo de error |
| **url** | URL completa del fetch | Verificar parámetros correctos |
| **bodyStart** | Primeros 200 chars del body | Ver qué responde SUNAT |
| **isXml** | ¿El body es XML válido? | Validación rápida |
| **bodyLength** | Tamaño total del body | Detectar respuestas vacías |
| **error** | Mensaje de error si fetch falla | Debugging de errores de red |

## Debugging con Logs

### Problema: "sin XML válido"

**Revisar logs**:
1. ¿`status` es 200? → Si no, SUNAT rechazó la petición
2. ¿`isXml` es true? → Si no, SUNAT devolvió HTML de error
3. ¿`bodyLength` > 100? → Si no, respuesta vacía o muy corta
4. ¿`bodyStart` contiene `<?xml`? → Si no, no es XML

**Acciones según logs**:
- `status: 404` → Comprobante no existe en SUNAT
- `status: 401` → Sesión expirada o no autenticada
- `status: 500` → Error interno de SUNAT
- `isXml: false` → SUNAT devolvió HTML de error (ver `bodyStart`)
- `error: "Failed to fetch"` → Problema de red o CORS

### Problema: Redirección inesperada

**Revisar logs**:
1. ¿`URL actual después de navegar` es la esperada?
2. ¿`Title` corresponde al módulo correcto?

**Si URL es diferente**:
- Redirigió a `/sol.html` → Login falló o sesión expiró
- Redirigió a `/error.html` → Acceso denegado
- Redirigió a otro módulo → Navegación incorrecta

## Ejemplo de Debugging Real

### Log capturado:
```
[SCRAPER] fetch result: {
  "status": 200,
  "url": "/cl-ti-itmrconsrecec/jaxrs/comprobante/xml?numRuc=20610169849&codTipo=01&numSerie=FJ88&numCorrelativo=30587&numRucEmisor=20508565934",
  "bodyStart": "<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Parámetros incorrectos</h1><p>El RUC emisor no coincide</p></body></html>",
  "isXml": false,
  "bodyLength": 156
}
```

**Análisis**:
- ✅ `status: 200` → Request llegó a SUNAT
- ❌ `isXml: false` → No es XML
- ❌ `bodyStart` contiene HTML de error
- 🔍 Mensaje: "El RUC emisor no coincide"

**Solución**: Verificar que `numRucEmisor` sea correcto

## Ventajas del Logging Detallado

1. **Debugging rápido**: Ver exactamente qué falla sin adivinar
2. **Información completa**: Status, URL, body en un solo log
3. **Sin screenshots**: No necesita capturas de pantalla
4. **Railway-friendly**: Logs textuales fáciles de ver en Railway
5. **Reproducible**: Con la URL exacta se puede probar manualmente

## Próximos Pasos

Si los logs muestran:
- `status: 404` consistente → Verificar que comprobante existe en SUNAT
- `isXml: false` con HTML → Analizar mensaje de error en `bodyStart`
- `error: "Failed to fetch"` → Problema de red o CORS
- URL redirige a `/sol.html` → Problema de autenticación

---

**Fecha**: 2026-05-08  
**Commit**: `0b7f81a` - "feat: agregar logging detallado en scraper Playwright para debugging"
