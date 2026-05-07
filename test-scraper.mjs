// Script de prueba para el scraper SUNAT
// Ejecutar con: node test-scraper.mjs

import { downloadXmlFromSunat } from './src/lib/providers/sunat-scraper.ts';

// ============================================
// CONFIGURACIÓN DE PRUEBA
// ============================================
const CREDENCIALES = {
  ruc: '20610169849',
  solUser: 'SHERMAN1',
  solPass: 'Pepe2024',
};

const FACTURA_PRUEBA = {
  rucEmisor: '20508565934', // Tottus
  serie: 'FJ88',
  numero: '30587',
  tipoComprobante: '01', // Factura
};

// ============================================
// EJECUTAR PRUEBA
// ============================================
console.log('=== PRUEBA DE SCRAPER SUNAT ===\n');
console.log('Credenciales:', CREDENCIALES.ruc, CREDENCIALES.solUser);
console.log('Factura:', `${FACTURA_PRUEBA.serie}-${FACTURA_PRUEBA.numero}`);
console.log('RUC Emisor:', FACTURA_PRUEBA.rucEmisor);
console.log('\nIniciando descarga...\n');

const startTime = Date.now();

try {
  const result = await downloadXmlFromSunat(CREDENCIALES, FACTURA_PRUEBA);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (result.xmlContent) {
    console.log('\n========================================');
    console.log('✅ DESCARGA EXITOSA');
    console.log('========================================');
    console.log(`Tiempo: ${duration} segundos`);
    console.log(`Tamaño XML: ${result.xmlContent.length} bytes`);
    console.log('\nPrimeros 500 caracteres del XML:');
    console.log(result.xmlContent.substring(0, 500));
    console.log('\n...\n');
    
    // Guardar XML en archivo
    const fs = await import('fs/promises');
    const fileName = `${FACTURA_PRUEBA.rucEmisor}-${FACTURA_PRUEBA.serie}-${FACTURA_PRUEBA.numero}.xml`;
    await fs.writeFile(fileName, result.xmlContent, 'utf8');
    console.log(`XML guardado en: ${fileName}`);
    
    process.exit(0);
  } else {
    console.log('\n========================================');
    console.log('❌ DESCARGA FALLÓ');
    console.log('========================================');
    console.log(`Tiempo: ${duration} segundos`);
    console.log(`Error: ${result.error}`);
    process.exit(1);
  }
} catch (error) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n========================================');
  console.log('❌ ERROR CRÍTICO');
  console.log('========================================');
  console.log(`Tiempo: ${duration} segundos`);
  console.log(`Error: ${error.message}`);
  console.log(`Stack: ${error.stack}`);
  process.exit(1);
}
