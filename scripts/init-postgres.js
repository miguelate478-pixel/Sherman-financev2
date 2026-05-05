#!/usr/bin/env node
// Sherman Finance — Inicialización de base de datos PostgreSQL

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway.internal')
    ? false
    : { rejectUnauthorized: false },
});

const TABLES = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'Contador',
  "mfaEnabled" BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'activo',
  "lastLogin" TEXT,
  "mfaSecret" TEXT,
  "resetToken" TEXT,
  "resetExpires" TEXT,
  "companyIds" TEXT DEFAULT NULL,
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  "updatedAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  ruc TEXT UNIQUE NOT NULL,
  "businessName" TEXT NOT NULL,
  "tradeName" TEXT,
  regime TEXT DEFAULT 'General',
  sector TEXT,
  "contactEmail" TEXT,
  "igvRate" INTEGER DEFAULT 18,
  status TEXT DEFAULT 'activo',
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  "updatedAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS sunat_credentials (
  id TEXT PRIMARY KEY,
  "companyId" TEXT UNIQUE NOT NULL REFERENCES companies(id),
  "solUser" TEXT NOT NULL,
  "encryptedPass" TEXT NOT NULL,
  iv TEXT NOT NULL,
  "authTag" TEXT NOT NULL,
  "clientId" TEXT,
  "encClientSecret" TEXT,
  provider TEXT DEFAULT 'mock',
  status TEXT DEFAULT 'pending',
  "lastTestAt" TEXT,
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  "updatedAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS bulk_jobs (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES companies(id),
  operation TEXT NOT NULL,
  "periodFrom" TEXT NOT NULL,
  "periodTo" TEXT NOT NULL,
  "periodType" TEXT DEFAULT 'MONTHLY',
  status TEXT DEFAULT 'PENDIENTE',
  "totalPeriods" INTEGER DEFAULT 0,
  "docsFound" INTEGER DEFAULT 0,
  "docsXml" INTEGER DEFAULT 0,
  "docsPdf" INTEGER DEFAULT 0,
  "docsCdr" INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  "createdBy" TEXT,
  "startedAt" TEXT,
  "completedAt" TEXT,
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS bulk_job_periods (
  id TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL REFERENCES bulk_jobs(id),
  period TEXT NOT NULL,
  operation TEXT NOT NULL,
  status TEXT DEFAULT 'PENDIENTE',
  "docsFound" INTEGER DEFAULT 0,
  "docsXml" INTEGER DEFAULT 0,
  "docsPdf" INTEGER DEFAULT 0,
  "docsCdr" INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  "startedAt" TEXT,
  "completedAt" TEXT,
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES companies(id),
  "bulkJobId" TEXT,
  operation TEXT NOT NULL,
  "docType" TEXT NOT NULL,
  serie TEXT NOT NULL,
  number TEXT NOT NULL,
  "issuerRuc" TEXT NOT NULL,
  "issuerName" TEXT NOT NULL,
  "receiverRuc" TEXT NOT NULL,
  "receiverName" TEXT NOT NULL,
  "issueDate" TEXT NOT NULL,
  "dueDate" TEXT,
  currency TEXT DEFAULT 'PEN',
  base REAL NOT NULL,
  igv REAL NOT NULL,
  total REAL NOT NULL,
  "hasDetraction" BOOLEAN DEFAULT false,
  "detractionPct" INTEGER,
  "detractionAmt" REAL,
  "sunatStatus" TEXT DEFAULT 'PENDIENTE',
  "cdrStatus" TEXT DEFAULT 'PENDIENTE',
  workflow TEXT DEFAULT 'PENDIENTE_REVISION',
  "concarStatus" TEXT DEFAULT 'PENDIENTE',
  "hasXml" BOOLEAN DEFAULT false,
  "hasPdf" BOOLEAN DEFAULT false,
  "hasCdr" BOOLEAN DEFAULT false,
  "xmlPath" TEXT,
  "pdfPath" TEXT,
  "cdrPath" TEXT,
  "hashSha256" TEXT,
  period TEXT NOT NULL,
  "parserStatus" TEXT DEFAULT 'PENDIENTE',
  "aiStatus" TEXT DEFAULT 'PENDIENTE',
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  "updatedAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS document_lines (
  id TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  "lineNumber" INTEGER NOT NULL,
  code TEXT,
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT DEFAULT 'ZZ',
  "unitValue" REAL NOT NULL,
  "igvAmount" REAL NOT NULL,
  "lineTotal" REAL NOT NULL,
  "affectType" TEXT DEFAULT '10',
  "pcgeAccount" TEXT,
  "costCenter" TEXT,
  category TEXT,
  "iaConfidence" INTEGER DEFAULT 0,
  "needsReview" BOOLEAN DEFAULT false,
  "isRecurrent" BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT false,
  "approvedBy" TEXT,
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS document_files (
  id TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  "fileType" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storedName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER DEFAULT 0,
  "storagePath" TEXT NOT NULL,
  hash TEXT,
  "uploadedAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS bank_movements (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES companies(id),
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  balance REAL NOT NULL,
  reconciled BOOLEAN DEFAULT false,
  "matchDocId" TEXT,
  "matchName" TEXT,
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS detractions (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  provider TEXT NOT NULL,
  "provRuc" TEXT NOT NULL,
  amount REAL NOT NULL,
  pct INTEGER NOT NULL,
  code TEXT NOT NULL,
  account TEXT NOT NULL,
  status TEXT DEFAULT 'PENDIENTE',
  "depositDate" TEXT,
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS concar_connections (
  id TEXT PRIMARY KEY,
  "companyId" TEXT UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  server TEXT,
  database TEXT,
  "encUser" TEXT,
  "encPass" TEXT,
  mode TEXT DEFAULT 'mock',
  status TEXT DEFAULT 'desconectado',
  "lastTestAt" TEXT,
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  "updatedAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS concar_batches (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  period TEXT NOT NULL,
  status TEXT DEFAULT 'PREPARADO',
  "docsCount" INTEGER DEFAULT 0,
  "exportedBy" TEXT NOT NULL,
  "exportedAt" TEXT,
  "hashLote" TEXT,
  "approvedBy" TEXT,
  "approvedAt" TEXT,
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS concar_batch_items (
  id TEXT PRIMARY KEY,
  "batchId" TEXT NOT NULL REFERENCES concar_batches(id),
  "documentId" TEXT NOT NULL REFERENCES documents(id),
  account TEXT,
  "costCenter" TEXT,
  debit REAL,
  credit REAL,
  status TEXT DEFAULT 'INCLUIDO',
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  "userId" TEXT,
  "userEmail" TEXT NOT NULL,
  "userRole" TEXT NOT NULL,
  action TEXT NOT NULL,
  object TEXT,
  meta TEXT,
  ip TEXT,
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS cxc_records (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "documentId" TEXT,
  "clientRuc" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  amount REAL NOT NULL,
  "dueDate" TEXT NOT NULL,
  status TEXT DEFAULT 'PENDIENTE',
  "paidDate" TEXT,
  "paidAmount" REAL,
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS cxp_records (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "documentId" TEXT,
  "providerRuc" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  amount REAL NOT NULL,
  "dueDate" TEXT NOT NULL,
  status TEXT DEFAULT 'PENDIENTE',
  "paidDate" TEXT,
  "paidAmount" REAL,
  "createdAt" TEXT DEFAULT to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);
`;

async function main() {
  console.log('\n🗄  Inicializando base de datos PostgreSQL...\n');
  const client = await pool.connect();
  try {
    await client.query(TABLES);
    const res = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
    console.log('  Tablas creadas:', res.rows.length);
    res.rows.forEach(r => console.log('   ✓', r.tablename));
    console.log('\n✅ Base de datos PostgreSQL inicializada\n');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
