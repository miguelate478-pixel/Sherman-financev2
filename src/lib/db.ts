import { Pool } from 'pg';

// ══════════════════════════════════════════════════════════
//  DATABASE CLIENT — pg (node-postgres)
//  Compatible with PostgreSQL (Railway, Supabase, etc.)
// ══════════════════════════════════════════════════════════

let _pool: Pool | null = null;

export function getDb(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('railway.internal')
        ? false
        : { rejectUnauthorized: false },
    });
  }
  return _pool;
}

// ── Helpers ──────────────────────────────────────────────
type Row = Record<string, unknown>;

async function queryOne(sql: string, args: unknown[] = []): Promise<Row | null> {
  const db = getDb();
  const res = await db.query(sql, args);
  return res.rows[0] ?? null;
}

async function queryAll(sql: string, args: unknown[] = []): Promise<Row[]> {
  const db = getDb();
  const res = await db.query(sql, args);
  return res.rows;
}

async function execute(sql: string, args: unknown[] = []): Promise<void> {
  const db = getDb();
  await db.query(sql, args);
}

// ── USERS ─────────────────────────────────────────────────
export async function findUserByEmail(email: string) {
  return queryOne('SELECT * FROM users WHERE email = $1', [email]);
}

export async function findUserById(id: string) {
  return queryOne('SELECT * FROM users WHERE id = $1', [id]);
}

export async function getAllUsers() {
  return queryAll('SELECT * FROM users ORDER BY "createdAt" ASC');
}

export async function updateUserLastLogin(id: string) {
  await execute('UPDATE users SET "lastLogin" = $1 WHERE id = $2', [new Date().toISOString(), id]);
}

export async function createUser(data: Row) {
  const id = 'u' + Math.random().toString(36).slice(2, 13);
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO users (id,name,email,password,role,"mfaEnabled",status,"companyIds","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, data.name, data.email, data.password, data.role ?? 'Contador',
     data.mfaEnabled ? true : false, data.status ?? 'activo',
     data.companyIds ? String(data.companyIds) : null, now, now]
  );
  return { id, ...data };
}

export async function updateUserStatus(id: string, status: string) {
  await execute('UPDATE users SET status=$1,"updatedAt"=$2 WHERE id=$3', [status, new Date().toISOString(), id]);
}

export async function updateUser(id: string, data: Row) {
  const keys = Object.keys(data);
  const sets = keys.map((k, i) => `"${k}"=$${i + 1}`).join(',');
  await execute(`UPDATE users SET ${sets},"updatedAt"=$${keys.length + 1} WHERE id=$${keys.length + 2}`,
    [...Object.values(data), new Date().toISOString(), id]);
}

// ── COMPANIES ─────────────────────────────────────────────
export async function getAllCompanies() {
  const [cos, creds] = await Promise.all([
    queryAll('SELECT * FROM companies ORDER BY "createdAt" ASC'),
    queryAll('SELECT "companyId","solUser",status,provider FROM sunat_credentials'),
  ]);
  const credMap = new Map(creds.map(c => [c.companyId as string, c]));
  return cos.map(c => ({ ...c, credential: credMap.get(c.id as string) ?? null }));
}

export async function findCompanyByRuc(ruc: string) {
  return queryOne('SELECT * FROM companies WHERE ruc=$1', [ruc]);
}

export async function findCompanyById(id: string) {
  return queryOne('SELECT * FROM companies WHERE id=$1', [id]);
}

export async function createCompany(data: Row) {
  const id = 'co' + Math.random().toString(36).slice(2, 11);
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO companies (id,ruc,"businessName","tradeName",regime,sector,"contactEmail","igvRate",status,"createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, data.ruc, data.businessName, data.tradeName ?? null, data.regime ?? 'General',
     data.sector ?? null, data.contactEmail ?? null, data.igvRate ?? 18,
     data.status ?? 'activo', now, now]
  );
  return { id, ...data };
}

export async function updateCompany(id: string, data: Row) {
  const keys = Object.keys(data);
  const sets = keys.map((k, i) => `"${k}"=$${i + 1}`).join(',');
  await execute(`UPDATE companies SET ${sets},"updatedAt"=$${keys.length + 1} WHERE id=$${keys.length + 2}`,
    [...Object.values(data), new Date().toISOString(), id]);
}

