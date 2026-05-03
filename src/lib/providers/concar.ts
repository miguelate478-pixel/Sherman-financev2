// CONCAR SQL Server provider — mock + real mssql
export interface ConcarAccount { code: string; name: string; type: string; }
export interface ConcarBatchResult { batchId: string; count: number; sql: string; }

export interface IConcarProvider {
  testConnection(): Promise<{ ok: boolean; version: string; database: string }>;
  getAccounts(): Promise<ConcarAccount[]>;
  exportBatch(docs: Record<string,unknown>[], period: string): Promise<ConcarBatchResult>;
}

// Mock provider (no SQL Server needed)
export class MockConcarProvider implements IConcarProvider {
  async testConnection() { return { ok:true, version:'SQL Server 2019 mock', database:'CONCAR_DEMO' }; }
  async getAccounts(): Promise<ConcarAccount[]> {
    return [
      {code:'60-01',name:'Mercaderías',type:'GASTO'}, {code:'63-03',name:'Servicios de terceros',type:'GASTO'},
      {code:'63-04',name:'Mantenimiento',type:'GASTO'}, {code:'63-05',name:'Arrendamientos',type:'GASTO'},
      {code:'33-00',name:'Inmuebles y equipo',type:'ACTIVO'}, {code:'70-11',name:'Mercaderías-terceros',type:'INGRESO'},
      {code:'72-11',name:'Servicios prestados',type:'INGRESO'}, {code:'40-11',name:'IGV cuenta propia',type:'PASIVO'},
      {code:'42-10',name:'Facturas por pagar',type:'PASIVO'}, {code:'12-10',name:'Facturas por cobrar',type:'ACTIVO'},
    ];
  }
  async exportBatch(docs: Record<string,unknown>[], period: string): Promise<ConcarBatchResult> {
    const lines = docs.map((d,i) => `-- Asiento ${i+1}: ${d.id} | ${d.issuerName} | ${d.total}`).join('\n');
    return { batchId: `MOCK-${Date.now()}`, count: docs.length, sql: `-- CONCAR MOCK EXPORT\n-- Período: ${period}\n${lines}` };
  }
}

// Real mssql provider
export class MssqlConcarProvider implements IConcarProvider {
  private config = {
    server:   process.env.CONCAR_SQL_SERVER   || '',
    database: process.env.CONCAR_SQL_DATABASE || 'CONCAR',
    user:     process.env.CONCAR_SQL_USER     || '',
    password: process.env.CONCAR_SQL_PASSWORD || '',
    options:  { encrypt: process.env.CONCAR_SQL_ENCRYPT === 'true', trustServerCertificate: process.env.CONCAR_SQL_TRUST_CERT === 'true' },
    connectionTimeout: 10000,
  };

  private async getPool() {
    const mssql = await import('mssql');
    return mssql.default.connect(this.config);
  }

  async testConnection() {
    try {
      const pool = await this.getPool();
      const res = await pool.request().query('SELECT @@VERSION as version, DB_NAME() as db');
      await pool.close();
      const row = res.recordset[0];
      return { ok:true, version: (row.version as string).split('\n')[0], database: row.db as string };
    } catch (e) { return { ok:false, version:'', database:'', error:(e as Error).message }; }
  }

  async getAccounts(): Promise<ConcarAccount[]> {
    try {
      const pool = await this.getPool();
      const res = await pool.request().query(`
        SELECT TOP 100 CodCuenta as code, DesCuenta as name,
          CASE WHEN CodCuenta LIKE '6%' THEN 'GASTO'
               WHEN CodCuenta LIKE '7%' THEN 'INGRESO'
               WHEN CodCuenta LIKE '4%' THEN 'PASIVO'
               ELSE 'ACTIVO' END as type
        FROM MA_CUENTA WHERE IndEstado = 'A' ORDER BY CodCuenta
      `);
      await pool.close();
      return res.recordset as ConcarAccount[];
    } catch { return new MockConcarProvider().getAccounts(); }
  }

  async exportBatch(docs: Record<string,unknown>[], period: string): Promise<ConcarBatchResult> {
    // Generate CONCAR-compatible SQL INSERT statements
    const perNum = period.replace('-','');
    const asientos = docs.map((doc, idx) => {
      const cuenta = (doc.pcgeAccount as string) || '63-03';
      const base   = Math.abs(doc.base as number);
      const igv    = Math.abs(doc.igv as number);
      const total  = Math.abs(doc.total as number);
      const ruc    = (doc.issuerRuc as string) || '';
      const rs     = ((doc.issuerName as string) || '').slice(0,40);
      const fecha  = (doc.issueDate as string)?.replace(/-/g,'') || perNum + '01';
      const codComp= (doc.docType as string) || '01';
      const serie  = (doc.serie as string) || 'F001';
      const num    = (doc.number as string) || '000001';
      return [
        `INSERT INTO CM_COMPRO (CodEmp,NroComp,FecComp,CodLib,CodMoneda,TasaCambio,IndEstado)`,
        `VALUES ('001','${perNum}${String(idx+1).padStart(6,'0')}','${fecha}','14','1',1,'A');`,
        `INSERT INTO CM_DETCOM (CodEmp,NroComp,NroItem,CodCuenta,DebeML,HaberML,CodDoc,SerieDoc,NroDoc,RucProv,NomProv)`,
        `VALUES ('001','${perNum}${String(idx+1).padStart(6,'0')}','01','${cuenta}',${base},0,'${codComp}','${serie}','${num}','${ruc}','${rs}');`,
        `INSERT INTO CM_DETCOM (CodEmp,NroComp,NroItem,CodCuenta,DebeML,HaberML)`,
        `VALUES ('001','${perNum}${String(idx+1).padStart(6,'0')}','02','40-11',${igv},0);`,
        `INSERT INTO CM_DETCOM (CodEmp,NroComp,NroItem,CodCuenta,DebeML,HaberML)`,
        `VALUES ('001','${perNum}${String(idx+1).padStart(6,'0')}','03','42-10',0,${total});`,
        '',
      ].join('\n');
    });
    const sql = `-- CONCAR EXPORT ${period} — ${docs.length} asientos\nUSE ${this.config.database};\n\n${asientos.join('\n')}`;
    return { batchId:`CONCAR-${Date.now()}`, count:docs.length, sql };
  }
}

export function getConcarProvider(): IConcarProvider {
  return process.env.CONCAR_PROVIDER === 'sqlserver'
    ? new MssqlConcarProvider()
    : new MockConcarProvider();
}
