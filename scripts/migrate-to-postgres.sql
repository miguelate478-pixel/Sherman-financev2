-- ═══════════════════════════════════════════════════
-- SHERMAN FINANCE CONTROL AI v2.0
-- Script de migración SQLite → PostgreSQL
-- Ejecutar con: psql $DATABASE_URL -f scripts/migrate-to-postgres.sql
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, role TEXT DEFAULT 'Contador', "mfaEnabled" BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'activo', "lastLogin" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(), "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY, ruc TEXT UNIQUE NOT NULL, "businessName" TEXT NOT NULL,
  "tradeName" TEXT, regime TEXT DEFAULT 'General', sector TEXT, "contactEmail" TEXT,
  "igvRate" INTEGER DEFAULT 18, status TEXT DEFAULT 'activo',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(), "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sunat_credentials (
  id TEXT PRIMARY KEY, "companyId" TEXT UNIQUE NOT NULL, "solUser" TEXT NOT NULL,
  "encryptedPass" TEXT NOT NULL, iv TEXT NOT NULL, "authTag" TEXT NOT NULL,
  "clientId" TEXT, "encClientSecret" TEXT, provider TEXT DEFAULT 'mock',
  status TEXT DEFAULT 'pending', "lastTestAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(), "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY ("companyId") REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS bulk_jobs (
  id TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, operation TEXT NOT NULL,
  "periodFrom" TEXT NOT NULL, "periodTo" TEXT NOT NULL, "periodType" TEXT DEFAULT 'MONTHLY',
  status TEXT DEFAULT 'PENDIENTE', "totalPeriods" INTEGER DEFAULT 0,
  "docsFound" INTEGER DEFAULT 0, "docsXml" INTEGER DEFAULT 0,
  "docsPdf" INTEGER DEFAULT 0, "docsCdr" INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0, "createdBy" TEXT, "startedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY ("companyId") REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS bulk_job_periods (
  id TEXT PRIMARY KEY, "jobId" TEXT NOT NULL, period TEXT NOT NULL,
  operation TEXT NOT NULL, status TEXT DEFAULT 'PENDIENTE',
  "docsFound" INTEGER DEFAULT 0, "docsXml" INTEGER DEFAULT 0,
  "docsPdf" INTEGER DEFAULT 0, "docsCdr" INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0, "startedAt" TIMESTAMPTZ, "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY ("jobId") REFERENCES bulk_jobs(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "bulkJobId" TEXT,
  operation TEXT NOT NULL, "docType" TEXT NOT NULL, serie TEXT NOT NULL,
  number TEXT NOT NULL, "issuerRuc" TEXT NOT NULL, "issuerName" TEXT NOT NULL,
  "receiverRuc" TEXT NOT NULL, "receiverName" TEXT NOT NULL, "issueDate" TEXT NOT NULL,
  "dueDate" TEXT, currency TEXT DEFAULT 'PEN', base NUMERIC NOT NULL,
  igv NUMERIC NOT NULL, total NUMERIC NOT NULL,
  "hasDetraction" BOOLEAN DEFAULT false, "detractionPct" INTEGER, "detractionAmt" NUMERIC,
  "sunatStatus" TEXT DEFAULT 'PENDIENTE', "cdrStatus" TEXT DEFAULT 'PENDIENTE',
  workflow TEXT DEFAULT 'PENDIENTE_REVISION', "concarStatus" TEXT DEFAULT 'PENDIENTE',
  "hasXml" BOOLEAN DEFAULT false, "hasPdf" BOOLEAN DEFAULT false, "hasCdr" BOOLEAN DEFAULT false,
  "xmlPath" TEXT, "pdfPath" TEXT, "cdrPath" TEXT, "hashSha256" TEXT, period TEXT NOT NULL,
  "parserStatus" TEXT DEFAULT 'PENDIENTE', "aiStatus" TEXT DEFAULT 'PENDIENTE',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(), "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY ("companyId") REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS document_lines (
  id TEXT PRIMARY KEY, "documentId" TEXT NOT NULL, "lineNumber" INTEGER NOT NULL,
  code TEXT, description TEXT NOT NULL, quantity NUMERIC NOT NULL, unit TEXT DEFAULT 'ZZ',
  "unitValue" NUMERIC NOT NULL, "igvAmount" NUMERIC NOT NULL, "lineTotal" NUMERIC NOT NULL,
  "affectType" TEXT DEFAULT '10', "pcgeAccount" TEXT, "costCenter" TEXT, category TEXT,
  "iaConfidence" INTEGER DEFAULT 0, "needsReview" BOOLEAN DEFAULT false,
  "isRecurrent" BOOLEAN DEFAULT false, approved BOOLEAN DEFAULT false, "approvedBy" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY ("documentId") REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS document_files (
  id TEXT PRIMARY KEY, "documentId" TEXT NOT NULL, "fileType" TEXT NOT NULL,
  "originalName" TEXT NOT NULL, "storedName" TEXT NOT NULL, "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER DEFAULT 0, "storagePath" TEXT NOT NULL, hash TEXT,
  "uploadedAt" TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY ("documentId") REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS bank_movements (
  id TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, date TEXT NOT NULL,
  description TEXT NOT NULL, type TEXT NOT NULL, amount NUMERIC NOT NULL,
  balance NUMERIC NOT NULL, reconciled BOOLEAN DEFAULT false,
  "matchDocId" TEXT, "matchName" TEXT, "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY ("companyId") REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS detractions (
  id TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "documentId" TEXT NOT NULL,
  provider TEXT NOT NULL, "provRuc" TEXT NOT NULL, amount NUMERIC NOT NULL,
  pct INTEGER NOT NULL, code TEXT NOT NULL, account TEXT NOT NULL,
  status TEXT DEFAULT 'PENDIENTE', "depositDate" TEXT, "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS concar_connections (
  id TEXT PRIMARY KEY, "companyId" TEXT UNIQUE NOT NULL, server TEXT, database TEXT,
  "encUser" TEXT, "encPass" TEXT, mode TEXT DEFAULT 'mock', status TEXT DEFAULT 'desconectado',
  "lastTestAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ DEFAULT NOW(), "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY ("companyId") REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS concar_batches (
  id TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, period TEXT NOT NULL,
  status TEXT DEFAULT 'PREPARADO', "docsCount" INTEGER DEFAULT 0, "exportedBy" TEXT NOT NULL,
  "exportedAt" TIMESTAMPTZ, "hashLote" TEXT, "approvedBy" TEXT, "approvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS concar_batch_items (
  id TEXT PRIMARY KEY, "batchId" TEXT NOT NULL, "documentId" TEXT NOT NULL,
  account TEXT, "costCenter" TEXT, debit NUMERIC, credit NUMERIC,
  status TEXT DEFAULT 'INCLUIDO', "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY ("batchId") REFERENCES concar_batches(id),
  FOREIGN KEY ("documentId") REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, "userId" TEXT, "userEmail" TEXT NOT NULL, "userRole" TEXT NOT NULL,
  action TEXT NOT NULL, object TEXT, meta TEXT, ip TEXT, "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cxc_records (
  id TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "documentId" TEXT, "clientRuc" TEXT NOT NULL,
  "clientName" TEXT NOT NULL, amount NUMERIC NOT NULL, "dueDate" TEXT NOT NULL,
  status TEXT DEFAULT 'PENDIENTE', "paidDate" TEXT, "paidAmount" NUMERIC, "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cxp_records (
  id TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "documentId" TEXT, "providerRuc" TEXT NOT NULL,
  "providerName" TEXT NOT NULL, amount NUMERIC NOT NULL, "dueDate" TEXT NOT NULL,
  status TEXT DEFAULT 'PENDIENTE', "paidDate" TEXT, "paidAmount" NUMERIC, "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_documents_company_period ON documents("companyId", period);
CREATE INDEX IF NOT EXISTS idx_documents_sunat_status ON documents("sunatStatus");
CREATE INDEX IF NOT EXISTS idx_document_lines_doc ON document_lines("documentId");
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_bank_company ON bank_movements("companyId");
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_company ON bulk_jobs("companyId");
