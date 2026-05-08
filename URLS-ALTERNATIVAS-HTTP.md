# URLs Alternativas para Descarga HTTP

## Problema Identificado

La URL original de descarga HTTP podía fallar porque SUNAT tiene múltiples endpoints para descargar XMLs de comprobantes recibidos.

## Solución: Estrategia de Fallback con 2 URLs

### URL 1: Portal de Comprobantes Recibidos (Principal)

```typescript
const url1 = `https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/comprobante/xml` +
  `?numRuc=${receptorRuc}` +
  `&codTipo=${tipoCodigo}` +
  `&numSerie=${serie}` +
  `&numCorrelativo=${numero}` +
  `&numRucEmisor=${emisorRuc}`;
```

**Características:**
- Portal específico para comprobantes **recibidos**
- Requiere `numRuc` del receptor (la empresa que consulta)
- Endpoint: `/cl-ti-itmrconsrecec/jaxrs/comprobante/xml`
- Parámetros: `numRuc`, `codTipo`, `numSerie`, `numCorrelativo`, `numRucEmisor`

### URL 2: Portal GEM (Alternativo)

```typescript
const url2 = `https://e-factura.sunat.gob.pe/contribuyente/gem/comprobantes/` +
  `${tipoCodigo}/${serie}/${numero}/${emisorRuc}/xml`;
```

**Características:**
- Portal GEM (Gestión Electrónica de Comprobantes)
- URL tipo REST: `/contribuyente/gem/comprobantes/{tipo}/{serie}/{numero}/{emisor}/xml`
- No requiere parámetros query, todo en la ruta
- Puede funcionar para comprobantes emitidos y recibidos

## Flujo de Fallback

```typescript
// 1. Intentar URL1 (portal de recibidos)
const res1 = await fetch(url1, { headers: { Cookie: cookies } });
if (res1.ok && isValidXml(await res1.text())) {
  return xml; // ✅ Éxito con URL1
}

// 2. Si URL1 falla, intentar URL2 (portal GEM)
const res2 = await fetch(url2, { headers: { Cookie: cookies } });
if (res2.ok && isValidXml(await res2.text())) {
  return xml; // ✅ Éxito con URL2
}

