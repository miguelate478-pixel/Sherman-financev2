import { createClient } from '@libsql/client';
import type { Client, ResultSet } from '@libsql/client';

// ══════════════════════════════════════════════════════════
//  DATABASE CLIENT — @libsql/client (no binary download needed)
//  Compatible with SQLite local + Turso cloud
// ══════════════════════════════════════════════════════════

// Type helper: cast unknown to libsql-compatible InValue
type InVal = string | number | boolean | null;
function v(val: unknown): InVal {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
  return String(val);
}
// Cast array of unknowns
function args(...vals: unknown[]): InVal[] { return vals.map(v); }


let _client: Client | null = null;

export function getDb(): Client {
  if (!_client) {
    const url = process.env.DATABASE_URL || 'file:prisma/dev.db';
    const authToken = process.env.TURSO_AUTH_TOKEN;
    _client = createClient(authToken ? { url, authToken } : { url });
  }
  return _client;
}

// ── Helpers ──────────────────────────────────────────────
export function row(rs: ResultSet): Record<string, unknown> | null {
  if (!rs.rows.length) return null;
  return Object.fromEntries(rs.columns.map((c, i) => [c, rs.rows[0][i]]));
}

export function rows(rs: ResultSet): Record<string, unknown>[] {
  return rs.rows.map(r => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));
}

// ── USERS ─────────────────────────────────────────────────
export async function findUserByEmail(email: string) {
  const db = getDb();
  const rs = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
  return row(rs);
}

export async function findUserById(id: string) {
  const db = getDb();
  const rs = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
  return row(rs);
}

export async function getAllUsers() {
  const db = getDb();
  const rs = await db.execute('SELECT * FROM users ORDER BY createdAt ASC');
  return rows(rs);
}

export async function updateUserLastLogin(id: string) {
  const db = getDb();
  await db.execute({ sql: 'UPDATE users SET lastLogin = ? WHERE id = ?', args: [new Date().toISOString(), id] });
}

export async function createUser(data: Record<string, unknown>) {
  const db = getDb();
  const id = 'u' + Math.random().toString(36).slice(2, 13);
  await db.execute({ sql: 'INSERT INTO users (id,name,email,password,role,mfaEnabled,status,companyIds,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)', args: [id, v(data.name), v(data.email), v(data.password), v(data.role)||'Contador', data.mfaEnabled?1:0, v(data.status)||'activo', data.companyIds ? String(data.companyIds) : null, new Date().toISOString(), new Date().toISOString()] });
  return { id, ...data };
}

export async function updateUserStatus(id: string, status: string) {
  const db = getDb();
  await db.execute({ sql: 'UPDATE users SET status = ?, updatedAt = ? WHERE id = ?', args: [status, new Date().toISOString(), id] });
}

// ── COMPANIES ─────────────────────────────────────────────
export async function getAllCompanies() {
  const db = getDb();
  const [cos, creds] = await Promise.all([
    db.execute('SELECT * FROM companies ORDER BY createdAt ASC'),
    db.execute('SELECT companyId, solUser, status, provider FROM sunat_credentials'),
  ]);
  const credMap = new Map(rows(creds).map(c => [c.companyId as string, c]));
  return rows(cos).map(c => ({ ...c, credential: credMap.get(c.id as string) || null }));
}

export async function findCompanyByRuc(ruc: string) {
  const db = getDb();
  const rs = await db.execute({ sql: 'SELECT * FROM companies WHERE ruc = ?', args: [ruc] });
  return row(rs);
}

export async function findCompanyById(id: string) {
  const db = getDb();
  const rs = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [id] });
  return row(rs);
}

export async function createCompany(data: Record<string, unknown>) {
  const db = getDb();
  const id = 'co' + Math.random().toString(36).slice(2, 11);
  const now = new Date().toISOString();
  await db.execute({ sql: 'INSERT INTO companies (id,ruc,businessName,tradeName,regime,sector,contactEmail,igvRate,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)', args: args(id, data.ruc, data.businessName, data.tradeName||null, data.regime||'General', data.sector||null, data.contactEmail||null, data.igvRate||18, data.status||'activo', now, now) });
  return { id, ...data };
}