// ── CREDENTIALS ───────────────────────────────────────────
export async function getCredentialByCompany(companyId: string) {
  return queryOne('SELECT * FROM sunat_credentials WHERE "companyId"=$1', [companyId]);
}

export async function upsertCredential(companyId: string, data: Row) {
  const now = new Date().toISOString();
  const provider = process.env.SUNAT_PROVIDER === 'direct' ? 'direct' : 'mock';
  const existing = await getCredentialByCompany(companyId);
  if (existing) {
    await execute(
      `UPDATE sunat_credentials SET "solUser"=$1,"encryptedPass"=$2,iv=$3,"authTag"=$4,"clientId"=$5,
       "encClientSecret"=$6,provider=$7,status=$8,"updatedAt"=$9 WHERE "companyId"=$10`,
      [data.solUser, data.encryptedPass, data.iv, data.authTag,
       data.clientId ?? null, data.encClientSecret ?? null, provider, 'pending', now, companyId]
    );
  } else {
    const id = 'sc' + Math.random().toString(36).slice(2, 11);
    await execute(
      `INSERT INTO sunat_credentials (id,"companyId","solUser","encryptedPass",iv,"authTag","clientId",
       "encClientSecret",provider,status,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, companyId, data.solUser, data.encryptedPass, data.iv, data.authTag,
       data.clientId ?? null, data.encClientSecret ?? null, provider, 'pending', now, now]
    );
  }
}

export async function updateCredentialStatus(companyId: string, status: string) {
  await execute(
    `UPDATE sunat_credentials SET status=$1,"lastTestAt"=$2,"updatedAt"=$3 WHERE "companyId"=$4`,
    [status, new Date().toISOString(), new Date().toISOString(), companyId]
  );
}

// ── DOCUMENTS ─────────────────────────────────────────────
export async function getDocuments(filters: Record<string, string>) {
  let sql = 'SELECT * FROM documents WHERE 1=1';
  const args: unknown[] = [];
  let i = 1;
  if (filters.operation)    { sql += ` AND operation=$${i++}`;     args.push(filters.operation); }
  if (filters.companyId)    { sql += ` AND "companyId"=$${i++}`;   args.push(filters.companyId); }
  if (filters.period)       { sql += ` AND period=$${i++}`;        args.push(filters.period); }
  if (filters.workflow)     { sql += ` AND workflow=$${i++}`;      args.push(filters.workflow); }
  if (filters.concarStatus) { sql += ` AND "concarStatus"=$${i++}`;args.push(filters.concarStatus); }
  if (filters.sunatStatus)  { sql += ` AND "sunatStatus"=$${i++}`; args.push(filters.sunatStatus); }
  sql += ' ORDER BY "issueDate" DESC';
  const docList = await queryAll(sql, args);

  if (docList.length) {
    const ids = docList.map(d => d.id as string);
    const placeholders = ids.map((_, j) => `$${j + 1}`).join(',');
    const lines = await queryAll(
      `SELECT * FROM document_lines WHERE "documentId" IN (${placeholders}) ORDER BY "lineNumber" ASC`, ids
    );
    const linesByDoc = new Map<string, Row[]>();
    lines.forEach(l => {
      const id = l.documentId as string;
      if (!linesByDoc.has(id)) linesByDoc.set(id, []);
      linesByDoc.get(id)!.push(l);
    });
    docList.forEach(d => { d.lines = linesByDoc.get(d.id as string) ?? []; });
  }
  return docList;
}

export async function findDocumentById(id: string) {
  const [doc, lines] = await Promise.all([
    queryOne('SELECT * FROM documents WHERE id=$1', [id]),
    queryAll('SELECT * FROM document_lines WHERE "documentId"=$1 ORDER BY "lineNumber"', [id]),
  ]);
  if (!doc) return null;
  doc.lines = lines;
  return doc;
}

export async function createDocument(data: Row) {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO documents (id,"companyId","bulkJobId",operation,"docType",serie,number,
     "issuerRuc","issuerName","receiverRuc","receiverName","issueDate","dueDate",currency,
     base,igv,total,"hasDetraction","detractionPct","detractionAmt","sunatStatus","cdrStatus",
     workflow,"concarStatus","hasXml","hasPdf","hasCdr","xmlPath","pdfPath","cdrPath",
     "hashSha256",period,"parserStatus","aiStatus","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
             $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)`,
    [data.id, data.companyId, data.bulkJobId ?? null, data.operation, data.docType,
     data.serie, data.number, data.issuerRuc, data.issuerName, data.receiverRuc,
     data.receiverName, data.issueDate, data.dueDate ?? null, data.currency ?? 'PEN',
     data.base, data.igv, data.total, data.hasDetraction ? true : false,
     data.detractionPct ?? null, data.detractionAmt ?? null,
     data.sunatStatus ?? 'PENDIENTE', data.cdrStatus ?? 'PENDIENTE',
     data.workflow ?? 'PENDIENTE_REVISION', data.concarStatus ?? 'PENDIENTE',
     data.hasXml ? true : false, data.hasPdf ? true : false, data.hasCdr ? true : false,
     data.xmlPath ?? null, data.pdfPath ?? null, data.cdrPath ?? null,
     data.hashSha256 ?? null, data.period,
     data.parserStatus ?? 'PENDIENTE', data.aiStatus ?? 'PENDIENTE', now, now]
  );
  return data;
}

export async function updateDocument(id: string, data: Row) {
  const keys = Object.keys(data);
  const sets = keys.map((k, i) => `"${k}"=$${i + 1}`).join(',');
  await execute(`UPDATE documents SET ${sets},"updatedAt"=$${keys.length + 1} WHERE id=$${keys.length + 2}`,
    [...Object.values(data), new Date().toISOString(), id]);
}

export async function createDocumentLine(data: Row) {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO document_lines (id,"documentId","lineNumber",code,description,quantity,unit,
     "unitValue","igvAmount","lineTotal","affectType","pcgeAccount","costCenter",category,
     "iaConfidence","needsReview","isRecurrent",approved,"approvedBy","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     ON CONFLICT (id) DO NOTHING`,
    [data.id, data.documentId, data.lineNumber, data.code ?? '', data.description,
     data.quantity, data.unit ?? 'ZZ', data.unitValue, data.igvAmount, data.lineTotal,
     data.affectType ?? '10', data.pcgeAccount ?? null, data.costCenter ?? null,
     data.category ?? null, data.iaConfidence ?? 0,
     data.needsReview ? true : false, data.isRecurrent ? true : false,
     false, null, now]
  );
}

// ── BULK JOBS ─────────────────────────────────────────────
export async function createBulkJob(data: Row) {
  const id = 'bj' + Math.random().toString(36).slice(2, 11);
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO bulk_jobs (id,"companyId",operation,"periodFrom","periodTo","periodType",
     status,"totalPeriods","docsFound","docsXml","docsPdf","docsCdr",errors,"createdBy","startedAt","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [id, data.companyId, data.operation, data.periodFrom, data.periodTo,
     data.periodType ?? 'MONTHLY', 'EN_PROCESO', data.totalPeriods ?? 0,
     0, 0, 0, 0, 0, data.createdBy ?? 'system', now, now]
  );
  return id;
}

