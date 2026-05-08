import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  
  // Empresas activas
  const companies = await client.query(`SELECT id, ruc, "businessName" FROM companies WHERE status = $1`, ['activo']);
  console.log('=== EMPRESAS ACTIVAS ===');
  companies.rows.forEach(r => console.log(`${r.id} | ${r.ruc} | ${r.businessName}`));
  
  // Períodos con documentos
  const periods = await client.query(`SELECT DISTINCT "companyId", period FROM documents ORDER BY period DESC LIMIT 20`);
  console.log('\n=== PERÍODOS CON DOCUMENTOS ===');
  periods.rows.forEach(r => console.log(`${r.companyId} | ${r.period}`));
  
  // Total documentos
  const total = await client.query(`SELECT COUNT(*) as total FROM documents`);
  console.log(`\n=== TOTAL DOCUMENTOS: ${total.rows[0].total} ===`);
  
  // Documentos por operación
  const byOp = await client.query(`SELECT operation, COUNT(*) as count FROM documents GROUP BY operation`);
  console.log('\n=== DOCUMENTOS POR OPERACIÓN ===');
  byOp.rows.forEach(r => console.log(`${r.operation}: ${r.count}`));
  
  await client.end();
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
