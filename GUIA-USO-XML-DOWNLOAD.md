# Guía de Uso: Sistema de Descarga de XMLs

## 🎯 Sistema Implementado

Se ha implementado un **sistema híbrido** que combina:
1. **Scraping de SUNAT** (gratuito, primario)
2. **ExcelNegocios API** (de pago, fallback)

---

## ⚙️ Configuración

### 1. Variables de Entorno

Edita `.env.local`:

```env
# Estrategia de descarga
# Opciones: scraping | excelnegocios | auto
XML_DOWNLOAD_PROVIDER=auto

# ExcelNegocios (opcional, solo si usas 'excelnegocios' o 'auto')
EXCELNEGOCIOS_API_KEY=tu_api_key_aqui
EXCELNEGOCIOS_API_URL=https://api.excelnegocios.com
```

### 2. Estrategias Disponibles

**`auto` (Recomendado)**
- Intenta scraping primero
- Si falla, usa ExcelNegocios como fallback
- Mejor de ambos mundos

**`scraping`**
- Solo usa scraping
- Gratis pero puede fallar
- Requiere mantenimiento

**`excelnegocios`**
- Solo usa ExcelNegocios
- Confiable pero de pago
- Sin mantenimiento

---

## 📡 API Endpoints

### Descargar XML Individual

```typescript
POST /api/sunat/download-xml

Body:
{
  "companyId": "1",
  "rucEmisor": "20508565934",
  "tipoComprobante": "01",
  "serie": "FJ88",
  "numero": "30587"
}

Response:
{
  "ok": true,
  "data": {
    "fileName": "20508565934-01-FJ88-30587.zip",
    "size": 12345,
    "provider": "scraping",  // o "excelnegocios"
    "storagePath": "./storage/sunat/20610169849/2026-05/compras/01/FJ88-30587"
  }
}
```

### Descargar XMLs en Batch

```typescript
PUT /api/sunat/download-xml

Body:
{
  "companyId": "1",
  "comprobantes": [
    {
      "rucEmisor": "20508565934",
      "tipoComprobante": "01",
      "serie": "FJ88",
      "numero": "30587"
    },
    {
      "rucEmisor": "20100066603",
      "tipoComprobante": "01",
      "serie": "F001",
      "numero": "100001"
    }
  ]
}

Response:
{
  "ok": true,
  "data": {
    "results": [
      {
        "comprobante": "FJ88-30587",
        "success": true,
        "provider": "scraping"
      },
      {
        "comprobante": "F001-100001",
        "success": true,
        "provider": "excelnegocios"
      }
    ],
    "stats": {
      "total": 2,
      "success": 2,
      "failed": 0,
      "scraping": 1,
      "excelnegocios": 1
    }
  }
}
```

---

## 💻 Uso en Código

### Ejemplo 1: Descargar XML Individual

```typescript
// En tu componente o página
async function descargarXML() {
  const response = await fetch('/api/sunat/download-xml', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      companyId: '1',
      rucEmisor: '20508565934',
      tipoComprobante: '01',
      serie: 'FJ88',
      numero: '30587',
    }),
  });

  const data = await response.json();

  if (data.ok) {
    console.log('XML descargado:', data.data.fileName);
    console.log('Provider usado:', data.data.provider);
  } else {
    console.error('Error:', data.error);
  }
}
```

### Ejemplo 2: Integrar con Bulk Download

```typescript
// En src/lib/providers/sunat.ts - método bulkDownload

import { HybridXMLProvider } from './hybrid-xml-provider';

// Después de obtener la lista de comprobantes desde SIRE:
const xmlProvider = new HybridXMLProvider();

// Preparar parámetros
const xmlParams = allDocuments.map(doc => ({
  ruc: p.ruc,
  solUser: p.solUser || '',
  solPass: p.solPass || '',
  rucEmisor: doc.rucEmisor,
  tipoComprobante: doc.tipo,
  serie: doc.serie,
  numero: doc.numero,
}));

// Descargar XMLs
const xmlResults = await xmlProvider.downloadXMLBatch(xmlParams);

// Guardar XMLs en storage
let docsXml = 0;
for (let i = 0; i < allDocuments.length; i++) {
  const doc = allDocuments[i];
  const xmlResult = xmlResults[i];

  if (xmlResult.success && xmlResult.buffer) {
    const storagePath = getStoragePath(p.ruc, p.period, p.operation, doc.tipo, doc.id);
    saveFile(storagePath, xmlResult.fileName!, xmlResult.buffer);
    docsXml++;
  }
}

// Cerrar navegador
await xmlProvider.close();

console.log(`XMLs descargados: ${docsXml}/${allDocuments.length}`);
```

