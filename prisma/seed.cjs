const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('\n🌱 Sherman Finance v2 — Seed iniciando...\n');

  // USERS
  const users = [
    { name: 'Carlos Admin Torres',  email: 'admin@empresa.pe',  password: 'Admin123!', role: 'Administrador' },
    { name: 'María Ruiz Quispe',    email: 'mruiz@empresa.pe',  password: 'Demo1234!', role: 'Contador' },
    { name: 'Juan López Mamani',    email: 'jlopez@empresa.pe', password: 'Demo1234!', role: 'Supervisor' },
    { name: 'Ana Auditor Flores',   email: 'aaudit@empresa.pe', password: 'Demo1234!', role: 'Auditor' },
  ];
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, password: hash } });
    console.log(`  ✓ Usuario: ${u.email} (${u.role})`);
  }

  // COMPANIES
  const emp1 = await prisma.company.upsert({ where: { ruc: '20512345678' }, update: {}, create: { ruc: '20512345678', businessName: 'MINERA LOS ANDES S.A.C.', tradeName: 'Los Andes', regime: 'General', sector: 'Minería', contactEmail: 'admin@losandes.pe' } });
  const emp2 = await prisma.company.upsert({ where: { ruc: '20876543210' }, update: {}, create: { ruc: '20876543210', businessName: 'COMERCIAL BETA E.I.R.L.', tradeName: 'Beta Comercial', regime: 'MYPE Tributario', sector: 'Comercio', contactEmail: 'contab@beta.pe' } });
  console.log(`\n  ✓ Empresa: ${emp1.businessName}`);
  console.log(`  ✓ Empresa: ${emp2.businessName}`);

  // DOCUMENTS
  const docs = [
    { id:'F001-001234',companyId:emp1.id,operation:'COMPRA',docType:'01',serie:'F001',number:'001234',issuerRuc:'20100066603',issuerName:'REP. ALFA S.A.C.',receiverRuc:'20512345678',receiverName:'MINERA LOS ANDES S.A.C.',issueDate:'2026-04-03',dueDate:'2026-05-03',currency:'PEN',base:10000,igv:1800,total:11800,hasDetraction:true,detractionPct:12,detractionAmt:1416,sunatStatus:'ACEPTADO',cdrStatus:'OK',workflow:'APROBADO',concarStatus:'LISTO',hasXml:true,hasPdf:true,hasCdr:true,hashSha256:'3a8f2b1c',period:'2026-04',parserStatus:'PARSEADO',aiStatus:'CLASIFICADO' },
    { id:'F002-000088',companyId:emp1.id,operation:'COMPRA',docType:'01',serie:'F002',number:'000088',issuerRuc:'20876543210',issuerName:'MANTENIMIENTOS PERU S.R.L.',receiverRuc:'20512345678',receiverName:'MINERA LOS ANDES S.A.C.',issueDate:'2026-04-05',dueDate:'2026-04-20',currency:'PEN',base:4500,igv:810,total:5310,sunatStatus:'ACEPTADO',cdrStatus:'OK',workflow:'APROBADO',concarStatus:'LISTO',hasXml:true,hasPdf:true,hasCdr:true,hashSha256:'b7c4d2e9',period:'2026-04',parserStatus:'PARSEADO',aiStatus:'CLASIFICADO' },
    { id:'E001-000012',companyId:emp1.id,operation:'COMPRA',docType:'01',serie:'E001',number:'000012',issuerRuc:'20111222334',issuerName:'ALQUILERES CORP. S.A.',receiverRuc:'20512345678',receiverName:'MINERA LOS ANDES S.A.C.',issueDate:'2026-04-01',dueDate:'2026-04-30',currency:'PEN',base:8474.58,igv:1525.42,total:10000,hasDetraction:true,detractionPct:12,detractionAmt:1200,sunatStatus:'ACEPTADO',cdrStatus:'OK',workflow:'APROBADO',concarStatus:'LISTO',hasXml:true,hasPdf:true,hasCdr:true,hashSha256:'c2a5f8d3',period:'2026-04',parserStatus:'PARSEADO',aiStatus:'CLASIFICADO' },
    { id:'F003-000441',companyId:emp1.id,operation:'COMPRA',docType:'01',serie:'F003',number:'000441',issuerRuc:'20333444556',issuerName:'DELTA TEC. S.A.',receiverRuc:'20512345678',receiverName:'MINERA LOS ANDES S.A.C.',issueDate:'2026-04-07',dueDate:'2026-05-07',currency:'USD',base:12000,igv:2160,total:14160,sunatStatus:'ACEPTADO',cdrStatus:'OK',workflow:'PENDIENTE_REVISION',concarStatus:'PENDIENTE',hasXml:true,hasPdf:false,hasCdr:true,hashSha256:'d4b9e1f6',period:'2026-04',parserStatus:'PARSEADO',aiStatus:'PENDIENTE' },
    { id:'F001-001400',companyId:emp1.id,operation:'COMPRA',docType:'01',serie:'F001',number:'001400',issuerRuc:'20512345678',issuerName:'REP. ALFA S.A.C.',receiverRuc:'20512345678',receiverName:'MINERA LOS ANDES S.A.C.',issueDate:'2026-04-10',dueDate:'2026-05-10',currency:'PEN',base:2500,igv:450,total:2950,sunatStatus:'OBSERVADO',cdrStatus:'NULA',workflow:'OBSERVADO',concarStatus:'BLOQUEADO',hasXml:true,hasPdf:true,hasCdr:true,hashSha256:'e6f3a2c8',period:'2026-04',parserStatus:'PENDIENTE',aiStatus:'PENDIENTE' },
    { id:'FV01-002341',companyId:emp1.id,operation:'VENTA',docType:'01',serie:'FV01',number:'002341',issuerRuc:'20512345678',issuerName:'MINERA LOS ANDES S.A.C.',receiverRuc:'20654321098',receiverName:'GRUPO ANDINO S.A.',issueDate:'2026-04-02',dueDate:'2026-05-02',currency:'PEN',base:20000,igv:3600,total:23600,sunatStatus:'ACEPTADO',cdrStatus:'OK',workflow:'APROBADO',concarStatus:'LISTO',hasXml:true,hasPdf:true,hasCdr:true,hashSha256:'f9d1b3e5',period:'2026-04',parserStatus:'PARSEADO',aiStatus:'CLASIFICADO' },
    { id:'FV01-002342',companyId:emp1.id,operation:'VENTA',docType:'01',serie:'FV01',number:'002342',issuerRuc:'20512345678',issuerName:'MINERA LOS ANDES S.A.C.',receiverRuc:'20789012346',receiverName:'CONSTRUCTORA NORTE S.A.C.',issueDate:'2026-04-05',dueDate:'2026-05-05',currency:'PEN',base:50000,igv:9000,total:59000,sunatStatus:'ACEPTADO',cdrStatus:'OK',workflow:'VALIDADO',concarStatus:'LISTO',hasXml:true,hasPdf:true,hasCdr:true,hashSha256:'a2b4c6d8',period:'2026-04',parserStatus:'PARSEADO',aiStatus:'CLASIFICADO' },
    { id:'NC01-000007',companyId:emp1.id,operation:'COMPRA',docType:'07',serie:'NC01',number:'000007',issuerRuc:'20333444556',issuerName:'DELTA TEC. S.A.',receiverRuc:'20512345678',receiverName:'MINERA LOS ANDES S.A.C.',issueDate:'2026-04-20',dueDate:'2026-04-20',currency:'PEN',base:-500,igv:-90,total:-590,sunatStatus:'ACEPTADO',cdrStatus:'OK',workflow:'APROBADO',concarStatus:'LISTO',hasXml:true,hasPdf:true,hasCdr:true,hashSha256:'c3d5e7f9',period:'2026-04',parserStatus:'PARSEADO',aiStatus:'CLASIFICADO' },
    { id:'B001-012345',companyId:emp1.id,operation:'COMPRA',docType:'03',serie:'B001',number:'012345',issuerRuc:'10456789012',issuerName:'FERRETERIA EL PERNO SAC',receiverRuc:'20512345678',receiverName:'MINERA LOS ANDES S.A.C.',issueDate:'2026-04-15',currency:'PEN',base:847.46,igv:152.54,total:1000,sunatStatus:'ACEPTADO',cdrStatus:'OK',workflow:'PENDIENTE_REVISION',concarStatus:'PENDIENTE',hasXml:true,hasPdf:false,hasCdr:false,hashSha256:'d8e2f1a4',period:'2026-04',parserStatus:'PARSEADO',aiStatus:'PENDIENTE' },
    { id:'FV01-002343',companyId:emp1.id,operation:'VENTA',docType:'01',serie:'FV01',number:'002343',issuerRuc:'20512345678',issuerName:'MINERA LOS ANDES S.A.C.',receiverRuc:'20111333555',receiverName:'SERVICIOS GLOBALES SAC',issueDate:'2026-04-08',dueDate:'2026-05-08',currency:'USD',base:8000,igv:1440,total:9440,sunatStatus:'ACEPTADO',cdrStatus:'OK',workflow:'APROBADO',concarStatus:'LISTO',hasXml:true,hasPdf:true,hasCdr:true,hashSha256:'e9f0a1b2',period:'2026-04',parserStatus:'PARSEADO',aiStatus:'CLASIFICADO' },
  ];
  for (const doc of docs) {
    await prisma.document.upsert({ where: { id: doc.id }, update: {}, create: doc });
  }
  console.log(`\n  ✓ ${docs.length} documentos`);

  // DOCUMENT LINES
  const lines = [
    { documentId:'F001-001234',lineNumber:1,code:'SRV-001',description:'Consultoría en transformación digital y automatización de procesos contables — Marzo 2026',quantity:1,unit:'ZZ',unitValue:6000,igvAmount:1080,lineTotal:7080,affectType:'10',pcgeAccount:'63-03',costCenter:'GE-TI',category:'Consultoría TI',iaConfidence:94,isRecurrent:true },
    { documentId:'F001-001234',lineNumber:2,code:'SRV-002',description:'Licencia mensual plataforma ERP cloud — Módulo contable y financiero — Abril 2026',quantity:1,unit:'ZZ',unitValue:4000,igvAmount:720,lineTotal:4720,affectType:'10',pcgeAccount:'63-03',costCenter:'GE-TI',category:'Licencias Software',iaConfidence:91,isRecurrent:true },
    { documentId:'F002-000088',lineNumber:1,code:'MNT-020',description:'Mantenimiento preventivo sistema de aire acondicionado — Pisos 3 y 4 Torre Principal',quantity:2,unit:'NI',unitValue:1500,igvAmount:270,lineTotal:3540,affectType:'10',pcgeAccount:'63-04',costCenter:'OPE-INFRA',category:'Mantenimiento',iaConfidence:88 },
    { documentId:'F002-000088',lineNumber:2,code:'REP-011',description:'Reposición filtros HEPA y refrigerante R410A — Stock mínimo operativo',quantity:1,unit:'ZZ',unitValue:1770,igvAmount:0,lineTotal:1770,affectType:'10',pcgeAccount:'60-05',costCenter:'OPE-INFRA',category:'Materiales',iaConfidence:72,needsReview:true },
    { documentId:'E001-000012',lineNumber:1,code:'ARR-2604',description:'Arrendamiento oficina comercial — Piso 8 Torre Empresarial San Isidro — Abril 2026',quantity:1,unit:'MES',unitValue:8474.58,igvAmount:1525.42,lineTotal:10000,affectType:'10',pcgeAccount:'63-05',costCenter:'GE-ADM',category:'Arrendamiento',iaConfidence:97,isRecurrent:true },
    { documentId:'F003-000441',lineNumber:1,code:'HW-2024-A',description:'Servidor HPE ProLiant DL380 Gen10 — 2×Intel Xeon Gold 6242, 256 GB RAM, 4×SSD 960 GB',quantity:1,unit:'NI',unitValue:7500,igvAmount:1350,lineTotal:8850,affectType:'10',pcgeAccount:'33-00',costCenter:'TI-INFRA',category:'Activo fijo TI',iaConfidence:83,needsReview:true },
    { documentId:'F003-000441',lineNumber:2,code:'SW-LIC-001',description:'Licencia VMware vSphere Enterprise Plus — 2 sockets perpetua + soporte anual Premier',quantity:2,unit:'NI',unitValue:1500,igvAmount:270,lineTotal:3540,affectType:'10',pcgeAccount:'63-03',costCenter:'TI-INFRA',category:'Licencias Software',iaConfidence:89 },
    { documentId:'F003-000441',lineNumber:3,code:'SVC-INST',description:'Servicio instalación y configuración infraestructura virtualizada — 5 días onsite',quantity:5,unit:'DIA',unitValue:354,igvAmount:0,lineTotal:1770,affectType:'10',pcgeAccount:'63-03',costCenter:'TI-INFRA',category:'Servicio TI',iaConfidence:86 },
    { documentId:'FV01-002341',lineNumber:1,code:'SVC-ASE-01',description:'Servicio de asesoría contable y tributaria mensual — Abril 2026 — Empresa Los Andes',quantity:1,unit:'MES',unitValue:20000,igvAmount:3600,lineTotal:23600,affectType:'10',pcgeAccount:'72-11',costCenter:'SVC-CONTA',category:'Asesoría Contable',iaConfidence:96,isRecurrent:true },
    { documentId:'FV01-002342',lineNumber:1,code:'SVC-FIN-Q1',description:'Consultoría en gestión financiera y estructuración de deuda — Q1 2026 — 3 entregables',quantity:1,unit:'ZZ',unitValue:30000,igvAmount:5400,lineTotal:35400,affectType:'10',pcgeAccount:'72-11',costCenter:'SVC-FIN',category:'Consultoría Financiera',iaConfidence:93 },
    { documentId:'FV01-002342',lineNumber:2,code:'SVC-NIIF-01',description:'Implementación NIIF para PYMES — Diagnóstico inicial y adopción de políticas contables',quantity:1,unit:'ZZ',unitValue:20000,igvAmount:3600,lineTotal:23600,affectType:'10',pcgeAccount:'72-11',costCenter:'SVC-NIIF',category:'NIIF',iaConfidence:88 },
    { documentId:'NC01-000007',lineNumber:1,code:'NC-DES-01',description:'Nota de crédito por descuento comercial acordado — Ajuste sobre Factura F003-000441',quantity:1,unit:'ZZ',unitValue:-500,igvAmount:-90,lineTotal:-590,affectType:'10',pcgeAccount:'63-03',costCenter:'TI-INFRA',category:'Descuento',iaConfidence:95 },
  ];
  for (const l of lines) {
    await prisma.documentLine.upsert({
      where: { id: l.documentId + '-L' + l.lineNumber },
      update: {},
      create: { id: l.documentId + '-L' + l.lineNumber, ...l },
    });
  }
  console.log(`  ✓ ${lines.length} líneas de documentos`);

  // BANK MOVEMENTS
  const movs = [
    { companyId:emp1.id,date:'2026-04-02',description:'ABONO GRUPO ANDINO SA RUC 20654321098',type:'CRÉDITO',amount:23600,balance:145200,reconciled:true,matchDocId:'FV01-002341',matchName:'GRUPO ANDINO S.A.' },
    { companyId:emp1.id,date:'2026-04-04',description:'PAGO PROVEEDOR REP ALFA RUC 20100066603',type:'DÉBITO',amount:10384,balance:134816,reconciled:true,matchDocId:'F001-001234',matchName:'REP. ALFA S.A.C.' },
    { companyId:emp1.id,date:'2026-04-06',description:'DEPÓSITO EFECTIVO CAJA GENERAL',type:'CRÉDITO',amount:5000,balance:139816,reconciled:false },
    { companyId:emp1.id,date:'2026-04-07',description:'PAGO MANTENIMIENTOS PERU SRL',type:'DÉBITO',amount:5310,balance:134506,reconciled:true,matchDocId:'F002-000088',matchName:'MANTENIMIENTOS PERU S.R.L.' },
    { companyId:emp1.id,date:'2026-04-08',description:'ABONO MINA SANTA ROSA SA',type:'CRÉDITO',amount:118000,balance:252506,reconciled:false },
    { companyId:emp1.id,date:'2026-04-10',description:'PAGO SUNAT DETRACCIÓN 12% REP ALFA',type:'DÉBITO',amount:1416,balance:251090,reconciled:true,matchDocId:'F001-001234',matchName:'Detracción REP ALFA' },
    { companyId:emp1.id,date:'2026-04-12',description:'ITF BANCO — COMISIÓN TRANSFERENCIA',type:'DÉBITO',amount:25.38,balance:251064.62,reconciled:false },
    { companyId:emp1.id,date:'2026-04-15',description:'ABONO CONSTRUCTORA NORTE SAC',type:'CRÉDITO',amount:59000,balance:310064.62,reconciled:true,matchDocId:'FV01-002342',matchName:'CONSTRUCTORA NORTE S.A.C.' },
    { companyId:emp1.id,date:'2026-04-18',description:'PAGO ALQUILERES CORPORATIVOS SA',type:'DÉBITO',amount:10000,balance:300064.62,reconciled:true,matchDocId:'E001-000012',matchName:'ALQUILERES CORP. S.A.' },
    { companyId:emp1.id,date:'2026-04-22',description:'TRANSFERENCIA ENTRADA SOCIO CAPITALISTA',type:'CRÉDITO',amount:8500,balance:308564.62,reconciled:false },
    { companyId:emp1.id,date:'2026-04-25',description:'PAGO PLANILLA ABRIL 2026',type:'DÉBITO',amount:45000,balance:263564.62,reconciled:false },
    { companyId:emp1.id,date:'2026-04-28',description:'ABONO SERVICIOS GLOBALES SAC',type:'CRÉDITO',amount:9440,balance:273004.62,reconciled:true,matchDocId:'FV01-002343',matchName:'SERVICIOS GLOBALES SAC' },
  ];
  for (const m of movs) {
    await prisma.bankMovement.create({ data: m }).catch(() => {});
  }
  console.log(`  ✓ ${movs.length} movimientos bancarios`);

  // DETRACCIONES
  const detrs = [
    { companyId:emp1.id,documentId:'F001-001234',provider:'REP. ALFA S.A.C.',provRuc:'20100066603',amount:1416,pct:12,code:'022',account:'00-010-348912',status:'DEPOSITADO',depositDate:'2026-04-08' },
    { companyId:emp1.id,documentId:'E001-000012',provider:'ALQUILERES CORP. S.A.',provRuc:'20111222334',amount:1200,pct:12,code:'019',account:'00-010-348912',status:'PENDIENTE' },
    { companyId:emp1.id,documentId:'F002-000088',provider:'MANTENIMIENTOS PERU S.R.L.',provRuc:'20876543210',amount:530,pct:10,code:'014',account:'00-010-348912',status:'DEPOSITADO',depositDate:'2026-04-07' },
  ];
  for (const d of detrs) {
    await prisma.detraction.create({ data: d }).catch(() => {});
  }
  console.log(`  ✓ ${detrs.length} detracciones`);

  // CXC / CXP
  const cxcData = [
    { companyId:emp1.id,documentId:'FV01-002341',clientRuc:'20654321098',clientName:'GRUPO ANDINO S.A.',amount:23600,dueDate:'2026-05-02',status:'COBRADO',paidDate:'2026-04-02',paidAmount:23600 },
    { companyId:emp1.id,documentId:'FV01-002342',clientRuc:'20789012346',clientName:'CONSTRUCTORA NORTE S.A.C.',amount:59000,dueDate:'2026-05-05',status:'COBRADO',paidDate:'2026-04-15',paidAmount:59000 },
    { companyId:emp1.id,documentId:'FV01-002343',clientRuc:'20111333555',clientName:'SERVICIOS GLOBALES SAC',amount:9440,dueDate:'2026-05-08',status:'COBRADO',paidDate:'2026-04-28',paidAmount:9440 },
    { companyId:emp1.id,clientRuc:'20222333444',clientName:'INDUSTRIAS PERU SAC',amount:45000,dueDate:'2026-05-15',status:'POR_VENCER' },
    { companyId:emp1.id,clientRuc:'20444555666',clientName:'DISTRIBUIDORA ANDINA SAC',amount:18500,dueDate:'2026-04-20',status:'VENCIDO' },
  ];
  for (const r of cxcData) {
    await prisma.cxcRecord.create({ data: r }).catch(() => {});
  }

  const cxpData = [
    { companyId:emp1.id,documentId:'F001-001234',providerRuc:'20100066603',providerName:'REP. ALFA S.A.C.',amount:11800,dueDate:'2026-05-03',status:'PAGADO',paidDate:'2026-04-04',paidAmount:10384 },
    { companyId:emp1.id,documentId:'F002-000088',providerRuc:'20876543210',providerName:'MANTENIMIENTOS PERU S.R.L.',amount:5310,dueDate:'2026-04-20',status:'PAGADO',paidDate:'2026-04-07',paidAmount:5310 },
    { companyId:emp1.id,documentId:'E001-000012',providerRuc:'20111222334',providerName:'ALQUILERES CORP. S.A.',amount:10000,dueDate:'2026-04-30',status:'PAGADO',paidDate:'2026-04-18',paidAmount:10000 },
    { companyId:emp1.id,documentId:'F003-000441',providerRuc:'20333444556',providerName:'DELTA TEC. S.A.',amount:14160,dueDate:'2026-05-07',status:'POR_VENCER' },
    { companyId:emp1.id,providerRuc:'10987654321',providerName:'CONTADOR EXTERNO SAC',amount:3500,dueDate:'2026-04-25',status:'VENCIDO' },
  ];
  for (const r of cxpData) {
    await prisma.cxpRecord.create({ data: r }).catch(() => {});
  }
  console.log(`  ✓ ${cxcData.length} CxC + ${cxpData.length} CxP`);

  // AUDIT
  const adminU = await prisma.user.findUnique({ where: { email: 'admin@empresa.pe' } });
  const auditEvents = [
    { userEmail:'admin@empresa.pe',userRole:'Administrador',action:'SISTEMA_INICIALIZADO',object:'v2.0.0',ip:'127.0.0.1' },
    { userEmail:'mruiz@empresa.pe',userRole:'Contador',action:'SEED_COMPLETADO',object:`${docs.length} documentos`,ip:'127.0.0.1' },
    { userEmail:'admin@empresa.pe',userRole:'Administrador',action:'EMPRESA_CREADA',object:'20512345678',ip:'127.0.0.1' },
    { userEmail:'jlopez@empresa.pe',userRole:'Supervisor',action:'BULK_DOWNLOAD_EJECUTADO',object:'2026-04 COMPRAS+VENTAS',ip:'127.0.0.1' },
  ];
  for (const e of auditEvents) {
    await prisma.auditLog.create({ data: { ...e, userId: adminU?.id } });
  }

  console.log('\n✅ Seed completado exitosamente!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔑 CREDENCIALES DE ACCESO:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Admin:      admin@empresa.pe  / Admin123!');
  console.log('  Contador:   mruiz@empresa.pe  / Demo1234!');
  console.log('  Supervisor: jlopez@empresa.pe / Demo1234!');
  console.log('  Auditor:    aaudit@empresa.pe / Demo1234!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 npm run dev → http://localhost:3000\n');
}

main().catch(e => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