export async function createBulkJobPeriod(data: Row) {
  const id = 'bjp' + Math.random().toString(36).slice(2, 10);
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO bulk_job_periods (id,"jobId",period,operation,status,"startedAt","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, data.jobId, data.period, data.operation, 'EN_PROCESO', now, now]
  );
  return id;
}

export async function updateBulkJob(id: string, data: Row) {
  const keys = Object.keys(data);
  const sets = keys.map((k, i) => `"${k}"=$${i + 1}`).join(',');
  await execute(`UPDATE bulk_jobs SET ${sets} WHERE id=$${keys.length + 1}`,
    [...Object.values(data), id]);
}

export async function updateBulkJobPeriod(id: string, data: Row) {
  const keys = Object.keys(data);
  const sets = keys.map((k, i) => `"${k}"=$${i + 1}`).join(',');
  await execute(`UPDATE bulk_job_periods SET ${sets} WHERE id=$${keys.length + 1}`,
    [...Object.values(data), id]);
}

export async function getBulkJobs(companyId?: string) {
  const [jobs, periods] = await Promise.all([
    companyId
      ? queryAll('SELECT * FROM bulk_jobs WHERE "companyId"=$1 ORDER BY "createdAt" DESC LIMIT 50', [companyId])
      : queryAll('SELECT * FROM bulk_jobs ORDER BY "createdAt" DESC LIMIT 50'),
    queryAll('SELECT * FROM bulk_job_periods ORDER BY "createdAt" ASC'),
  ]);
  const periodsByJob = new Map<string, Row[]>();
  periods.forEach(p => {
    const jid = p.jobId as string;
    if (!periodsByJob.has(jid)) periodsByJob.set(jid, []);
    periodsByJob.get(jid)!.push(p);
  });
  return jobs.map(j => ({ ...j, periods: periodsByJob.get(j.id as string) ?? [] }));
}

