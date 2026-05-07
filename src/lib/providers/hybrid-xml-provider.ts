import { SunatScrapingProvider, XMLDownloadParams as ScrapingParams } from './sunat-scraping';
import { ExcelNegociosProvider, XMLDownloadParams as ExcelParams } from './excelnegocios';

export interface XMLDownloadParams {
  // Credenciales SUNAT (para scraping)
  ruc: string;
  solUser: string;
  solPass: string;
  // Datos del comprobante
  rucEmisor: string;
  tipoComprobante: string;
  serie: string;
  numero: string;
}

export interface XMLDownloadResult {
  comprobante: string;
  success: boolean;
  fileName?: string;
  buffer?: Buffer;
  error?: string;
  provider?: 'scraping' | 'excelnegocios';
}

export class HybridXMLProvider {
  private scraping: SunatScrapingProvider;
  private excelnegocios: ExcelNegociosProvider;
  private preferredProvider: 'scraping' | 'excelnegocios' | 'auto';

  constructor() {
    this.scraping = new SunatScrapingProvider();
    this.excelnegocios = new ExcelNegociosProvider();
    this.preferredProvider = (process.env.XML_DOWNLOAD_PROVIDER as any) || 'auto';
  }

  async downloadXML(params: XMLDownloadParams): Promise<{ fileName: string; buffer: Buffer; provider: string }> {
    console.log(`[Hybrid] Descargando ${params.serie}-${params.numero}...`);
    console.log(`[Hybrid] Estrategia: ${this.preferredProvider}`);

    // Estrategia según configuración
    if (this.preferredProvider === 'excelnegocios') {
      return await this.downloadWithExcelNegocios(params);
    }

    if (this.preferredProvider === 'scraping') {
      return await this.downloadWithScraping(params);
    }

    // Auto: Intentar scraping primero, fallback a ExcelNegocios
    try {
      console.log('[Hybrid] Intentando scraping...');
      const result = await this.scraping.downloadXML(params);
      console.log('[Hybrid] ✅ Scraping exitoso');
      return { ...result, provider: 'scraping' };
    } catch (scrapingError) {
      console.log('[Hybrid] ⚠️  Scraping falló:', (scrapingError as Error).message);
      console.log('[Hybrid] Intentando ExcelNegocios como fallback...');

      try {
        const result = await this.excelnegocios.downloadXML({
          rucEmisor: params.rucEmisor,
          tipoComprobante: params.tipoComprobante,
          serie: params.serie,
          numero: params.numero,
        });
        console.log('[Hybrid] ✅ ExcelNegocios exitoso');
        return { ...result, provider: 'excelnegocios' };
      } catch (excelError) {
        console.log('[Hybrid] ❌ ExcelNegocios también falló:', (excelError as Error).message);
        throw new Error(
          `Ambos providers fallaron. Scraping: ${(scrapingError as Error).message}. ExcelNegocios: ${(excelError as Error).message}`
        );
      }
    }
  }

  private async downloadWithScraping(params: XMLDownloadParams): Promise<{ fileName: string; buffer: Buffer; provider: string }> {
    const result = await this.scraping.downloadXML(params);
    return { ...result, provider: 'scraping' };
  }

  private async downloadWithExcelNegocios(params: XMLDownloadParams): Promise<{ fileName: string; buffer: Buffer; provider: string }> {
    const result = await this.excelnegocios.downloadXML({
      rucEmisor: params.rucEmisor,
      tipoComprobante: params.tipoComprobante,
      serie: params.serie,
      numero: params.numero,
    });
    return { ...result, provider: 'excelnegocios' };
  }

  async downloadXMLBatch(comprobantes: XMLDownloadParams[]): Promise<XMLDownloadResult[]> {
    console.log(`[Hybrid] Descarga batch de ${comprobantes.length} comprobantes`);

    const results: XMLDownloadResult[] = [];

    for (const comp of comprobantes) {
      try {
        const result = await this.downloadXML(comp);
        results.push({
          comprobante: `${comp.serie}-${comp.numero}`,
          success: true,
          fileName: result.fileName,
          buffer: result.buffer,
          provider: result.provider as 'scraping' | 'excelnegocios',
        });
      } catch (error) {
        results.push({
          comprobante: `${comp.serie}-${comp.numero}`,
          success: false,
          error: (error as Error).message,
        });
      }

      // Esperar entre descargas
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Estadísticas
    const stats = {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      scraping: results.filter(r => r.provider === 'scraping').length,
      excelnegocios: results.filter(r => r.provider === 'excelnegocios').length,
    };

    console.log('[Hybrid] Estadísticas batch:', stats);

    return results;
  }

  async close() {
    await this.scraping.close();
  }

  async healthCheck(): Promise<{ scraping: boolean; excelnegocios: boolean }> {
    const [scrapingHealth, excelHealth] = await Promise.all([
      this.scraping.healthCheck(),
      this.excelnegocios.healthCheck(),
    ]);

    return {
      scraping: scrapingHealth,
      excelnegocios: excelHealth,
    };
  }
}