// ── CREDENTIALS ───────────────────────────────────────────
export async function getCredentialByCompany(companyId: string) {
  const db = getDb();
  const rs = await db.execute({ sql: 'SELECT * FROM sunat_credentials WHERE companyId = ?', args: [companyId] });
  return row(rs);
}

export async function upsertCredential(companyId: string, data: Record<string, unknown>) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = await getCredentialByCompany(companyId);
  if (existing) {
    await db.execute({ sql: 'UPDATE sunat_credentials SET solUser=?,encryptedPass=?,iv=?,authTag=?,clientId=?,encClientSecret=?,status=?,updatedAt=? WHERE companyId=?', args: args(data.solUser, data.encryptedPass, data.iv, data.authTag, data.clientId||null, data.encClientSecret||null, 'pending', now, companyId) });
  } else {
    const id = 'sc' + Math.random().toString(36).slice(2, 11);
    await db.execute({ sql: 'INSERT INTO sunat_credentials (id,companyId,solUser,encryptedPass,iv,authTag,clientId,encClientSecret,provider,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', args: args(id, companyId, data.solUser, data.encryptedPass, data.iv, data.authTag, data.clientId||null, data.encClientSecret||null, 'mock', 'pending', now, now) });
  }
}

export async function updateCredentialStatus(companyId: string, status: string) {
  const db = getDb();
  await db.execute({ sql: 'UPDATE sunat_credentials SET status=?,lastTestAt=?,updatedAt=? WHERE companyId=?', args: [status, new Date().toISOString(), new Date().toISOString(), companyId] });
}

// ── DOCUMENTS ─────────────────────────────────────────────
export async function getDocuments(filters: Record<string, string>) {
  const db = getDb();
  let sql = 'SELECT * FROM documents WHERE 1=1';
  const qArgs: (string | number | boolean | null)[] = [];
  if (filters.operation)    { sql += ' AND operation=?';    qArgs.push(filters.operation); }
  if (filters.companyId)    { sql += ' AND companyId=?';    qArgs.push(filters.companyId); }
  if (filters.period)       { sql += ' AND period=?';       qArgs.push(filters.period); }
  if (filters.workflow)     { sql += ' AND workflow=?';     qArgs.push(filters.workflow); }
  if (filters.concarStatus) { sql += ' AND concarStatus=?'; qArgs.push(filters.concarStatus); }
  if (filters.sunatStatus)  { sql += ' AND sunatStatus=?';  qArgs.push(filters.sunatStatus); }
  sql += ' ORDER BY issueDate DESC';
  const rs = await db.execute({ sql, args: qArgs });
  const docList = rows(rs);

  // Attach lines
  if (docList.length) {
    const ids = docList.map(d => String(d.id));
    const placeholders = ids.map(() => '?').join(',');
    const lrs = await db.execute({ sql: `SELECT * FROM document_lines WHERE documentId IN (${placeholders}) ORDER BY lineNumber ASC`, args: ids });
    const linesByDoc = new Map<string, Record<string, unknown>[]>();
    rows(lrs).forEach(l => {
      const id = l.documentId as string;
      if (!linesByDoc.has(id)) linesByDoc.set(id, []);
      linesByDoc.get(id)!.push(l);
    });
    docList.forEach(d => { (d as Record<string,unknown>).lines = linesByDoc.get(d.id as string) || []; });
  }
  return docList;
}

export async function findDocumentById(id: string) {
  const db = getDb();
  const [drs, lrs] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM documents WHERE id=?', args: [id] }),
    db.execute({ sql: 'SELECT * FROM document_lines WHERE documentId=? ORDER BY lineNumber', args: [id] }),
  ]);
  const doc = row(drs);
  if (!doc) return null;
  doc.lines = rows(lrs);
  return doc;
}