// ── BANKS ─────────────────────────────────────────────────
export async function getBankMovements(companyId?: string) {
  return companyId
    ? queryAll('SELECT * FROM bank_movements WHERE "companyId"=$1 ORDER BY date ASC', [companyId])
    : queryAll('SELECT * FROM bank_movements ORDER BY date ASC');
}

export async function updateBankMovement(id: string, matchDocId: string, matchName: string) {
  await execute('UPDATE bank_movements SET reconciled=true,"matchDocId"=$1,"matchName"=$2 WHERE id=$3',
    [matchDocId, matchName, id]);
}

// ── DETRACCIONES ──────────────────────────────────────────
export async function getDetracciones(companyId?: string) {
  return companyId
    ? queryAll('SELECT * FROM detractions WHERE "companyId"=$1', [companyId])
    : queryAll('SELECT * FROM detractions');
}

export async function updateDetraccion(documentId: string) {
  const today = new Date().toISOString().slice(0, 10);
  await execute(`UPDATE detractions SET status='DEPOSITADO',"depositDate"=$1 WHERE "documentId"=$2`,
    [today, documentId]);
  return today;
}

// ── CONCAR ────────────────────────────────────────────────
export async function createConcarBatch(data: Row, items: string[]) {
  const id = 'cb' + Math.random().toString(36).slice(2, 11);
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO concar_batches (id,"companyId",period,status,"docsCount","exportedBy","hashLote","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, data.companyId, data.period, 'PREPARADO', items.length, data.exportedBy, data.hashLote ?? null, now]
  );
  for (const docId of items) {
    const iid = 'cbi' + Math.random().toString(36).slice(2, 10);
    await execute(
      `INSERT INTO concar_batch_items (id,"batchId","documentId",status,"createdAt") VALUES ($1,$2,$3,$4,$5)`,
      [iid, id, docId, 'INCLUIDO', now]
    );
  }
  return id;
}

export async function getConcarBatches() {
  return queryAll('SELECT * FROM concar_batches ORDER BY "createdAt" DESC LIMIT 30');
}

export async function approveConcarBatch(id: string, approvedBy: string) {
  const now = new Date().toISOString();
  await execute(
    `UPDATE concar_batches SET status='EXPORTADO',"approvedBy"=$1,"approvedAt"=$2,"exportedAt"=$3 WHERE id=$4`,
    [approvedBy, now, now, id]
  );
  const items = await queryAll('SELECT "documentId" FROM concar_batch_items WHERE "batchId"=$1', [id]);
  for (const item of items) {
    await execute(`UPDATE documents SET "concarStatus"='EXPORTADO' WHERE id=$1`, [item.documentId]);
  }
}

// ── AUDIT ─────────────────────────────────────────────────
export async function getAuditLogs() {
  return queryAll('SELECT * FROM audit_logs ORDER BY "createdAt" DESC LIMIT 300');
}

