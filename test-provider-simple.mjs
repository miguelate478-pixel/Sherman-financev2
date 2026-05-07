// Test simple del provider actualizado (sin iframes)
import { SunatScrapingProvider } from './src/lib/providers/sunat-scraping.ts';

const testInvoice = {
  ruc: '20610169849',
  solUser: 'SHERMAN1',
  solPass: 'Pepe2024',
  rucEmisor: '20508565934', // Tottus
  tipoComprobante: '01',
  serie: 'FJ88',
  numero: '30587',
};

async function testProvider() {
  console.log('=== Test Provider Simple ===\n');
  console.log(`Buscando: ${testInvoice.serie}-${testInvoice.numero}`);
  console.log(`RUC Emisor: ${testInvoice.rucEmisor}\n`);

  const provider = new SunatScrapingProvider();
  
  try {
    console.log('Iniciando descarga...\n');
    
    const result = await provider.downloadXML(testInvoice);
    
    console.log('\n========================================');
    console.log('✅ DESCARGA EXITOSA');
    console.log('========================================');
    console.log(`Archivo: ${result.fileName}`);
    console.log(`Tamaño: ${result.buffer.length} bytes`);
    
    // Guardar para verificar
    const fs = await import('fs/promises');
    await fs.writeFile(`downloaded-${result.fileName}`, result.buffer);
    console.log(`\nGuardado como: downloaded-${result.fileName}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await provider.close();
  }
}

testProvider();
