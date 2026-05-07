# Investigación: Descarga de XMLs con Detalle desde SUNAT

## 🎯 Objetivo
Descargar XMLs de facturas recibidas (compras de proveedores) directamente desde SUNAT, sin importar qué OSE usó el proveedor.

## 🔍 Hallazgos

### 1. API de ExcelNegocios.com (Solución de Pago)
- **Servicio**: API SUNAT de ExcelNegocios.com
- **Funcionalidad**: Descarga XMLs de facturas recibidas directamente desde SUNAT
- **Ventaja**: No importa qué OSE usó el proveedor
- **Respuesta**:
```json
{
  "statusCode": 200,
  "body": {
    "type": "base64",
    "fileName": "20536557858-01-FP04-00059531.zip",
    "data": "base64_del_zip_con_el_xml..."
  }
}
```

### 2. API Oficial de SUNAT (Solución Gratuita - A Verificar)

#### Endpoint Identificado
```
GET https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/{tipo}/{serie}/{numero}/{rucEmisor}/xml
```

**Parámetros**:
- `tipo`: Tipo de comprobante (01=Factura, 03=Boleta, etc.)
- `serie`: Serie del comprobante (ej: FJ88)
- `numero`: Número del comprobante (ej: 30587)
- `rucEmisor`: RUC del emisor (proveedor)

**Headers requeridos**:
- `Authorization: Bearer {SIRE_TOKEN}`
- `Accept: application/json`

#### Autenticación SIRE

**Endpoint de Token**:
```
POST https://api-seguridad.sunat.gob.pe/v1/clientessol/{client_id}/oauth2/token/
```

**Body (x-www-form-urlencoded)**:
```
grant_type=password
scope=https://api-sire.sunat.gob.pe
client_id=f62b2812-1afb-4d70-8d74-7c444bdfae4c
client_secret={TU_CLIENT_SECRET}
username={RUC}{USUARIO_SOL}
password={CLAVE_SOL}
```

**Ejemplo de username**: `20610169849SHERMAN1`
- RUC: 20610169849
- Usuario SOL: SHERMAN1

## 📋 Pasos para Verificar

### Paso 1: Obtener Credenciales SUNAT
Necesitas obtener de SUNAT:
1. **Client Secret**: Se obtiene del portal de SUNAT al registrar tu aplicación
2. **Usuario SOL**: Tu usuario de Clave SOL (formato: {RUC}{USUARIO})
3. **Clave SOL**: Tu contraseña de Clave SOL

### Paso 2: Configurar Credenciales
Edita el archivo `.env.local`:
```env
# Credenciales SUNAT SIRE
SUNAT_CLIENT_ID=f62b2812-1afb-4d70-8d74-7c444bdfae4c
SUNAT_CLIENT_SECRET=tu_client_secret_aqui
SUNAT_USERNAME=20610169849SHERMAN1
SUNAT_PASSWORD=tu_clave_sol_aqui
```

### Paso 3: Ejecutar Prueba
Ejecuta el script de prueba:
```powershell
# Edita primero test-sunat-xml-download.ps1 con tus credenciales
./test-sunat-xml-download.ps1
```

### Paso 4: Verificar Respuesta
El script intentará descargar el XML de una factura de Tottus:
- **RUC Emisor**: 20508565934 (Hipermercados Tottus)
- **Tipo**: 01 (Factura)
- **Serie**: FJ88
- **Número**: 30587

## 🔧 Script de Prueba Creado

He creado `test-sunat-xml-download.ps1` que:
1. ✅ Obtiene token SIRE de SUNAT
2. ✅ Descarga el XML del comprobante
3. ✅ Decodifica el base64 y guarda el ZIP
4. ✅ Muestra la respuesta completa de SUNAT

## ⚠️ Estado Actual

**Bloqueado**: No se puede probar sin credenciales válidas de SUNAT.

**Error actual**: 400 Bad Request al intentar obtener token (credenciales de prueba inválidas)

## 🎯 Próximos Pasos

1. **Obtener credenciales reales** de SUNAT
2. **Ejecutar el script de prueba** con credenciales válidas
3. **Verificar la respuesta** de SUNAT:
   - ¿Devuelve el XML en base64?
   - ¿Qué formato tiene la respuesta?
   - ¿Incluye las líneas de detalle?
4. **Comparar con ExcelNegocios.com**:
   - Si SUNAT funciona → usar API gratuita de SUNAT
   - Si SUNAT no funciona o es limitada → considerar ExcelNegocios.com

## 📚 Documentación de Referencia

- **SUNAT SIRE**: Sistema Integrado de Registros Electrónicos
- **API CPE**: Comprobantes de Pago Electrónicos
- **GEM**: Gestión Electrónica de Comprobantes

## 💡 Notas Importantes

1. **Alcance**: Este endpoint es para facturas **recibidas** (compras), no emitidas
2. **OSE Independiente**: No importa qué OSE usó el proveedor, SUNAT tiene todos los comprobantes
3. **Detalle Completo**: Los XMLs de SUNAT incluyen todas las líneas de detalle
4. **Autenticación**: Requiere Clave SOL y registro de aplicación en SUNAT

## 🔐 Seguridad

⚠️ **IMPORTANTE**: Nunca subas las credenciales reales a Git
- Usa `.env.local` (ya está en `.gitignore`)
- Usa variables de entorno en producción
- Rota las credenciales periódicamente
