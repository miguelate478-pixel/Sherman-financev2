import puppeteer from 'puppeteer';

// ── Sesión HTTP directa (sin browser) ──────────────────────────────
export async function fetchXmlViaSolSession(
  serie: string,
  numero: string,
  tipoCodigo: string,
  emisorRuc: string,
  receptorRuc: string,
  creds: { ruc: string; solUser: string; solPass: string }
): Promise<string | null> {
  try {
    console.log('[HTTP] Intentando descarga via sesión SOL...');
    
    // Login en SOL para obtener cookies
    const loginRes = await fetch('https://www.sunat.gob.pe/sol.html', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Origin: 'https://www.sunat.gob.pe',
      },
      body: new URLSearchParams({
        tipo: '2',
        ruc: creds.ruc,
        usuario: creds.solUser,
        password: creds.solPass,
      }),
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });

    const cookies = (loginRes.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');

    if (!cookies) {
      console.log('[HTTP] No se obtuvieron cookies de sesión');
      return null;
    }

    console.log('[HTTP] Cookies obtenidas, descargando XML...');

    // URL 1 - Portal de comprobantes recibidos
    const url1 =
      `https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/comprobante/xml` +
      `?numRuc=${receptorRuc}` +
      `&codTipo=${tipoCodigo}` +
      `&numSerie=${serie}` +
      `&numCorrelativo=${numero}` +
      `&numRucEmisor=${emisorRuc}`;

    console.log(`[HTTP] Intentando URL1: ${url1}`);
    const res1 = await fetch(url1, {
      headers: {
        Cookie: cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (res1.ok) {
      const text = await res1.text();
      const isValidXml = text && text.startsWith('<') && text.length > 100;
      if (isValidXml) {
        console.log(`[HTTP] ✅ XML descargado via URL1: ${text.length} bytes`);
        return text;
      }
      console.log('[HTTP] URL1 respondió OK pero no es XML válido');
    } else {
      console.log(`[HTTP] URL1 falló: HTTP ${res1.status}`);
    }

    // URL 2 - Portal alternativo SUNAT (si URL 1 da 404)
    const url2 =
      `https://e-factura.sunat.gob.pe/contribuyente/gem/comprobantes/` +
      `${tipoCodigo}/${serie}/${numero}/${emisorRuc}/xml`;

    console.log(`[HTTP] Intentando URL2: ${url2}`);
    const res2 = await fetch(url2, {
      headers: {
        Cookie: cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (res2.ok) {
      const text = await res2.text();
      const isValidXml = text && text.startsWith('<') && text.length > 100;
      if (isValidXml) {
        console.log(`[HTTP] ✅ XML descargado via URL2: ${text.length} bytes`);
        return text;
      }
      console.log('[HTTP] URL2 respondió OK pero no es XML válido');
    } else {
      console.log(`[HTTP] URL2 falló: HTTP ${res2.status}`);
    }

    // Si ambas fallan, log detallado para debugging
    console.log(`[HTTP] ❌ Ambas URLs fallaron`);
    console.log(`[HTTP] URL1 intentada: ${url1}`);
    console.log(`[HTTP] URL2 intentada: ${url2}`);
    console.log(`[HTTP] Cookies usadas (primeros 100 chars): ${cookies.substring(0, 100)}`);
    console.log(`[HTTP] URL1 status: ${res1.status}, URL2 status: ${res2.status}`);

    return null;
  } catch (error) {
    console.log(`[HTTP] Error en sesión SOL: ${(error as Error).message}`);
    return null;
  }
}

export async function downloadXmlFromSunat(
  creds: {
    ruc: string;
    solUser: string;
    solPass: string;
  },
  factura: {
    rucEmisor: string;
    serie: string;
    numero: string;
  }
): Promise<{ xmlContent: string | null; error?: string }> {
  let browser;
  try {
    // Mapear tipo de comprobante a código SUNAT
    const tipoMap: Record<string, string> = {
      '01': '01', // Factura
      '03': '03', // Boleta
      '07': '07', // Nota de crédito
      '08': '08', // Nota de débito
    };
    const tipoCodigo = tipoMap['01'] || '01'; // Por defecto factura

    // ESTRATEGIA 1: Intentar sesión HTTP directa (más rápido, sin browser)
    console.log(`[SCRAPER] Estrategia 1: Sesión HTTP directa para ${factura.serie}-${factura.numero}`);
    const httpXml = await fetchXmlViaSolSession(
      factura.serie,
      factura.numero,
      tipoCodigo,
      factura.rucEmisor,
      creds.ruc, // receptorRuc (la empresa que recibe)
      creds
    );

    if (httpXml) {
      console.log(`[SCRAPER] ✅ XML obtenido via HTTP: ${httpXml.length} bytes`);
      return { xmlContent: httpXml };
    }

    // ESTRATEGIA 2: Si HTTP falla, usar browser con fetch autenticado
    console.log(`[SCRAPER] Estrategia 2: Browser con fetch autenticado`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
        '--disable-background-networking',
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    );

    // LOGIN
    console.log('[SCRAPER] Login en SUNAT...');
    await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await page.waitForSelector('#txtRuc', { timeout: 10000 });
    await page.type('#txtRuc', creds.ruc, { delay: 50 });
    await page.type('#txtUsuario', creds.solUser, { delay: 50 });
    await page.type('#txtContrasena', creds.solPass, { delay: 50 });
    await page.click('#btnAceptar');
    await page.waitForSelector('#divContainerMenu', { timeout: 15000 });
    console.log('[SCRAPER] Login OK');

    // Navegar directo al módulo (sin seguir el menú)
    console.log('[SCRAPER] Navegando directo al módulo de consulta...');
    await page.goto(
      'https://www.sunat.gob.pe/cl-ti-itmrconsrecec/jaxrs/web/itmConsultaRecepcion',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    
    // Logging detallado de la página actual
    console.log(`[SCRAPER] URL actual después de navegar: ${page.url()}`);
    console.log(`[SCRAPER] Title: ${await page.title()}`);
    console.log('[SCRAPER] Módulo cargado');

    // Usar fetch dentro del contexto autenticado con logging detallado
    console.log('[SCRAPER] Descargando XML via fetch autenticado...');
    const result = await page.evaluate(
      async ({ tipoCodigo, serie, numero, emisorRuc, receptorRuc }) => {
        const url =
          `/cl-ti-itmrconsrecec/jaxrs/comprobante/xml` +
          `?numRuc=${receptorRuc}&codTipo=${tipoCodigo}&numSerie=${serie}&numCorrelativo=${numero}&numRucEmisor=${emisorRuc}`;
        try {
          const res = await fetch(url, { credentials: 'include' });
          const text = await res.text();
          return {
            status: res.status,
            url: url,
            bodyStart: text.substring(0, 200), // primeros 200 chars
            isXml: text.trim().startsWith('<'),
            bodyLength: text.length,
            fullText: text.trim().startsWith('<') && text.length > 100 ? text : null,
          };
        } catch (e) {
          return { error: (e as Error).message };
        }
      },
      {
        tipoCodigo,
        serie: factura.serie,
        numero: factura.numero,
        emisorRuc: factura.rucEmisor,
        receptorRuc: creds.ruc,
      }
    );

    console.log(`[SCRAPER] fetch result:`, JSON.stringify({
      status: result.status,
      url: result.url,
      bodyStart: result.bodyStart,
      isXml: result.isXml,
      bodyLength: result.bodyLength,
      error: result.error,
    }));

    if (result.fullText) {
      console.log(`[SCRAPER] ${factura.serie}-${factura.numero}: ${result.fullText.length} bytes`);
      return { xmlContent: result.fullText };
    }

    console.log(`[SCRAPER] ${factura.serie}-${factura.numero}: sin XML válido`);
    return { xmlContent: null };
  } catch (error) {
    console.error(`[SCRAPER] Error:`, (error as Error).message);
    return { xmlContent: null, error: (error as Error).message };
  } finally {
    if (browser) await browser.close();
  }
}
