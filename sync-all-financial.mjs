/**
 * Script para sincronizar TODOS los documentos existentes
 * Ejecutar desde Railway CLI o localmente con DATABASE_URL
 * 
 * Uso:
 *   node sync-all-financial.mjs
 *   node sync-all-financial.mjs <companyId>
 *   node sync-all-financial.mjs <companyId> <period>
 */

import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no está configurado');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

// Funciones auxiliares
function calcularVencimiento(fechaEmision, dias = 30) {
  const fecha = new Date(fechaEmision);
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().split('T')[0];
}

function requiereDetraccion(total, moneda) {
  if (moneda === 'USD') {
    total = total * 3.8;
  }
  return total >= 700;
}

function inferirCodigoDetraccion() {
  return '031'; // Servicios generales
}

function obtenerPorcentajeDetraccion(codigo) {
  const PORCENTAJES = {
    '001': 10, '003': 10, '004': 4,  '005': 10, '007': 10,
    '010': 10, '012': 12, '019': 10, '020': 12, '021': 10,
    '022': 12, '024': 4,  '025': 4,  '027': 10, '030': 4,
    '031': 12, '037': 10,
  };
  return PORCENTAJES[codigo] || 12;
}

async function syncDocument(doc) {
  let cxc = 0, cxp = 0, det = 0;
  
  // CXC - Ventas con Factura
  if (doc.operation === 'VENTA' && doc.docType === '01') {
    const exists = await client.query('SELECT id FROM cxc_records WHERE "documentId" = $1', [doc.id]);
    if (exists.rows.length === 0) {
      const dueDate = doc.dueDate || calcularVencimiento(doc.issueDate, 30);
      await client.query(
        `INSERT INTO cxc_records (id, "companyId", "documentId", "clientRuc", "clientName", amount, "dueDate", status, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [`CXC-${doc.id}`, doc.companyId, doc.id, doc.receiverRuc, doc.receiverName, doc.total, dueDate, 'PENDIENTE']
      );
      cxc = 1;
      console.log(`  ✅ CXC: ${doc.receiverName} - ${doc.total} ${doc.currency}`);
    }
  }
  
  // CXP - Compras con Factura
  if (doc.operation === 'COMPRA' && doc.docType === '01') {
    const exists = await client.query('SELECT id FROM cxp_records WHERE "documentId" = $1', [doc.id]);
    if (exists.rows.length === 0) {
      const dueDate = doc.dueDate || calcularVencimiento(doc.issueDate, 30);
      await client.query(
        `INSERT INTO cxp_records (id, "companyId", "documentId", "providerRuc", "providerName", amount, "dueDate", status, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [`CXP-${doc.id}`, doc.companyId, doc.id, doc.issuerRuc, doc.issuerName, doc.total, dueDate, 'PENDIENTE']
      );
      cxp = 1;
      console.log(`  ✅ CXP: ${doc.issuerName} - ${doc.total} ${doc.currency}`);
    }
  }
  
  // Detracciones - Compras > 700
  if (doc.operation === 'COMPRA' && doc.docType === '01' && requiereDetraccion(doc.total, doc.currency)) {
    const exists = await client.query('SELECT id FROM detractions WHERE "documentId" = $1', [doc.id]);
    if (exists.rows.length === 0) {
      const codigo = inferirCodigoDetraccion();
      const pct = obtenerPorcentajeDetraccion(codigo);
      const amount = doc.total * (pct / 100);
      await client.query(
        `INSERT INTO detractions (id, "companyId", "documentId", provider, "provRuc", amount, pct, code, account, status, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [`DET-${doc.id}`, doc.companyId, doc.id, doc.issuerName, doc.issuerRuc, amount, pct, codigo, '00-010-348912', 'PENDIENTE']
      );
      det = 1;
      console.log(`  ✅ DET: ${doc.issuerName} - ${pct}% - ${amount.toFixed(2)}`);
    }
  }
  
  return { cxc, cxp, det };
}

async function main() {
  const args = process.argv.slice(2);
  const companyId = args[0];
  const period = args[1];
  
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Construir query
    let query = 'SELECT * FROM documents WHERE 1=1';
    const params = [];
    
    if (companyId) {
      params.push(companyId);
      query += ` AND "companyId" = $${params.length}`;
    }
    
    if (period) {
      params.push(period);
      query += ` AND period = $${params.length}`;
    }
    
    query += ' ORDER BY "issueDate" ASC';
    
    console.log(`📊 Consultando documentos...`);
    if (companyId) console.log(`   Company: ${companyId}`);
    if (period) console.log(`   Period: ${period}`);
    console.log('');
    
    const result = await client.query(query, params);
    const docs = result.rows;
    
    console.log(`📄 Encontrados ${docs.length} documentos\n`);
    
    let totalCxc = 0, totalCxp = 0, totalDet = 0, errors = 0;
    
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      try {
        console.log(`[${i + 1}/${docs.length}] ${doc.id} - ${doc.operation} - ${doc.docType}`);
        const { cxc, cxp, det } = await syncDocument(doc);
        totalCxc += cxc;
        totalCxp += cxp;
        totalDet += det;
      } catch (e) {
        console.error(`  ❌ Error: ${e.message}`);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE SINCRONIZACIÓN');
    console.log('='.repeat(60));
    console.log(`✅ CXC creados:        ${totalCxc}`);
    console.log(`✅ CXP creados:        ${totalCxp}`);
    console.log(`✅ Detracciones:       ${totalDet}`);
    console.log(`❌ Errores:            ${errors}`);
    console.log(`📄 Total procesados:   ${docs.length}`);
    console.log('='.repeat(60));
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
