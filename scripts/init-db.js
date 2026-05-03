#!/usr/bin/env node
// Sherman Finance — Inicialización de base de datos SQLite
// No requiere Prisma ni binarios adicionales — usa node:sqlite (Node 22+)

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(process.cwd(), 'prisma', 'dev.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
console.log('\n🗄  Inicializando base de datos SQLite...\n');

const TABLES = [
`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, role TEXT DEFAULT 'Contador', mfaEnabled INTEGER DEFAULT 0,
  status TEXT DEFAULT 'activo', lastLogin TEXT, mfaSecret TEXT, resetToken TEXT, resetExpires TEXT,
  companyIds TEXT DEFAULT NULL,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`,
`CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY, ruc TEXT UNIQUE NOT NULL, businessName TEXT NOT NULL,
  tradeName TEXT, regime TEXT DEFAULT 'General', sector TEXT, contactEmail TEXT,
  igvRate INTEGER DEFAULT 18, status TEXT DEFAULT 'activo',
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')))`,
`CREATE TABLE IF NOT EXISTS sunat_credentials (
  id TEXT PRIMARY KEY, companyId TEXT UNIQUE NOT NULL, solUser TEXT NOT NULL,
  encryptedPass TEXT NOT NULL, iv TEXT NOT NULL, authTag TEXT NOT NULL,
  clientId TEXT, encClientSecret TEXT, provider TEXT DEFAULT 'mock',
  status TEXT DEFAULT 'pending', lastTestAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (companyId) REFERENCES companies(id))`,
`CREATE TABLE IF NOT EXISTS bulk_jobs (
  id TEXT PRIMARY KEY, companyId TEXT NOT NULL, operation TEXT NOT NULL,
  periodFrom TEXT NOT NULL, periodTo TEXT NOT NULL, periodType TEXT DEFAULT 'MONTHLY',
  status TEXT DEFAULT 'PENDIENTE', totalPeriods INTEGER DEFAULT 0,
  docsFound INTEGER DEFAULT 0, docsXml INTEGER DEFAULT 0, docsPdf INTEGER DEFAULT 0,
  docsCdr INTEGER DEFAULT 0, errors INTEGER DEFAULT 0, createdBy TEXT,
  startedAt TEXT, completedAt TEXT, createdAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (companyId) REFERENCES companies(id))`,
`CREATE TABLE IF NOT EXISTS bulk_job_periods (
  id TEXT PRIMARY KEY, jobId TEXT NOT NULL, period TEXT NOT NULL, operation TEXT NOT NULL,
  status TEXT DEFAULT 'PENDIENTE', docsFound INTEGER DEFAULT 0, docsXml INTEGER DEFAULT 0,
  docsPdf INTEGER DEFAULT 0, docsCdr INTEGER DEFAULT 0, errors INTEGER DEFAULT 0,
  startedAt TEXT, completedAt TEXT, createdAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (jobId) REFERENCES bulk_jobs(id))`,
`CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, companyId TEXT NOT NULL, bulkJobId TEXT, operation TEXT NOT NULL,
  docType TEXT NOT NULL, serie TEXT NOT NULL, number TEXT NOT NULL,
  issuerRuc TEXT NOT NULL, issuerName TEXT NOT NULL, receiverRuc TEXT NOT NULL,
  receiverName TEXT NOT NULL, issueDate TEXT NOT NULL, dueDate TEXT,
  currency TEXT DEFAULT 'PEN', base REAL NOT NULL, igv REAL NOT NULL, total REAL NOT NULL,
  hasDetraction INTEGER DEFAULT 0, detractionPct INTEGER, detractionAmt REAL,
  sunatStatus TEXT DEFAULT 'PENDIENTE', cdrStatus TEXT DEFAULT 'PENDIENTE',
  workflow TEXT DEFAULT 'PENDIENTE_REVISION', concarStatus TEXT DEFAULT 'PENDIENTE',
  hasXml INTEGER DEFAULT 0, hasPdf INTEGER DEFAULT 0, hasCdr INTEGER DEFAULT 0,
  xmlPath TEXT, pdfPath TEXT, cdrPath TEXT, hashSha256 TEXT, period TEXT NOT NULL,
  parserStatus TEXT DEFAULT 'PENDIENTE', aiStatus TEXT DEFAULT 'PENDIENTE',
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (companyId) REFERENCES companies(id))`,
`CREATE TABLE IF NOT EXISTS document_lines (
  id TEXT PRIMARY KEY, documentId TEXT NOT NULL, lineNumber INTEGER NOT NULL,
  code TEXT, description TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT DEFAULT 'ZZ',
  unitValue REAL NOT NULL, igvAmount REAL NOT NULL, lineTotal REAL NOT NULL,
  affectType TEXT DEFAULT '10', pcgeAccount TEXT, costCenter TEXT, category TEXT,
  iaConfidence INTEGER DEFAULT 0, needsReview INTEGER DEFAULT 0, isRecurrent INTEGER DEFAULT 0,
  approved INTEGER DEFAULT 0, approvedBy TEXT, createdAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (documentId) REFERENCES documents(id))`,
`CREATE TABLE IF NOT EXISTS document_files (
  id TEXT PRIMARY KEY, documentId TEXT NOT NULL, fileType TEXT NOT NULL,
  originalName TEXT NOT NULL, storedName TEXT NOT NULL, mimeType TEXT NOT NULL,
  sizeBytes INTEGER DEFAULT 0, storagePath TEXT NOT NULL, hash TEXT,
  uploadedAt TEXT DEFAULT (datetime('now')), FOREIGN KEY (documentId) REFERENCES documents(id))`,
`CREATE TABLE IF NOT EXISTS bank_movements (
  id TEXT PRIMARY KEY, companyId TEXT NOT NULL, date TEXT NOT NULL,
  description TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, balance REAL NOT NULL,
  reconciled INTEGER DEFAULT 0, matchDocId TEXT, matchName TEXT,
  createdAt TEXT DEFAULT (datetime('now')), FOREIGN KEY (companyId) REFERENCES companies(id))`,
`CREATE TABLE IF NOT EXISTS detractions (
  id TEXT PRIMARY KEY, companyId TEXT NOT NULL, documentId TEXT NOT NULL,
  provider TEXT NOT NULL, provRuc TEXT NOT NULL, amount REAL NOT NULL, pct INTEGER NOT NULL,
  code TEXT NOT NULL, account TEXT NOT NULL, status TEXT DEFAULT 'PENDIENTE',
  depositDate TEXT, createdAt TEXT DEFAULT (datetime('now')))`,
`CREATE TABLE IF NOT EXISTS concar_connections (
  id TEXT PRIMARY KEY, companyId TEXT UNIQUE NOT NULL, server TEXT, database TEXT,
  encUser TEXT, encPass TEXT, mode TEXT DEFAULT 'mock', status TEXT DEFAULT 'desconectado',
  lastTestAt TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (companyId) REFERENCES companies(id))`,
`CREATE TABLE IF NOT EXISTS concar_batches (
  id TEXT PRIMARY KEY, companyId TEXT NOT NULL, period TEXT NOT NULL,
  status TEXT DEFAULT 'PREPARADO', docsCount INTEGER DEFAULT 0, exportedBy TEXT NOT NULL,
  exportedAt TEXT, hashLote TEXT, approvedBy TEXT, approvedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')))`,
`CREATE TABLE IF NOT EXISTS concar_batch_items (
  id TEXT PRIMARY KEY, batchId TEXT NOT NULL, documentId TEXT NOT NULL,
  account TEXT, costCenter TEXT, debit REAL, credit REAL, status TEXT DEFAULT 'INCLUIDO',
  createdAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (batchId) REFERENCES concar_batches(id), FOREIGN KEY (documentId) REFERENCES documents(id))`,
`CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, userId TEXT, userEmail TEXT NOT NULL, userRole TEXT NOT NULL,
  action TEXT NOT NULL, object TEXT, meta TEXT, ip TEXT,
  createdAt TEXT DEFAULT (datetime('now')))`,
`CREATE TABLE IF NOT EXISTS cxc_records (
  id TEXT PRIMARY KEY, companyId TEXT NOT NULL, documentId TEXT, clientRuc TEXT NOT NULL,
  clientName TEXT NOT NULL, amount REAL NOT NULL, dueDate TEXT NOT NULL,
  status TEXT DEFAULT 'PENDIENTE', paidDate TEXT, paidAmount REAL,
  createdAt TEXT DEFAULT (datetime('now')))`,
`CREATE TABLE IF NOT EXISTS cxp_records (
  id TEXT PRIMARY KEY, companyId TEXT NOT NULL, documentId TEXT, providerRuc TEXT NOT NULL,
  providerName TEXT NOT NULL, amount REAL NOT NULL, dueDate TEXT NOT NULL,
  status TEXT DEFAULT 'PENDIENTE', paidDate TEXT, paidAmount REAL,
  createdAt TEXT DEFAULT (datetime('now')))`,
];

TABLES.forEach(sql => {
  try { db.exec(sql); } catch(e) { if (!e.message?.includes('already exists')) console.error('Error:', e.message); }
});

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('  Tablas creadas:', tables.length);
tables.forEach(t => console.log('   ✓', t.name));
db.close();
console.log('\n✅ Base de datos inicializada en prisma/dev.db\n');
