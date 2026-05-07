# Guía Completa: Scraping de XMLs desde Portal SUNAT

## 🎯 ¿Qué es Scraping?

Scraping es automatizar lo que un humano haría manualmente:
1. Entrar al portal de SUNAT
2. Iniciar sesión con Clave SOL
3. Buscar la factura
4. Descargar el XML

---

## 🛠️ Herramientas Necesarias

### 1. Puppeteer (Ya lo tienes instalado)

```bash
npm install puppeteer
```

### 2. Chromium (Ya lo tienes en Railway)

Tu código ya tiene configurado Chromium en Railway:
```typescript
// Ya existe en tu proyecto
const browser = await puppeteer.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

---

## 📋 Pasos del Scraping

### Paso 1: Login en SUNAT

```typescript
async function loginSunat(page, ruc, usuario, clave) {
  // 1. Ir al portal
  await page.goto('https://e-factura.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm');
  
  // 2. Llenar formulario de login
  await page.type('#txtRuc', ruc);
  await page.type('#txtUsuario', usuario);
  await page.type('#txtContrasena', clave);
  
  // 3. Hacer clic en "Ingresar"
  await page.click('#btnAceptar');
  
  // 4. Esperar a que cargue el menú
  await page.waitForNavigation();
}
```

### Paso 2: Ir a Consulta de Comprobantes

```typescript
async function irAConsultaComprobantes(page) {
  // Navegar al menú de consultas
  await page.goto('https://e-factura.sunat.gob.pe/cl-ti-itmenu/ConsultaComprobantes.htm');
  
  // Esperar a que cargue
  await page.waitForSelector('#frmConsulta');
}
```

### Paso 3: Buscar Factura Específica

```typescript
async function buscarFactura(page, rucEmisor, serie, numero) {
  // Llenar formulario de búsqueda
  await page.select('#tipoComprobante', '01'); // 01 = Factura
  await page.type('#rucEmisor', rucEmisor);
  await page.type('#serie', serie);
  await page.type('#numero', numero);
  
  // Buscar
  await page.click('#btnBuscar');
  
  // Esperar resultados
  await page.waitForSelector('.resultado');
}
```

### Paso 4: Descargar XML

```typescript
async function descargarXML(page) {
  // Hacer clic en botón "Descargar XML"
  await page.click('.btnDescargarXML');
  
  // Esperar a que se descargue
  await page.waitForTimeout(2000);
  
  // Leer el archivo descargado
  const xmlContent = await fs.readFile('./downloads/factura.xml', 'utf8');
  
  return xmlContent;
}
```

---

## 💻 Código Completo del Provider

```typescript
// src/lib/providers/sunat-scraping-provider.ts
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

export class SunatScrapingProvider {
  private browser: any = null;
  