// 3. Si ambas fallan, logging detallado
console.log(`[HTTP] ❌ Ambas URLs fallaron`);
console.log(`[HTTP] URL1 intentada: ${url1}`);
console.log(`[HTTP] URL2 intentada: ${url2}`);
console.log(`[HTTP] Cookies usadas: ${cookies.substring(0, 100)}`);
console.log(`[HTTP] URL1 status: ${res1.status}, URL2 status: ${res2.status}`);
```

## Parámetros Requeridos

### Antes (Solo emisorRuc)
```typescript
fetchXmlViaSolSession(
  serie,
  numero,
  tipoCodigo,
  emisorRuc,
  creds
);
```

### Después (Con receptorRuc)
```typescript
fetchXmlViaSolSession(
  serie,
  numero,
  tipoCodigo,
  emisorRuc,
  receptorRuc, // ← NUEVO: RUC de la empresa que recibe
  creds
);
```

**Razón**: URL1 necesita saber quién es el receptor del comprobante.

## Logs Esperados

### Éxito con URL1
```
[HTTP] Intentando descarga via sesión SOL...
[HTTP] Cookies obtenidas, descargando XML...
[HTTP] Intentando URL1: https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/comprobante/xml?numRuc=20610169849&codTipo=01&numSerie=FJ88&numCorrelativo=30587&numRucEmisor=20508565934
[HTTP] ✅ XML descargado via URL1: 12345 bytes
```

### Fallback a URL2
```
[HTTP] Intentando descarga via sesión SOL...
[HTTP] Cookies obtenidas, descargando XML...
[HTTP] Intentando URL1: https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/comprobante/xml?numRuc=20610169849&codTipo=01&numSerie=FJ88&numCorrelativo=30587&numRucEmisor=20508565934
[HTTP] URL1 falló: HTTP 404
[HTTP] Intentando URL2: https://e-factura.sunat.gob.pe/contribuyente/gem/comprobantes/01/FJ88/30587/20508565934/xml
[HTTP] ✅ XML descargado via URL2: 12345 bytes
```

### Ambas fallan (Debugging)
```
[HTTP] Intentando descarga via sesión SOL...
[HTTP] Cookies obtenidas, descargando XML...
[HTTP] Intentando URL1: https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/comprobante/xml?numRuc=20610169849&codTipo=01&numSerie=FJ88&numCorrelativo=30587&numRucEmisor=20508565934
[HTTP] URL1 falló: HTTP 404
[HTTP] Intentando URL2: https://e-factura.sunat.gob.pe/contribuyente/gem/comprobantes/01/FJ88/30587/20508565934/xml
[HTTP] URL2 falló: HTTP 404
[HTTP] ❌ Ambas URLs fallaron
[HTTP] URL1 intentada: https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/comprobante/xml?numRuc=20610169849&codTipo=01&numSerie=FJ88&numCorrelativo=30587&numRucEmisor=20508565934
[HTTP] URL2 intentada: https://e-factura.sunat.gob.pe/contribuyente/gem/comprobantes/01/FJ88/30587/20508565934/xml
[HTTP] Cookies usadas (primeros 100 chars): JSESSIONID=ABC123...; SUNAT_TOKEN=XYZ789...
[HTTP] URL1 status: 404, URL2 status: 404
```

## Ventajas del Enfoque

1. **Mayor cobertura**: 2 endpoints diferentes aumentan probabilidad de éxito
2. **Debugging fácil**: Logs detallados muestran exactamente qué falló
3. **Sin bloqueo**: Si una URL falla, intenta la otra automáticamente
4. **Información completa**: Muestra URLs, cookies y status codes

## Casos de Uso

### URL1 funciona mejor para:
- Comprobantes recibidos (COMPRAS)
- Cuando se conoce el RUC receptor
- Portal específico de consulta de recibidos

### URL2 funciona mejor para:
- Comprobantes emitidos (VENTAS)
- Cuando URL1 da 404
- Portal GEM más general

## Testing

### Probar con documento real
```bash
# Ver logs en Railway
railway logs

# Buscar:
- "[HTTP] Intentando URL1:" (debe aparecer primero)
- "[HTTP] ✅ XML descargado via URL1:" (si URL1 funciona)
- "[HTTP] URL1 falló: HTTP 404" (si URL1 no funciona)
- "[HTTP] Intentando URL2:" (debe aparecer si URL1 falla)
- "[HTTP] ✅ XML descargado via URL2:" (si URL2 funciona)
```

### Verificar qué URL funciona más
```bash
# Contar éxitos por URL
railway logs | grep "XML descargado via URL1" | wc -l
railway logs | grep "XML descargado via URL2" | wc -l
```

## Troubleshooting

### Si ambas URLs dan 404
**Posibles causas:**
1. Cookies inválidas o expiradas
2. Comprobante no existe en SUNAT
3. RUC emisor o receptor incorrecto
4. Tipo de comprobante incorrecto

**Solución:**
- Verificar logs detallados (URLs, cookies, status)
- Verificar que el comprobante existe en portal SUNAT manual
- Verificar credenciales SOL

### Si URL1 siempre falla pero URL2 funciona
**Causa probable:** Portal de recibidos requiere permisos específicos

**Solución:**
- Usar URL2 como principal
- Invertir orden de fallback

### Si cookies están vacías
**Causa:** Login SOL falló

**Solución:**
- Verificar credenciales (ruc, solUser, solPass)
- Verificar que endpoint de login responde

## Próximas Optimizaciones

1. **Caché de URL exitosa**: Recordar qué URL funcionó para ese tipo de documento
2. **Métricas**: Trackear tasa de éxito por URL
3. **URL3**: Agregar tercer endpoint si se descubre
4. **Timeout diferenciado**: Menos tiempo para URL1, más para URL2

---

**Fecha**: 2026-05-08  
**Commit**: `8cad7f3` - "feat: agregar 2 URLs alternativas con fallback y logging detallado"
