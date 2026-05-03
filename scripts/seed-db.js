#!/usr/bin/env node
// Sherman Finance — Seed de datos demo
const { DatabaseSync } = require('node:sqlite');
const { randomBytes, createCipheriv } = require('crypto');
const bcrypt = require('bcryptjs');
const path   = require('path');

const db = new DatabaseSync(path.join(process.cwd(), 'prisma', 'dev.db'));
console.log('\n🌱 Cargando datos demo...\n');

const uid  = () => 'c' + randomBytes(10).toString('hex');
const now  = new Date().toISOString();

// Hashes bcrypt (rounds=10 para seed rápido)
const hashAdmin = bcrypt.hashSync('Admin123!', 10);
const hashDemo  = bcrypt.hashSync('Demo1234!', 10);

const uAdmin=uid(),uMruiz=uid(),uJlopez=uid(),uAaudit=uid();
const emp1=uid(),emp2=uid();

// USERS
const uStmt = db.prepare('INSERT OR IGNORE INTO users (id,name,email,password,role,mfaEnabled,status,lastLogin,mfaSecret,resetToken,resetExpires,companyIds,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
uStmt.run(uAdmin,'Carlos Admin Torres','admin@empresa.pe',hashAdmin,'Administrador',1,'activo',null,null,null,null,null,now,now);
uStmt.run(uMruiz,'María Ruiz Quispe','mruiz@empresa.pe',hashDemo,'Contador',1,'activo',null,null,null,null,null,now,now);
uStmt.run(uJlopez,'Juan López Mamani','jlopez@empresa.pe',hashDemo,'Supervisor',1,'activo',null,null,null,null,null,now,now);
uStmt.run(uAaudit,'Ana Auditor Flores','aaudit@empresa.pe',hashDemo,'Auditor',0,'activo',null,null,null,null,null,now,now);
console.log('  ✓ 4 usuarios (contraseñas hasheadas con bcrypt)');

// COMPANIES
const cStmt = db.prepare('INSERT OR IGNORE INTO companies VALUES (?,?,?,?,?,?,?,?,?,?,?)');
cStmt.run(emp1,'20512345678','MINERA LOS ANDES S.A.C.','Los Andes','General','Minería','admin@losandes.pe',18,'activo',now,now);
cStmt.run(emp2,'20876543210','COMERCIAL BETA E.I.R.L.','Beta Comercial','MYPE Tributario','Comercio','contab@beta.pe',18,'activo',now,now);
console.log('  ✓ 2 empresas');

// Get the actual company IDs from the database
const actualEmp1 = db.prepare('SELECT id FROM companies WHERE ruc = ?').get('20512345678');
const actualEmp2 = db.prepare('SELECT id FROM companies WHERE ruc = ?').get('20876543210');
const realEmp1 = actualEmp1 ? actualEmp1.id : emp1;
const realEmp2 = actualEmp2 ? actualEmp2.id : emp2;

// SUNAT CREDENTIALS (demo SOL cifrado)
const key = Buffer.from('sherman-encrypt-key-exactly-32b!'.slice(0,32));
const iv  = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm',key,iv);
const enc = Buffer.concat([cipher.update('SolDemo123!','utf8'),cipher.final()]);
const tag = cipher.getAuthTag();
db.prepare('INSERT OR IGNORE INTO sunat_credentials VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(uid(),realEmp1,'DEMO20512345678',enc.toString('hex'),iv.toString('hex'),tag.toString('hex'),null,null,'mock','pending',null,now,now);
console.log('  ✓ 1 credencial demo (SOL cifrado AES-256-GCM)');

// DOCUMENTS
const dStmt = db.prepare('INSERT OR IGNORE INTO documents VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
const docs = [
  ['F001-001234',realEmp1,null,'COMPRA','01','F001','001234','20100066603','REP. ALFA S.A.C.','20512345678','MINERA LOS ANDES S.A.C.','2026-04-03','2026-05-03','PEN',10000,1800,11800,1,12,1416,'ACEPTADO','OK','APROBADO','LISTO',1,1,1,null,null,null,'3a8f2b1c','2026-04','PARSEADO','CLASIFICADO'],
  ['F002-000088',realEmp1,null,'COMPRA','01','F002','000088','20876543210','MANTENIMIENTOS PERU S.R.L.','20512345678','MINERA LOS ANDES S.A.C.','2026-04-05','2026-04-20','PEN',4500,810,5310,0,null,null,'ACEPTADO','OK','APROBADO','LISTO',1,1,1,null,null,null,'b7c4d2e9','2026-04','PARSEADO','CLASIFICADO'],
  ['E001-000012',realEmp1,null,'COMPRA','01','E001','000012','20111222334','ALQUILERES CORP. S.A.','20512345678','MINERA LOS ANDES S.A.C.','2026-04-01','2026-04-30','PEN',8474.58,1525.42,10000,1,12,1200,'ACEPTADO','OK','APROBADO','LISTO',1,1,1,null,null,null,'c2a5f8d3','2026-04','PARSEADO','CLASIFICADO'],
  ['F003-000441',realEmp1,null,'COMPRA','01','F003','000441','20333444556','DELTA TEC. S.A.','20512345678','MINERA LOS ANDES S.A.C.','2026-04-07','2026-05-07','USD',12000,2160,14160,0,null,null,'ACEPTADO','OK','PENDIENTE_REVISION','PENDIENTE',1,0,1,null,null,null,'d4b9e1f6','2026-04','PARSEADO','PENDIENTE'],
  ['F001-001400',realEmp1,null,'COMPRA','01','F001','001400','20512345678','REP. ALFA S.A.C.','20512345678','MINERA LOS ANDES S.A.C.','2026-04-10','2026-05-10','PEN',2500,450,2950,0,null,null,'OBSERVADO','NULA','OBSERVADO','BLOQUEADO',1,1,1,null,null,null,'e6f3a2c8','2026-04','PENDIENTE','PENDIENTE'],
  ['FV01-002341',realEmp1,null,'VENTA','01','FV01','002341','20512345678','MINERA LOS ANDES S.A.C.','20654321098','GRUPO ANDINO S.A.','2026-04-02','2026-05-02','PEN',20000,3600,23600,0,null,null,'ACEPTADO','OK','APROBADO','LISTO',1,1,1,null,null,null,'f9d1b3e5','2026-04','PARSEADO','CLASIFICADO'],
  ['FV01-002342',realEmp1,null,'VENTA','01','FV01','002342','20512345678','MINERA LOS ANDES S.A.C.','20789012346','CONSTRUCTORA NORTE S.A.C.','2026-04-05','2026-05-05','PEN',50000,9000,59000,0,null,null,'ACEPTADO','OK','VALIDADO','LISTO',1,1,1,null,null,null,'a2b4c6d8','2026-04','PARSEADO','CLASIFICADO'],
  ['NC01-000007',realEmp1,null,'COMPRA','07','NC01','000007','20333444556','DELTA TEC. S.A.','20512345678','MINERA LOS ANDES S.A.C.','2026-04-20','2026-04-20','PEN',-500,-90,-590,0,null,null,'ACEPTADO','OK','APROBADO','LISTO',1,1,1,null,null,null,'c3d5e7f9','2026-04','PARSEADO','CLASIFICADO'],
  ['B001-012345',realEmp1,null,'COMPRA','03','B001','012345','10456789012','FERRETERIA EL PERNO SAC','20512345678','MINERA LOS ANDES S.A.C.','2026-04-15',null,'PEN',847.46,152.54,1000,0,null,null,'ACEPTADO','OK','PENDIENTE_REVISION','PENDIENTE',1,0,0,null,null,null,'d8e2f1a4','2026-04','PARSEADO','PENDIENTE'],
  ['FV01-002343',realEmp1,null,'VENTA','01','FV01','002343','20512345678','MINERA LOS ANDES S.A.C.','20111333555','SERVICIOS GLOBALES SAC','2026-04-08','2026-05-08','USD',8000,1440,9440,0,null,null,'ACEPTADO','OK','APROBADO','LISTO',1,1,1,null,null,null,'e9f0a1b2','2026-04','PARSEADO','CLASIFICADO'],
];
docs.forEach(d => dStmt.run(...d,now,now));
console.log('  ✓ 10 documentos');

// DOCUMENT LINES
const lStmt = db.prepare('INSERT OR IGNORE INTO document_lines VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
const lines = [
  ['F001-001234-L1','F001-001234',1,'SRV-001','Consultoría en transformación digital y automatización de procesos contables — Marzo 2026',1,'ZZ',6000,1080,7080,'10','63-03','GE-TI','Consultoría TI',94,0,1,0,null],
  ['F001-001234-L2','F001-001234',2,'SRV-002','Licencia mensual plataforma ERP cloud — Módulo contable y financiero — Abril 2026',1,'ZZ',4000,720,4720,'10','63-03','GE-TI','Licencias Software',91,0,1,0,null],
  ['F002-000088-L1','F002-000088',1,'MNT-020','Mantenimiento preventivo sistema de aire acondicionado — Pisos 3 y 4 Torre Principal',2,'NI',1500,270,3540,'10','63-04','OPE-INFRA','Mantenimiento',88,0,0,0,null],
  ['F002-000088-L2','F002-000088',2,'REP-011','Reposición filtros HEPA y refrigerante R410A — Stock mínimo operativo',1,'ZZ',1770,0,1770,'10','60-05','OPE-INFRA','Materiales',72,1,0,0,null],
  ['E001-000012-L1','E001-000012',1,'ARR-2604','Arrendamiento oficina comercial — Piso 8 Torre Empresarial San Isidro — Abril 2026',1,'MES',8474.58,1525.42,10000,'10','63-05','GE-ADM','Arrendamiento',97,0,1,0,null],
  ['F003-000441-L1','F003-000441',1,'HW-2024-A','Servidor HPE ProLiant DL380 Gen10 — 2×Intel Xeon Gold 6242, 256 GB RAM, 4×SSD 960 GB',1,'NI',7500,1350,8850,'10','33-00','TI-INFRA','Activo fijo TI',83,1,0,0,null],
  ['F003-000441-L2','F003-000441',2,'SW-LIC-001','Licencia VMware vSphere Enterprise Plus — 2 sockets perpetua + soporte anual Premier',2,'NI',1500,270,3540,'10','63-03','TI-INFRA','Licencias Software',89,0,0,0,null],
  ['F003-000441-L3','F003-000441',3,'SVC-INST','Servicio instalación y configuración infraestructura virtualizada — 5 días onsite',5,'DIA',354,0,1770,'10','63-03','TI-INFRA','Servicio TI',86,0,0,0,null],
  ['FV01-002341-L1','FV01-002341',1,'SVC-ASE-01','Servicio de asesoría contable y tributaria mensual — Abril 2026 — Empresa Los Andes',1,'MES',20000,3600,23600,'10','72-11','SVC-CONTA','Asesoría Contable',96,0,1,0,null],
  ['FV01-002342-L1','FV01-002342',1,'SVC-FIN-Q1','Consultoría en gestión financiera y estructuración de deuda — Q1 2026 — 3 entregables',1,'ZZ',30000,5400,35400,'10','72-11','SVC-FIN','Consultoría Financiera',93,0,0,0,null],
  ['FV01-002342-L2','FV01-002342',2,'SVC-NIIF-01','Implementación NIIF para PYMES — Diagnóstico inicial y adopción de políticas contables',1,'ZZ',20000,3600,23600,'10','72-11','SVC-NIIF','NIIF',88,0,0,0,null],
  ['NC01-000007-L1','NC01-000007',1,'NC-DES-01','Nota de crédito por descuento comercial acordado — Ajuste sobre Factura F003-000441',1,'ZZ',-500,-90,-590,'10','63-03','TI-INFRA','Descuento',95,0,0,0,null],
];
lines.forEach(l => lStmt.run(...l,now));
console.log('  ✓ 12 líneas de documentos con clasificación IA');

// BANK MOVEMENTS
const mStmt = db.prepare('INSERT OR IGNORE INTO bank_movements VALUES (?,?,?,?,?,?,?,?,?,?,?)');
const movs = [
  [uid(),realEmp1,'2026-04-02','ABONO GRUPO ANDINO SA RUC 20654321098','CRÉDITO',23600,145200,1,'FV01-002341','GRUPO ANDINO S.A.'],
  [uid(),realEmp1,'2026-04-04','PAGO PROVEEDOR REP ALFA RUC 20100066603','DÉBITO',10384,134816,1,'F001-001234','REP. ALFA S.A.C.'],
  [uid(),realEmp1,'2026-04-06','DEPÓSITO EFECTIVO CAJA GENERAL','CRÉDITO',5000,139816,0,null,null],
  [uid(),realEmp1,'2026-04-07','PAGO MANTENIMIENTOS PERU SRL','DÉBITO',5310,134506,1,'F002-000088','MANTENIMIENTOS PERU S.R.L.'],
  [uid(),realEmp1,'2026-04-08','ABONO MINA SANTA ROSA SA','CRÉDITO',118000,252506,0,null,null],
  [uid(),realEmp1,'2026-04-10','PAGO SUNAT DETRACCIÓN 12% REP ALFA','DÉBITO',1416,251090,1,'F001-001234','Detracción REP ALFA'],
  [uid(),realEmp1,'2026-04-12','ITF BANCO — COMISIÓN TRANSFERENCIA','DÉBITO',25.38,251064.62,0,null,null],
  [uid(),realEmp1,'2026-04-15','ABONO CONSTRUCTORA NORTE SAC','CRÉDITO',59000,310064.62,1,'FV01-002342','CONSTRUCTORA NORTE S.A.C.'],
  [uid(),realEmp1,'2026-04-18','PAGO ALQUILERES CORPORATIVOS SA','DÉBITO',10000,300064.62,1,'E001-000012','ALQUILERES CORP. S.A.'],
  [uid(),realEmp1,'2026-04-22','TRANSFERENCIA ENTRADA SOCIO CAPITALISTA','CRÉDITO',8500,308564.62,0,null,null],
  [uid(),realEmp1,'2026-04-25','PAGO PLANILLA ABRIL 2026','DÉBITO',45000,263564.62,0,null,null],
  [uid(),realEmp1,'2026-04-28','ABONO SERVICIOS GLOBALES SAC','CRÉDITO',9440,273004.62,1,'FV01-002343','SERVICIOS GLOBALES SAC'],
];
movs.forEach(m => mStmt.run(...m,now));
console.log('  ✓ 12 movimientos bancarios');

// DETRACCIONES
const dtrStmt = db.prepare('INSERT OR IGNORE INTO detractions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
dtrStmt.run(uid(),realEmp1,'F001-001234','REP. ALFA S.A.C.','20100066603',1416,12,'022','00-010-348912','DEPOSITADO','2026-04-08',now);
dtrStmt.run(uid(),realEmp1,'E001-000012','ALQUILERES CORP. S.A.','20111222334',1200,12,'019','00-010-348912','PENDIENTE',null,now);
dtrStmt.run(uid(),realEmp1,'F002-000088','MANTENIMIENTOS PERU S.R.L.','20876543210',530,10,'014','00-010-348912','DEPOSITADO','2026-04-07',now);
console.log('  ✓ 3 detracciones');

// CXC
const cxcStmt = db.prepare('INSERT OR IGNORE INTO cxc_records VALUES (?,?,?,?,?,?,?,?,?,?,?)');
cxcStmt.run(uid(),realEmp1,'FV01-002341','20654321098','GRUPO ANDINO S.A.',23600,'2026-05-02','COBRADO','2026-04-02',23600,now);
cxcStmt.run(uid(),realEmp1,'FV01-002342','20789012346','CONSTRUCTORA NORTE S.A.C.',59000,'2026-05-05','COBRADO','2026-04-15',59000,now);
cxcStmt.run(uid(),realEmp1,'FV01-002343','20111333555','SERVICIOS GLOBALES SAC',9440,'2026-05-08','COBRADO','2026-04-28',9440,now);
cxcStmt.run(uid(),realEmp1,null,'20222333444','INDUSTRIAS PERU SAC',45000,'2026-05-15','POR_VENCER',null,null,now);
cxcStmt.run(uid(),realEmp1,null,'20444555666','DISTRIBUIDORA ANDINA SAC',18500,'2026-04-20','VENCIDO',null,null,now);

// CXP
const cxpStmt = db.prepare('INSERT OR IGNORE INTO cxp_records VALUES (?,?,?,?,?,?,?,?,?,?,?)');
cxpStmt.run(uid(),realEmp1,'F001-001234','20100066603','REP. ALFA S.A.C.',11800,'2026-05-03','PAGADO','2026-04-04',10384,now);
cxpStmt.run(uid(),realEmp1,'F002-000088','20876543210','MANTENIMIENTOS PERU S.R.L.',5310,'2026-04-20','PAGADO','2026-04-07',5310,now);
cxpStmt.run(uid(),realEmp1,'E001-000012','20111222334','ALQUILERES CORP. S.A.',10000,'2026-04-30','PAGADO','2026-04-18',10000,now);
cxpStmt.run(uid(),realEmp1,'F003-000441','20333444556','DELTA TEC. S.A.',14160,'2026-05-07','POR_VENCER',null,null,now);
cxpStmt.run(uid(),realEmp1,null,'10987654321','CONTADOR EXTERNO SAC',3500,'2026-04-25','VENCIDO',null,null,now);
console.log('  ✓ 5 CxC + 5 CxP');

// AUDIT
const aStmt = db.prepare('INSERT OR IGNORE INTO audit_logs VALUES (?,?,?,?,?,?,?,?,?)');
aStmt.run(uid(),uAdmin,'admin@empresa.pe','Administrador','SISTEMA_INICIALIZADO','v2.0.0 — libsql',null,'127.0.0.1',now);
aStmt.run(uid(),uMruiz,'mruiz@empresa.pe','Contador','SEED_COMPLETADO','10 documentos, 12 líneas',null,'127.0.0.1',now);
aStmt.run(uid(),uJlopez,'jlopez@empresa.pe','Supervisor','LOGIN','session',null,'127.0.0.1',now);
console.log('  ✓ 3 eventos de auditoría');

db.close();

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Datos demo cargados exitosamente!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔑 CREDENCIALES DE ACCESO:');
console.log('   Admin:      admin@empresa.pe  / Admin123!');
console.log('   Contador:   mruiz@empresa.pe  / Demo1234!');
console.log('   Supervisor: jlopez@empresa.pe / Demo1234!');
console.log('   Auditor:    aaudit@empresa.pe / Demo1234!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 Ejecuta: npm run dev');
console.log('🌐 Abre:    http://localhost:3000\n');
