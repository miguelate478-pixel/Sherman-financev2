#!/usr/bin/env node
// Sherman Finance — Seed de producción (datos reales, sin demo)
const { DatabaseSync } = require('node:sqlite');
const { randomBytes } = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');

const rawUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
const dbFile = rawUrl.replace(/^file:/, '');
const DB_PATH = path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile);

const db = new DatabaseSync(DB_PATH);
console.log('\n🌱 Inicializando base de datos de producción...\n');

const uid = () => 'c' + randomBytes(10).toString('hex');
const now = new Date().toISOString();

// ── Limpiar datos demo si existen ─────────────────────────
console.log('🗑  Limpiando datos demo...');
db.exec("DELETE FROM document_lines WHERE documentId IN (SELECT id FROM documents)");
db.exec("DELETE FROM document_files WHERE documentId IN (SELECT id FROM documents)");
db.exec("DELETE FROM concar_batch_items");
db.exec("DELETE FROM concar_batches");
db.exec("DELETE FROM documents");
db.exec("DELETE FROM bank_movements");
db.exec("DELETE FROM detractions");
db.exec("DELETE FROM cxc_records");
db.exec("DELETE FROM cxp_records");
db.exec("DELETE FROM bulk_job_periods");
db.exec("DELETE FROM bulk_jobs");
db.exec("DELETE FROM sunat_credentials");
db.exec("DELETE FROM concar_connections");
db.exec("DELETE FROM companies");
db.exec("DELETE FROM audit_logs");
db.exec("DELETE FROM users");
console.log('  ✓ Base de datos limpia\n');

// ── Usuario Administrador ──────────────────────────────────
const adminId = uid();
const adminPass = 'Sherman2026!';
const adminHash = bcrypt.hashSync(adminPass, 12);

db.prepare('INSERT INTO users (id,name,email,password,role,mfaEnabled,status,companyIds,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)')
  .run(adminId, 'Miguel Ate', 'admin@shermaninmobiliaria.pe', adminHash, 'Administrador', 0, 'activo', null, now, now);

console.log('  ✓ Usuario administrador creado');

// ── Empresa Real ───────────────────────────────────────────
const empId = uid();
db.prepare('INSERT INTO companies (id,ruc,businessName,tradeName,regime,sector,contactEmail,igvRate,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
  .run(empId, '20610169849', 'SHERMAN INMOBILIARIA S.A.C.', 'Sherman Inmobiliaria', 'General', 'Inmobiliaria', 'admin@shermaninmobiliaria.pe', 18, 'activo', now, now);

console.log('  ✓ Empresa SHERMAN INMOBILIARIA S.A.C. creada');

// ── Log de auditoría ───────────────────────────────────────
db.prepare('INSERT INTO audit_logs (id,userId,userEmail,userRole,action,object,ip,createdAt) VALUES (?,?,?,?,?,?,?,?)')
  .run(uid(), adminId, 'admin@shermaninmobiliaria.pe', 'Administrador', 'SISTEMA_INICIALIZADO', 'Producción v2.0', '127.0.0.1', now);

db.close();

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Base de datos de producción lista!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🏢 Empresa: SHERMAN INMOBILIARIA S.A.C. (20610169849)');
console.log('🔑 Admin:   admin@shermaninmobiliaria.pe');
console.log('🔑 Pass:    Sherman2026!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