  async init() {
    if (this.browser) return;
    
    this.browser = await puppeteer.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
  
  async downloadXML(params: {
    ruc: string;
    solUser: string;
    solPass: string;
    rucEmisor: string;
    tipoComprobante: string;
    serie: string;
    numero: string;
  }): Promise<{ fileName: string; buffer: Buffer }> {
    await this.init();
    
    const page = await this.browser.newPage();
    
    try {
      console.log('[Scraping] Iniciando sesión en SUNAT...');
      
      // 1. Login
      await page.goto('https://e-factura.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      
      await page.type('#txtRuc', params.ruc);
      await page.type('#txtUsuario', params.solUser);
      await page.type('#txtContrasena', params.solPass);
      await page.click('#btnAceptar');
      
      await page.waitForNavigation({ timeout: 30000 });
      
      console.log('[Scraping] Login exitoso');
      
      // 2. Ir a consulta de comprobantes recibidos
      console.log('[Scraping] Navegando a consulta de comprobantes...');
      
      await page.goto('https://e-factura.sunat.gob.pe/cl-ti-itmenu/ConsultaComprobantesRecibidos.htm', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      
      // 3. Buscar factura
      console.log(`[Scraping] Buscando factura ${params.serie}-${params.numero}...`);
      
      await page.select('#cboTipoComprobante', params.tipoComprobante);
      await page.type('#txtRucEmisor', params.rucEmisor);
      await page.type('#txtSerie', params.serie);
      await page.type('#txtNumero', params.numero);
      
      await page.click('#btnBuscar');
      
      // Esperar resultados
      await page.waitForSelector('.tablaResultados', { timeout: 30000 });
      
      // Verificar si hay resultados
      const noResults = await page.$('.sinResultados');
      if (noResults) {
        throw new Error('Comprobante no encontrado en SUNAT');
      }
      
      console.log('[Scraping] Factura encontrada, descargando XML...');
      
      // 4. Configurar descarga
      const downloadPath = path.join(process.cwd(), 'temp-downloads');
      await fs.mkdir(downloadPath, { recursive: true });
      
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath,
      });
      
      // 5. Hacer clic en descargar XML
      await page.click('.btnDescargarXML');
      
      // Esperar a que se descargue (polling del archivo)
      let downloaded = false;
      let attempts = 0;
      let fileName = '';
      
      while (!downloaded && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const files = await fs.readdir(downloadPath);
        const xmlFile = files.find(f => f.endsWith('.xml') || f.endsWith('.zip'));
        
        if (xmlFile) {
          fileName = xmlFile;
          downloaded = true;
        }
        
        attempts++;
      }
      
      if (!downloaded) {
        throw new Error('Timeout esperando descarga del XML');
      }
      
      console.log(`[Scraping] XML descargado: ${fileName}`);
      
      // 6. Leer archivo
      const filePath = path.join(downloadPath, fileName);
      const buffer = await fs.readFile(filePath);
      
      // 7. Limpiar
      await fs.unlink(filePath);
      
      return {
        fileName,
        buffer,
      };
      
    } catch (error) {
      console.error('[Scraping] Error:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
  
  async downloadXMLBatch(comprobantes: Array<{
    ruc: string;
    solUser: string;
    solPass: string;
    rucEmisor: string;
    tipoComprobante: string;
    serie: string;
    numero: string;
  }>): Promise<Array<{
    comprobante: string;
    success: boolean;
    fileName?: string;
    buffer?: Buffer;
    error?: string;
  }>> {
    const results = [];
    
    for (const comp of comprobantes) {
      try {
        const result = await this.downloadXML(comp);
        results.push({
          comprobante: `${comp.serie}-${comp.numero}`,
          success: true,
          fileName: result.fileName,
          buffer: result.buffer,
        });
      } catch (error) {
        results.push({
          comprobante: `${comp.serie}-${comp.numero}`,
          success: false,
          error: (error as Error).message,
        });
      }
      
      // Esperar entre descargas para no saturar
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return results;
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      await this.init();
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## ⚠️ Desafíos del Scraping

### 1. Portal de SUNAT Cambia

**Problema:**
- SUNAT actualiza su portal web
- Los selectores CSS cambian
- Tu código deja de funcionar

**Solución:**
- Monitoreo diario
- Tests automatizados
- Alertas cuando falla

### 2. CAPTCHAs

**Problema:**
- SUNAT puede agregar CAPTCHAs
- El robot no puede resolverlos

**Solución:**
- Usar servicios de resolución de CAPTCHA (2Captcha, Anti-Captcha)
- Costo adicional: $1-3 por 1000 CAPTCHAs

### 3. Bloqueos por IP

**Problema:**
- Muchas descargas desde la misma IP
- SUNAT puede bloquear temporalmente

**Solución:**
- Rate limiting (máximo X descargas por minuto)
- Rotar IPs (proxies)
- Esperar entre descargas

### 4. Sesiones Concurrentes

**Problema:**
- Múltiples empresas descargando al mismo tiempo
- Necesitas múltiples sesiones de navegador

**Solución:**
- Pool de navegadores
- Cola de trabajos
- Límite de concurrencia

---

## 💰 Costos Reales del Scraping

### Desarrollo Inicial
- Programación: 2-3 semanas × $50/hora = $4,000-6,000
- Testing: 1 semana × $50/hora = $2,000
- **Total: $6,000-8,000**

### Costos Mensuales
- Servidor (Railway): $50/mes
- Mantenimiento (10 horas/mes): $500/mes
- Resolución de CAPTCHAs: $50/mes
- Monitoreo y alertas: $20/mes
- **Total: $620/mes**

### Costos de Mantenimiento
- Actualizaciones cuando SUNAT cambia: 5 horas × $50 = $250 (cada 3-6 meses)
- Debugging de errores: 3 horas/mes × $50 = $150/mes

**Total Real: ~$770/mes**

---

## 📊 Comparación Final

| Aspecto | ExcelNegocios | Scraping Propio |
|---------|---------------|-----------------|
| **Costo inicial** | $0 | $6,000-8,000 |
| **Costo mensual (10 empresas)** | $500 | $770 |
| **Costo mensual (50 empresas)** | $2,500 | $770 |
| **Tiempo de implementación** | 1 semana | 3-4 semanas |
| **Mantenimiento** | Cero | Alto |
| **Riesgo de fallos** | Bajo | Medio-Alto |
| **Confiabilidad** | Alta | Media |

---

## 🎯 Recomendación

### Si tienes menos de 15 empresas:
→ **Usa ExcelNegocios**

### Si tienes más de 15 empresas:
→ **Desarrolla scraping**

### Mejor estrategia:
1. Empieza con ExcelNegocios
2. Cuando tengas 15+ empresas, desarrolla scraping
3. Usa ambos (híbrido): scraping primero, ExcelNegocios como fallback

---

## 🚀 ¿Quieres que lo implemente?

Si decides hacer scraping, puedo:
1. ✅ Implementar el provider completo
2. ✅ Agregar manejo de errores robusto
3. ✅ Configurar cola de trabajos
4. ✅ Agregar monitoreo y alertas
5. ✅ Hacer sistema híbrido (scraping + ExcelNegocios fallback)

**¿Qué prefieres hacer?**
