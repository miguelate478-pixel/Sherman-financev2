// Test del scraper corregido
import { downloadXmlFromSunat } from './src/lib/providers/sunat-scraper.ts';

const creds = {
  ruc: '20610169849',
  solUser: 'SHERMAN1',
  solPass: 'Pepe2024',
};

const factura = {
  rucEmisor: '20508565934', // Tottus
  serie: 'FJ88',
  numero: '30587',
};

console.log('=== TEST SCRAPER CORREGIDO ===\n');
console.log(`Factura: ${factura.serie}-${factura.numero}`);
console.log(`RUC Emisor: ${factura.rucEmisor}\n`);

const result = await downloadXmlFromSunat(creds, factura);

if (result.xmlContent) {
  console.log('\n✅ XML DESCARGADO EXITOSAMENTE');
  console.log(`Tamaño: ${result.xmlContent.length} bytes`);
  console.log(`Primeros 200 caracteres:\n${result.xmlContent.substring(0, 200)}...`);
} else {
  console.log('\n❌ ERROR');
  console.log(`Error: ${result.error}`);
}