---

## 📊 Monitoreo

### Ver Estadísticas de Uso

```typescript
// Agregar a tu dashboard
async function getXMLDownloadStats() {
  const response = await fetch('/api/sunat/download-xml/stats', {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await response.json();

  return {
    totalDescargas: data.total,
    scraping: data.scraping,
    excelnegocios: data.excelnegocios,
    costoEstimado: data.excelnegocios * 0.10, // $0.10 por descarga
  };
}
```

---

## 🔧 Troubleshooting

### Problema: Scraping falla constantemente

**Solución 1:** Cambiar a ExcelNegocios temporalmente
```env
XML_DOWNLOAD_PROVIDER=excelnegocios
```

**Solución 2:** Verificar logs
```bash
# Ver logs en Railway
railway logs
```

**Solución 3:** Verificar Chromium
```bash
# Probar si Chromium funciona
which chromium
chromium --version
```

### Problema: ExcelNegocios retorna error 401

**Causa:** API key inválida o expirada

**Solución:**
1. Verificar API key en `.env.local`
2. Contactar ExcelNegocios para renovar

### Problema: Timeout en descargas

**Causa:** Portal de SUNAT lento o muchas descargas simultáneas

**Solución:**
1. Reducir concurrencia en batch
2. Aumentar timeout en código
3. Usar ExcelNegocios como fallback

---

## 💰 Costos Estimados

### Con Estrategia `auto` (Recomendada)

**Escenario optimista (90% scraping, 10% ExcelNegocios):**
- 1000 descargas/mes
- 900 via scraping (gratis)
- 100 via ExcelNegocios ($0.10 c/u)
- **Costo: $10/mes**

**Escenario pesimista (50% scraping, 50% ExcelNegocios):**
- 1000 descargas/mes
- 500 via scraping (gratis)
- 500 via ExcelNegocios ($0.10 c/u)
- **Costo: $50/mes**

### Con Estrategia `scraping`

- **Costo: $0/mes** (solo servidor)
- Riesgo de fallos

### Con Estrategia `excelnegocios`

- 1000 descargas/mes × $0.10
- **Costo: $100/mes**
- Confiable

---

## 🚀 Próximos Pasos

### Fase 1: Testing (Esta semana)
- [ ] Probar descarga individual
- [ ] Probar descarga batch
- [ ] Verificar que los XMLs se guardan correctamente
- [ ] Probar con diferentes tipos de comprobantes

### Fase 2: Producción (Próxima semana)
- [ ] Configurar ExcelNegocios API key (si usas fallback)
- [ ] Desplegar a Railway
- [ ] Monitorear primeras descargas
- [ ] Ajustar estrategia según resultados

### Fase 3: Optimización (Mes 1)
- [ ] Analizar estadísticas de uso
- [ ] Optimizar rate limiting
- [ ] Implementar caché de XMLs
- [ ] Agregar retry logic

---

## 📞 Soporte

**Scraping no funciona:**
- Revisar logs de Puppeteer
- Verificar que Chromium está instalado
- Verificar credenciales SUNAT

**ExcelNegocios no funciona:**
- Verificar API key
- Contactar soporte de ExcelNegocios
- Revisar límites de rate

**Ambos fallan:**
- Verificar conectividad
- Revisar credenciales
- Contactar soporte técnico

---

## ✅ Checklist de Implementación

- [x] Provider de scraping implementado
- [x] Provider de ExcelNegocios implementado
- [x] Provider híbrido implementado
- [x] Endpoint API creado
- [x] Variables de entorno configuradas
- [ ] ExcelNegocios API key obtenida (opcional)
- [ ] Testing en desarrollo
- [ ] Despliegue a producción
- [ ] Monitoreo configurado

---

**¿Listo para probar?** Ejecuta:

```bash
# Configurar variables
cp .env.example .env.local
# Editar .env.local con tus valores

# Instalar dependencias (si no están)
npm install puppeteer

# Probar en desarrollo
npm run dev

# Hacer una prueba de descarga
curl -X POST http://localhost:3000/api/sunat/download-xml \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "companyId": "1",
    "rucEmisor": "20508565934",
    "tipoComprobante": "01",
    "serie": "FJ88",
    "numero": "30587"
  }'
```
