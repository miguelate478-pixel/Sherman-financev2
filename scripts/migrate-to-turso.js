#!/usr/bin/env node
/**
 * Migrar datos de SQLite local → Turso cloud
 * Uso: TURSO_URL="libsql://xxx.turso.io" TURSO_TOKEN="xxx" node scripts/migrate-to-turso.js
 */
const { createClient } = require('@libsql/client');

const localUrl  = process.env.LOCAL_DB  || 'file:prisma/dev.db';
const remoteUrl = process.env.TURSO_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN;

if (!remoteUrl) {
  console.error('❌ Falta TURSO_URL. Ejemplo:');
  console.error('   TURSO_URL="libsql://mi-db.turso.io" TURSO_AUTH_TOKEN="xxx" node scripts/migrate-to-turso.js');
  process.exit(1);
}

async function migrate() {
  console.log('\n🚀 Migrando SQLite local → Turso cloud\n');
  
  const local  = createClient({ url: localUrl });
  const remote = createClient({ url: remoteUrl, authToken });

  // 1. Get schema from local
  const tables = (await local.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  )).rows.map(r => r[0]);
  
  console.log('Tablas encontradas:', tables.join(', '));

  // 2. For each table: create + copy data
  for (const table of tables) {
    // Get CREATE statement
    const schemaResult = await local.execute(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`
    );
    const createSql = schemaResult.rows[0]?.[0];
    if (!createSql) continue;

    // Create table in remote
    try {
      await remote.execute(createSql);
      console.log(`✓ Tabla creada: ${table}`);
    } catch (e) {
      if (e.message?.includes('already exists')) {
        console.log(`  (ya existe: ${table})`);
      } else {
        console.log(`⚠ ${table}:`, e.message);
      }
    }

    // Copy data
    const rows = await local.execute(`SELECT * FROM ${table}`);
    if (rows.rows.length === 0) {
      console.log(`  → ${table}: vacía`);
      continue;
    }

    const cols = rows.columns;
    const placeholders = cols.map(() => '?').join(',');
    const insertSql = `INSERT OR IGNORE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`;

    let copied = 0;
    for (const row of rows.rows) {
      const values = cols.map((c, i) => row[i] ?? null);
      try {
        await remote.execute({ sql: insertSql, args: values });
        copied++;
      } catch (e) {
        console.log(`  ⚠ Row error in ${table}:`, e.message?.slice(0, 60));
      }
    }
    console.log(`✓ ${table}: ${copied}/${rows.rows.length} filas migradas`);
  }

  // Verify
  console.log('\n=== VERIFICACIÓN ===');
  for (const table of tables) {
    const local_n  = (await local.execute(`SELECT COUNT(*) as n FROM ${table}`)).rows[0][0];
    const remote_n = (await remote.execute(`SELECT COUNT(*) as n FROM ${table}`)).rows[0][0];
    const ok = local_n === remote_n;
    console.log(`${ok ? '✅' : '❌'} ${table}: local=${local_n}, turso=${remote_n}`);
  }

  local.close();
  remote.close();
  
  console.log('\n✅ Migración completada!');
  console.log('\nAhora actualiza tu .env en producción:');
  console.log(`DATABASE_URL=${remoteUrl}`);
  console.log(`TURSO_AUTH_TOKEN=${authToken || 'tu-token'}`);
}

migrate().catch(e => {
  console.error('\n❌ Error:', e.message);
  process.exit(1);
});
