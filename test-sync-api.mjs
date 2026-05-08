/**
 * Script para probar el endpoint de sincronización
 * Ejecutar: node test-sync-api.mjs <token> <companyId> [period]
 */

const args = process.argv.slice(2);
const token = args[0];
const companyId = args[1];
const period = args[2];

if (!token || !companyId) {
  console.error('Uso: node test-sync-api.mjs <token> <companyId> [period]');
  console.error('Ejemplo: node test-sync-api.mjs eyJhbG... comp_abc123 2025-01');
  process.exit(1);
}

const API_URL = process.env.API_URL || 'https://sherman-financev2-production.up.railway.app';

async function testSync() {
  console.log('🔄 Probando sincronización...');
  console.log(`   API: ${API_URL}`);
  console.log(`   Company: ${companyId}`);
  if (period) console.log(`   Period: ${period}`);
  console.log('');
  
  try {
    const body = { companyId };
    if (period) body.period = period;
    
    const response = await fetch(`${API_URL}/api/sync/financial`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error:', data);
      process.exit(1);
    }
    
    console.log('✅ Sincronización completada:');
    console.log('');
    console.log('📊 Resultados:');
    console.log(`   CXC creados:       ${data.data.cxcCreated}`);
    console.log(`   CXP creados:       ${data.data.cxpCreated}`);
    console.log(`   Detracciones:      ${data.data.detrCreated}`);
    console.log(`   Errores:           ${data.data.errors}`);
    console.log(`   Total documentos:  ${data.data.totalDocs}`);
    console.log('');
    console.log(`💬 ${data.data.message}`);
    
  } catch (e) {
    console.error('❌ Error de red:', e.message);
    process.exit(1);
  }
}

testSync();