export async function createAuditLog(data: Row) {
  const id = 'al' + Math.random().toString(36).slice(2, 11);
  await execute(
    `INSERT INTO audit_logs (id,"userId","userEmail","userRole",action,object,meta,ip,"createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, data.userId ?? null, data.userEmail, data.userRole, data.action,
     data.object ?? null, data.meta ?? null, data.ip ?? null, new Date().toISOString()]
  );
}

// ── CXC / CXP ─────────────────────────────────────────────
export async function getCxc(companyId?: string) {
  return companyId
    ? queryAll('SELECT * FROM cxc_records WHERE "companyId"=$1 ORDER BY "dueDate"', [companyId])
    : queryAll('SELECT * FROM cxc_records ORDER BY "dueDate"');
}

export async function getCxp(companyId?: string) {
  return companyId
    ? queryAll('SELECT * FROM cxp_records WHERE "companyId"=$1 ORDER BY "dueDate"', [companyId])
    : queryAll('SELECT * FROM cxp_records ORDER BY "dueDate"');
}

export async function markCxcPaid(id: string, amount: number) {
  const today = new Date().toISOString().slice(0, 10);
  await execute(`UPDATE cxc_records SET status='COBRADO',"paidDate"=$1,"paidAmount"=$2 WHERE id=$3`,
    [today, amount, id]);
}

export async function markCxpPaid(id: string, amount: number) {
  const today = new Date().toISOString().slice(0, 10);
  await execute(`UPDATE cxp_records SET status='PAGADO',"paidDate"=$1,"paidAmount"=$2 WHERE id=$3`,
    [today, amount, id]);
}

// ── CXC / CXP / DETRACCIONES - CREATE ────────────────────
export async function createCxcRecord(data: {
  id: string;
  companyId: string;
  documentId: string;
  clientRuc: string;
  clientName: string;
  amount: number;
  dueDate: string;
  status: string;
}) {
  await execute(
    `INSERT INTO cxc_records (id, "companyId", "documentId", "clientRuc", "clientName", amount, "dueDate", status, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [data.id, data.companyId, data.documentId, data.clientRuc, data.clientName, data.amount, data.dueDate, data.status]
  );
}

export async function findCxcByDocId(documentId: string) {
  const rows = await queryAll('SELECT * FROM cxc_records WHERE "documentId"=$1', [documentId]);
  return rows[0] || null;
}

export async function createCxpRecord(data: {
  id: string;
  companyId: string;
  documentId: string;
  providerRuc: string;
  providerName: string;
  amount: number;
  dueDate: string;
  status: string;
}) {
  await execute(
    `INSERT INTO cxp_records (id, "companyId", "documentId", "providerRuc", "providerName", amount, "dueDate", status, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [data.id, data.companyId, data.documentId, data.providerRuc, data.providerName, data.amount, data.dueDate, data.status]
  );
}

export async function findCxpByDocId(documentId: string) {
  const rows = await queryAll('SELECT * FROM cxp_records WHERE "documentId"=$1', [documentId]);
  return rows[0] || null;
}

export async function createDetraccion(data: {
  id: string;
  companyId: string;
  documentId: string;
  provider: string;
  provRuc: string;
  amount: number;
  pct: number;
  code: string;
  account: string;
  status: string;
}) {
  await execute(
    `INSERT INTO detractions (id, "companyId", "documentId", provider, "provRuc", amount, pct, code, account, status, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [data.id, data.companyId, data.documentId, data.provider, data.provRuc, data.amount, data.pct, data.code, data.account, data.status]
  );
}

export async function findDetraccionByDocId(documentId: string) {
  const rows = await queryAll('SELECT * FROM detractions WHERE "documentId"=$1', [documentId]);
  return rows[0] || null;
}

// ── REPORTS ───────────────────────────────────────────────
export async function getReportData(companyId: string, period: string) {
  const [docs, lines] = await Promise.all([
    queryAll('SELECT * FROM documents WHERE "companyId"=$1 AND period=$2', [companyId, period]),
    queryAll(
      `SELECT dl.* FROM document_lines dl
       JOIN documents d ON dl."documentId"=d.id
       WHERE d."companyId"=$1 AND d.period=$2`, [companyId, period]
    ),
  ]);
  return { docs, lines };
}