export async function createDocument(data: Record<string, unknown>) {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({ sql: 'INSERT INTO documents (id,companyId,bulkJobId,operation,docType,serie,number,issuerRuc,issuerName,receiverRuc,receiverName,issueDate,dueDate,currency,base,igv,total,hasDetraction,detractionPct,detractionAmt,sunatStatus,cdrStatus,workflow,concarStatus,hasXml,hasPdf,hasCdr,xmlPath,pdfPath,cdrPath,hashSha256,period,parserStatus,aiStatus,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    args: args(data.id,data.companyId,data.bulkJobId||null,data.operation,data.docType,data.serie,data.number,data.issuerRuc,data.issuerName,data.receiverRuc,data.receiverName,data.issueDate,data.dueDate||null,data.currency||'PEN',data.base,data.igv,data.total,data.hasDetraction?1:0,data.detractionPct||null,data.detractionAmt||null,data.sunatStatus||'PENDIENTE',data.cdrStatus||'PENDIENTE',data.workflow||'PENDIENTE_REVISION',data.concarStatus||'PENDIENTE',data.hasXml?1:0,data.hasPdf?1:0,data.hasCdr?1:0,data.xmlPath||null,data.pdfPath||null,data.cdrPath||null,data.hashSha256||null,data.period,data.parserStatus||'PENDIENTE',data.aiStatus||'PENDIENTE',now,now) });
  return data;
}

export async function updateDocument(id: string, data: Record<string, unknown>) {
  const db = getDb();
  const sets = Object.keys(data).map(k => `${k}=?`).join(',');
  await db.execute({ sql: `UPDATE documents SET ${sets},updatedAt=? WHERE id=?`, args: [...(Object.values(data) as unknown[]).map(v), new Date().toISOString(), id] });
}

export async function createDocumentLine(data: Record<string, unknown>) {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({ sql: 'INSERT INTO document_lines (id,documentId,lineNumber,code,description,quantity,unit,unitValue,igvAmount,lineTotal,affectType,pcgeAccount,costCenter,category,iaConfidence,needsReview,isRecurrent,approved,approvedBy,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    args: args(data.id,data.documentId,data.lineNumber,data.code||'',data.description,data.quantity,data.unit||'ZZ',data.unitValue,data.igvAmount,data.lineTotal,data.affectType||'10',data.pcgeAccount||null,data.costCenter||null,data.category||null,data.iaConfidence||0,data.needsReview?1:0,data.isRecurrent?1:0,0,null,now) });
}

// ── BULK JOBS ─────────────────────────────────────────────
export async function createBulkJob(data: Record<string, unknown>) {
  const db = getDb();
  const id = 'bj' + Math.random().toString(36).slice(2, 11);
  const now = new Date().toISOString();
  await db.execute({ sql: 'INSERT INTO bulk_jobs (id,companyId,operation,periodFrom,periodTo,periodType,status,totalPeriods,docsFound,docsXml,docsPdf,docsCdr,errors,createdBy,startedAt,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    args: args(id, data.companyId, data.operation, data.periodFrom, data.periodTo, data.periodType||'MONTHLY', 'EN_PROCESO', data.totalPeriods||0, 0, 0, 0, 0, 0, data.createdBy||'system', now, now) });
  return id;
}

export async function createBulkJobPeriod(data: Record<string, unknown>) {
  const db = getDb();
  const id = 'bjp' + Math.random().toString(36).slice(2, 10);
  await db.execute({ sql: 'INSERT INTO bulk_job_periods (id,jobId,period,operation,status,startedAt,createdAt) VALUES (?,?,?,?,?,?,?)',
    args: args(id, data.jobId, data.period, data.operation, 'EN_PROCESO', new Date().toISOString(), new Date().toISOString()) });
  return id;
}

export async function updateBulkJob(id: string, data: Record<string, unknown>) {
  const db = getDb();
  const sets = Object.keys(data).map(k => `${k}=?`).join(',');
  await db.execute({ sql: `UPDATE bulk_jobs SET ${sets} WHERE id=?`, args: [...(Object.values(data) as unknown[]).map(v), id] });
}

export async function updateBulkJobPeriod(id: string, data: Record<string, unknown>) {
  const db = getDb();
  const sets = Object.keys(data).map(k => `${k}=?`).join(',');
  await db.execute({ sql: `UPDATE bulk_job_periods SET ${sets} WHERE id=?`, args: [...(Object.values(data) as unknown[]).map(v), id] });
}

export async function getBulkJobs(companyId?: string) {
  const db = getDb();
  const sql = companyId ? 'SELECT * FROM bulk_jobs WHERE companyId=? ORDER BY createdAt DESC LIMIT 50' : 'SELECT * FROM bulk_jobs ORDER BY createdAt DESC LIMIT 50';
  const args = companyId ? [companyId] : [];
  const [jobs, periods] = await Promise.all([
    db.execute({ sql, args }),
    db.execute('SELECT * FROM bulk_job_periods ORDER BY createdAt ASC'),
  ]);
  const periodsByJob = new Map<string, Record<string, unknown>[]>();
  rows(periods).forEach(p => {
    const jid = p.jobId as string;
    if (!periodsByJob.has(jid)) periodsByJob.set(jid, []);
    periodsByJob.get(jid)!.push(p);
  });
  return rows(jobs).map(j => ({ ...j, periods: periodsByJob.get(j.id as string) || [] }));
}

// ── BANKS ─────────────────────────────────────────────────
export async function getBankMovements(companyId?: string) {
  const db = getDb();
  const rs = companyId
    ? await db.execute({ sql: 'SELECT * FROM bank_movements WHERE companyId=? ORDER BY date ASC', args: [companyId] })
    : await db.execute('SELECT * FROM bank_movements ORDER BY date ASC');
  return rows(rs);
}

export async function updateBankMovement(id: string, matchDocId: string, matchName: string) {
  const db = getDb();
  await db.execute({ sql: 'UPDATE bank_movements SET reconciled=1,matchDocId=?,matchName=? WHERE id=?', args: [matchDocId, matchName, id] });
}

// ── DETRACCIONES ──────────────────────────────────────────
export async function getDetracciones(companyId?: string) {
  const db = getDb();
  const rs = companyId
    ? await db.execute({ sql: 'SELECT * FROM detractions WHERE companyId=?', args: [companyId] })
    : await db.execute('SELECT * FROM detractions');
  return rows(rs);
}

export async function updateDetraccion(documentId: string) {
  const db = getDb();
  const today = new Date().toLocaleDateString('es-PE');
  await db.execute({ sql: "UPDATE detractions SET status='DEPOSITADO',depositDate=? WHERE documentId=?", args: [today, documentId] });
  return today;
}

// ── CONCAR ────────────────────────────────────────────────
export async function createConcarBatch(data: Record<string, unknown>, items: string[]) {
  const db = getDb();
  const id = 'cb' + Math.random().toString(36).slice(2, 11);
  const now = new Date().toISOString();
  await db.execute({ sql: 'INSERT INTO concar_batches (id,companyId,period,status,docsCount,exportedBy,hashLote,createdAt) VALUES (?,?,?,?,?,?,?,?)',
    args: args(id, data.companyId, data.period, 'PREPARADO', items.length, data.exportedBy, data.hashLote, now) });
  for (const docId of items) {
    const iid = 'cbi' + Math.random().toString(36).slice(2, 10);
    await db.execute({ sql: 'INSERT INTO concar_batch_items (id,batchId,documentId,status,createdAt) VALUES (?,?,?,?,?)', args: [iid, id, docId, 'INCLUIDO', now] });
  }
  return id;
}

export async function getConcarBatches() {
  const db = getDb();
  const rs = await db.execute('SELECT * FROM concar_batches ORDER BY createdAt DESC LIMIT 30');
  return rows(rs);
}

export async function approveConcarBatch(id: string, approvedBy: string) {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({ sql: "UPDATE concar_batches SET status='EXPORTADO',approvedBy=?,approvedAt=?,exportedAt=? WHERE id=?", args: [approvedBy, now, now, id] });
  const irs = await db.execute({ sql: 'SELECT documentId FROM concar_batch_items WHERE batchId=?', args: [id] });
  const docIds = rows(irs).map(r => r.documentId as string);
  for (const docId of docIds) {
    await db.execute({ sql: "UPDATE documents SET concarStatus='EXPORTADO' WHERE id=?", args: [docId] });
  }
}

// ── AUDIT ─────────────────────────────────────────────────
export async function getAuditLogs() {
  const db = getDb();
  const rs = await db.execute('SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT 300');
  return rows(rs);
}

export async function createAuditLog(data: Record<string, unknown>) {
  const db = getDb();
  const id = 'al' + Math.random().toString(36).slice(2, 11);
  await db.execute({ sql: 'INSERT INTO audit_logs (id,userId,userEmail,userRole,action,object,meta,ip,createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
    args: args(id, data.userId||null, data.userEmail, data.userRole, data.action, data.object||null, data.meta||null, data.ip||null, new Date().toISOString()) });
}

// ── CXC / CXP ─────────────────────────────────────────────
export async function getCxc(companyId?: string) {
  const db = getDb();
  const rs = companyId
    ? await db.execute({ sql: 'SELECT * FROM cxc_records WHERE companyId=? ORDER BY dueDate', args: [companyId] })
    : await db.execute('SELECT * FROM cxc_records ORDER BY dueDate');
  return rows(rs);
}

export async function getCxp(companyId?: string) {
  const db = getDb();
  const rs = companyId
    ? await db.execute({ sql: 'SELECT * FROM cxp_records WHERE companyId=? ORDER BY dueDate', args: [companyId] })
    : await db.execute('SELECT * FROM cxp_records ORDER BY dueDate');
  return rows(rs);
}

// ── REPORTS ───────────────────────────────────────────────
export async function getReportData(companyId: string, period: string) {
  const db = getDb();
  const [docs, lines] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM documents WHERE companyId=? AND period=?', args: [companyId, period] }),
    db.execute({ sql: 'SELECT dl.* FROM document_lines dl JOIN documents d ON dl.documentId=d.id WHERE d.companyId=? AND d.period=?', args: [companyId, period] }),
  ]);
  return { docs: rows(docs), lines: rows(lines) };
}

// ── CXC / CXP UPDATE ─────────────────────────────────────
export async function markCxcPaid(id: string, amount: number) {
  const db = getDb();
  const today = new Date().toISOString().slice(0,10);
  await db.execute({
    sql: "UPDATE cxc_records SET status='COBRADO',paidDate=?,paidAmount=? WHERE id=?",
    args: [today, amount, id] as (string|number|null)[],
  });
}

export async function markCxpPaid(id: string, amount: number) {
  const db = getDb();
  const today = new Date().toISOString().slice(0,10);
  await db.execute({
    sql: "UPDATE cxp_records SET status='PAGADO',paidDate=?,paidAmount=? WHERE id=?",
    args: [today, amount, id] as (string|number|null)[],
  });
}

// ── COMPANY UPDATE ────────────────────────────────────────
export async function updateCompany(id: string, data: Record<string, unknown>) {
  const db = getDb();
  const sets = Object.keys(data).map(k => `${k}=?`).join(',');
  await db.execute({ sql: `UPDATE companies SET ${sets},updatedAt=? WHERE id=?`, args: [...(Object.values(data) as unknown[]).map(v), new Date().toISOString(), id] });
}
