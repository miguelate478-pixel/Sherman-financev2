# Código para Claude - Completar Scraping SUNAT

## CONTEXTO
Estoy implementando un scraper para descargar XMLs del portal SUNAT. El login y la selección de "Empresas" YA FUNCIONAN CORRECTAMENTE.

## LO QUE FUNCIONA (NO TOCAR)

```javascript
// LOGIN - FUNCIONA ✅
await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
  waitUntil: 'networkidle2',
  timeout: 30000,
});

await page.waitForSelector('#txtRuc', { timeout: 10000 });
await page.type('#txtRuc', ruc, { delay: 100 });
await page.type('#txtUsuario', solUser, { delay: 100 });
await page.type('#txtContrasena', solPass, { delay: 100 });
await page.click('#btnAceptar');

await new Promise(resolve => setTimeout(resolve, 3000));

const menuLoaded = await page.$('#divContainerMenu');
if (!menuLoaded) {
  throw new Error('Login falló - no se cargó el menú');
}

// EMPRESAS - FUNCIONA ✅
const empresasClicked = await page.evaluate(() => {
  const elements = Array.from(document.querySelectorAll('a, div, span, li'));
  const empresasEl = elements.find(el => {
    const text = el.textContent?.trim().toLowerCase();
    return text === 'empresas' || text?.includes('empresa');
  });
  
  if (empresasEl) {
    empresasEl.click();
    return true;
  }
  return false;
});

if (!empresasClicked) {
  throw new Error('No se encontró la opción "Empresas"');
}

await new Promise(resolve => setTimeout(resolve, 3000));
```

## LO QUE FALTA IMPLEMENTAR

Después de hacer click en "Empresas", necesito:

### 3. Click en "Consulta de Facturas y Notas Electrónicas"
- Buscar en el menú desplegado la opción que contiene "Consulta de Facturas" y "Electrónicas"
- Hacer click
- Esperar a que cargue la página de consulta

### 4. Seleccionar filtro "Recibido"
- Buscar el radio button que tiene label "Recibido" (comprobantes recibidos, no emitidos)
- Hacer click en ese radio

### 5. Llenar formulario de búsqueda
Los campos del formulario son:
- `input[name="rucEmisor"]` o `input[formcontrolname="rucEmisor"]` o `#rucEmisor` - RUC del emisor
- `select[name="tipoComprobante"]` o similar - Tipo de comprobante (01 = Factura)
- `input[name="serieComprobante"]` o similar - Serie (ej: "FJ88")
- `input[name="numeroComprobante"]` o similar - Número (ej: "30587")

**IMPORTANTE**: El formulario puede estar en un IFRAME o en la página principal. Necesitas:
1. Primero intentar buscar los campos en la página principal
2. Si no los encuentras, buscar en todos los frames: `page.frames()`
3. Para cada frame, verificar si tiene los campos del formulario
4. Usar el frame correcto para llenar el formulario

### 6. Click en botón "Consultar"
- Buscar botón que contenga "consultar" o "buscar"
- Hacer click
- Esperar resultados (5 segundos)

### 7. Verificar si hay resultados
- Verificar que NO aparezca texto "no se encontraron" o "sin resultados"
- Si no hay resultados, lanzar error

### 8. Descargar XML
- Configurar descarga con CDP Session
- Buscar botón que contenga "xml" o "descargar"
- Hacer click
- Esperar a que aparezca archivo .xml o .zip en carpeta de descargas
- Leer el archivo y retornar el buffer

## DATOS DE PRUEBA

```javascript
const testInvoice = {
  ruc: '20610169849',
  solUser: 'SHERMAN1',
  solPass: 'Pepe2024',
  rucEmisor: '20508565934', // Tottus
  tipoComprobante: '01',
  serie: 'FJ88',
  numero: '30587',
};
```

## ARCHIVO A COMPLETAR

El archivo es: `src/lib/providers/sunat-scraping.ts`

La función es: `async downloadXML(params: XMLDownloadParams)`

Ya tiene el login y empresas implementados. Necesito que completes desde el paso 3 en adelante.

## NOTAS IMPORTANTES

1. **IFRAMES**: El formulario puede estar en un iframe. Debes buscar en `page.frames()` si no lo encuentras en la página principal.

2. **SELECTORES MÚLTIPLES**: Usa múltiples selectores como fallback:
   ```javascript
   const input = document.querySelector('input[name="rucEmisor"]') ||
                 document.querySelector('input[formcontrolname="rucEmisor"]') ||
                 document.querySelector('#rucEmisor');
   ```

3. **EVENTOS**: Después de llenar cada campo, dispara eventos:
   ```javascript
   input.value = valor;
   input.dispatchEvent(new Event('input', { bubbles: true }));
   input.dispatchEvent(new Event('change', { bubbles: true }));
   ```

4. **TIEMPOS DE ESPERA**: Usa esperas generosas entre pasos (3-5 segundos).

5. **SCREENSHOTS**: Toma screenshots en cada paso para debug.

## PREGUNTA PARA CLAUDE

¿Puedes completar la implementación de los pasos 3-8 en el archivo `src/lib/providers/sunat-scraping.ts`?

El código de login y empresas ya funciona. Solo necesito que agregues el resto del flujo manejando correctamente los iframes si es necesario.
