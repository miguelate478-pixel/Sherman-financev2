export interface XMLDownloadParams {
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
}

export class ExcelNegociosProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.EXCELNEGOCIOS_API_KEY || '';
    this.baseUrl = process.env.EXCELNEGOCIOS_API_URL || 'https://api.excelnegocios.com';

    if (!this.apiKey) {
      console.warn('[ExcelNegocios] API key no configurada');
    }
  }

  async downloadXML(params: XMLDownloadParams): Promise<{ fileName: string; buffer: Buffer }> {
    if (!this.apiKey) {
      throw new Error('ExcelNegocios API key no configurada');
    }

    console.log(`[ExcelNegocios] Descargando ${params.serie}-${params.numero}...`);

    try {
      const response = await fetch(`${this.baseUrl}/sunat/xml/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          rucEmisor: params.rucEmisor,
          tipoComprobante: params.tipoComprobante,
          serie: params.serie,
          numero: params.numero,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.statusCode !== 200) {
        throw new Error(`Error en respuesta: ${JSON.stringify(data)}`);
      }

      const buffer = Buffer.from(data.body.data, 'base64');

      console.log(`[ExcelNegocios] ✅ ${params.serie}-${params.numero} descargado`);

      return {
        fileName: data.body.fileName,
        buffer,
      };
    } catch (error) {
      console.error(`[ExcelNegocios] ❌ Error:`, error);
      throw error;
    }
  }

  async downloadXMLBatch(comprobantes: XMLDownloadParams[]): Promise<XMLDownloadResult[]> {
    const results: XMLDownloadResult[] = [];

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

      // Rate limiting: esperar 100ms entre requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
