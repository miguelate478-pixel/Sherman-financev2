#!/usr/bin/env node
// Sherman Finance — Seed de producción (solo primera vez)
// Usa INSERT OR IGNORE — nunca borra datos existentes
const { DatabaseSync } = require('node:sqlite');
const { randomBytes } = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');

const rawUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
const dbFile = rawUrl.replace(/^file:/, '');
const DB_PATH = path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile);

const db = new DatabaseSync(DB_PATH);
console.log('\n🌱 Verificando datos iniciales de producción...\n');

const uid = () => 'c' + randomBytes(10).toString('hex');
const now = new Date().toISOString();

// ── Usuario Administrador — ID FIJO, solo si no existe ────────────
const adminId = 'admin-sherman-01';
const adminPass = 'Sherman2026!';
const adminHash = bcrypt.hashSync(adminPass, 12);

db.prepare('INSERT OR IGNORE INTO users (id,name,email,password,role,mfaEnabled,status,companyIds,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)')
  .run(adminId, 'Miguel Ate', 'admin@shermaninmobiliaria.pe', adminHash, 'Administrador', 0, 'activo', null, now, now);

// ── Empresa Real — ID FIJO, solo si no existe ─────────────────────
const empId = 'sherman-inmobiliaria-01';
db.prepare('INSERT OR IGNORE INTO companies (id,ruc,businessName,tradeName,regime,sector,contactEmail,igvRate,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
  .run(empId, '20610169849', 'SHERMAN INMOBILIARIA S.A.C.', 'Sherman Inmobiliaria', 'General', 'Inmobiliaria', 'admin@shermaninmobiliaria.pe', 18, 'activo', now, now);

// Verificar estado actual
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
const companyCount = db.prepare('SELECT COUNT(*) as c FROM companies').get().c;
const docCount = db.prepare('SELECT COUNT(*) as c FROM documents').get().c;

console.log(`  ✓ Usuarios: ${userCount}`);
console.log(`  ✓ Empresas: ${companyCount}`);
console.log(`  ✓ Documentos: ${docCount} (datos reales preservados)`);

db.close();
console.log('\n✅ Base de datos lista — datos existentes preservados\n');
