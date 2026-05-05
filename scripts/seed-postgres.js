#!/usr/bin/env node
// Sherman Finance — Seed inicial para PostgreSQL
// Crea usuario admin y empresa Sherman si no existen

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway.internal')
    ? false
    : { rejectUnauthorized: false },
});

async function main() {
  console.log('\n🌱 Sherman Finance — Seed PostgreSQL...\n');
  const client = await pool.connect();
  try {
    // Usuario admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@shermaninmobiliaria.pe';
    const adminPass  = process.env.ADMIN_PASS  || 'Admin123!';
    const existing = await client.query('SELECT id FROM users WHERE email=$1', [adminEmail]);
    if (!existing.rows.length) {
      const hash = await bcrypt.hash(adminPass, 12);
      const id = 'u' + Math.random().toString(36).slice(2, 13);
      const now = new Date().toISOString();
      await client.query(
        `INSERT INTO users (id,name,email,password,role,"mfaEnabled",status,"createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, 'Miguel Ate', adminEmail, hash, 'Administrador', false, 'activo', now, now]
      );
      console.log(`  ✓ Admin creado: ${adminEmail}`);
    } else {
      console.log(`  ✓ Admin ya existe: ${adminEmail}`);
    }

    // Empresa Sherman
    const ruc = '20610169849';
    const existingCo = await client.query('SELECT id FROM companies WHERE ruc=$1', [ruc]);
    if (!existingCo.rows.length) {
      const id = 'sherman-inmobiliaria-01';
      const now = new Date().toISOString();
      await client.query(
        `INSERT INTO companies (id,ruc,"businessName","tradeName",regime,sector,"contactEmail","igvRate",status,"createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [id, ruc, 'SHERMAN INMOBILIARIA S.A.C.', 'Sherman', 'General', 'Inmobiliaria',
         adminEmail, 18, 'activo', now, now]
      );
      console.log(`  ✓ Empresa creada: SHERMAN INMOBILIARIA S.A.C. (${ruc})`);
    } else {
      console.log(`  ✓ Empresa ya existe: ${ruc}`);
    }

    console.log('\n✅ Seed completado\n');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('❌ Error seed:', e.message); process.exit(1); });
