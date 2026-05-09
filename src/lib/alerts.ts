// ══════════════════════════════════════════════════════════
//  Motor de Alertas — Sherman Finance v2
//  Detecta situaciones críticas y envía WhatsApp
// ══════════════════════════════════════════════════════════

import { queryAll, execute } from './db';
import { sendWhatsApp, sendWhatsAppBulk } from './whatsapp';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}

function diffDays(target: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t = new Date(target); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  const MESES = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${parseInt(day)} ${MESES[parseInt(m)]} ${y}`;
}

// ── Obtener usuarios con teléfono de una empresa ──────────
async function getPhoneUsers(companyId: string): Promise<{ name: string; phone: string }[]> {
  const rows = await queryAll(
    `SELECT name, phone FROM users
     WHERE status='activo' AND phone IS NOT NULL AND phone != ''
     AND ("companyIds" LIKE $1 OR role='Administrador')`,
    [`%${companyId}%`]
  ) as { name: string; phone: string }[];
  return rows.filter(r => r.phone);
}

// ── Guardar log de alerta enviada (evita duplicados) ──────
async function alertaYaEnviada(companyId: string, tipo: string, ref: string): Promise<boolean> {
  const hoy = new Date().toISOString().split('T')[0];
  const rows = await queryAll(
    `SELECT id FROM alert_logs WHERE "companyId"=$1 AND tipo=$2 AND ref=$3 AND fecha=$4`,
    [companyId, tipo, ref, hoy]
  );
  return rows.length > 0;
}

async function registrarAlerta(companyId: string, tipo: string, ref: string): Promise<void> {
  const hoy = new Date().toISOString().split('T')[0];
  await execute(
    `INSERT INTO alert_logs ("companyId", tipo, ref, fecha, "createdAt")
     VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT DO NOTHING`,
    [companyId, tipo, ref, hoy]
  );
}

// ══════════════════════════════════════════════════════════
//  ALERTA 1: Detracciones próximas a vencer
//  Regla: vence el día 12 del mes siguiente
//  Avisar: 5 días antes y el mismo día
// ══════════════════════════════════════════════════════════
export async function alertarDetracciones(companyId: string, companyName: string): Promise<number> {
  const pendientes = await queryAll(
    `SELECT * FROM detractions WHERE "companyId"=$1 AND status='PENDIENTE'`,
    [companyId]
  ) as Record<string, unknown>[];

  const users = await getPhoneUsers(companyId);
  if (!users.length) return 0;

  let enviadas = 0;

  // Agrupar por fecha de vencimiento
  const porVencer = pendientes.filter(d => {
    // La detracción vence el día 12 del mes siguiente a la emisión
    const issueDate = d.createdAt as string || new Date().toISOString();
    const venc = new Date(issueDate);
    venc.setMonth(venc.getMonth() + 1);
    venc.setDate(12);
    const dias = diffDays(venc.toISOString().split('T')[0]);
    return dias >= 0 && dias <= 5;
  });

  if (porVencer.length === 0) return 0;

  // Calcular total
  const totalMonto = porVencer.reduce((s, d) => s + (d.amount as number), 0);
  const ref = `det-${new Date().toISOString().split('T')[0]}-${porVencer.length}`;

  if (await alertaYaEnviada(companyId, 'DETRACCION_VENCE', ref)) return 0;

  const msgs = users.map(u => ({
    to: u.phone,
    body: porVencer.length === 1
      ? `📋 *Sherman Finance*\n\nHola ${u.name}, tienes una detracción próxima a vencer:\n\n` +
        `• Proveedor: ${porVencer[0].provider}\n` +
        `• Monto: S/ ${fmt(porVencer[0].amount as number)}\n` +
        `• Vence: día 12 del mes\n\n` +
        `⚠️ Deposita en tu cuenta Banco de la Nación antes del vencimiento.\n\n_${companyName}_`
      : `📋 *Sherman Finance*\n\nHola ${u.name}, tienes *${porVencer.length} detracciones* próximas a vencer:\n\n` +
        `• Total a depositar: *S/ ${fmt(totalMonto)}*\n` +
        `• Vencen: día 12 del mes\n\n` +
        `⚠️ Deposita en tu cuenta Banco de la Nación antes del vencimiento.\n\n_${companyName}_`,
  }));

  const r = await sendWhatsAppBulk(msgs);
  if (r.sent > 0) {
    await registrarAlerta(companyId, 'DETRACCION_VENCE', ref);
    enviadas = r.sent;
  }
  return enviadas;
}

// ══════════════════════════════════════════════════════════
//  ALERTA 2: CXP vencidas o por vencer
//  Avisar: 3 días antes y cuando ya vencieron
// ══════════════════════════════════════════════════════════
export async function alertarCxp(companyId: string, companyName: string): Promise<number> {
  const pendientes = await queryAll(
    `SELECT * FROM cxp_records WHERE "companyId"=$1 AND status='PENDIENTE'`,
    [companyId]
  ) as Record<string, unknown>[];

  const users = await getPhoneUsers(companyId);
  if (!users.length) return 0;

  let enviadas = 0;

  // Vencidas hoy o en los próximos 3 días
  const criticas = pendientes.filter(d => {
    const dias = diffDays(d.dueDate as string);
    return dias >= -1 && dias <= 3;
  });

  if (criticas.length === 0) return 0;

  const vencidas   = criticas.filter(d => diffDays(d.dueDate as string) < 0);
  const porVencer  = criticas.filter(d => diffDays(d.dueDate as string) >= 0);
  const totalMonto = criticas.reduce((s, d) => s + (d.amount as number), 0);
  const ref = `cxp-${new Date().toISOString().split('T')[0]}`;

  if (await alertaYaEnviada(companyId, 'CXP_VENCE', ref)) return 0;

  let texto = `💳 *Sherman Finance*\n\nHola, tienes facturas de proveedores pendientes:\n\n`;
  if (vencidas.length > 0) {
    texto += `🔴 *${vencidas.length} VENCIDAS* — S/ ${fmt(vencidas.reduce((s, d) => s + (d.amount as number), 0))}\n`;
  }
  if (porVencer.length > 0) {
    texto += `🟡 *${porVencer.length} por vencer* — S/ ${fmt(porVencer.reduce((s, d) => s + (d.amount as number), 0))}\n`;
  }
  texto += `\n*Total: S/ ${fmt(totalMonto)}*\n\n`;

  // Listar hasta 3 proveedores
  criticas.slice(0, 3).forEach(d => {
    const dias = diffDays(d.dueDate as string);
    const estado = dias < 0 ? `vencida hace ${Math.abs(dias)}d` : dias === 0 ? 'vence HOY' : `vence en ${dias}d`;
    texto += `• ${(d.providerName as string).substring(0, 25)} — S/ ${fmt(d.amount as number)} (${estado})\n`;
  });
  if (criticas.length > 3) texto += `• ...y ${criticas.length - 3} más\n`;
  texto += `\n_${companyName}_`;

  const msgs = users.map(u => ({ to: u.phone, body: texto }));
  const r = await sendWhatsAppBulk(msgs);
  if (r.sent > 0) {
    await registrarAlerta(companyId, 'CXP_VENCE', ref);
    enviadas = r.sent;
  }
  return enviadas;
}

// ══════════════════════════════════════════════════════════
//  ALERTA 3: Documentos observados por SUNAT
//  Avisar cuando hay docs con sunatStatus = OBSERVADO
// ══════════════════════════════════════════════════════════
export async function alertarObservados(companyId: string, companyName: string): Promise<number> {
  const observados = await queryAll(
    `SELECT * FROM documents WHERE "companyId"=$1 AND "sunatStatus"='OBSERVADO'`,
    [companyId]
  ) as Record<string, unknown>[];

  if (observados.length === 0) return 0;

  const users = await getPhoneUsers(companyId);
  if (!users.length) return 0;

  const ref = `obs-${new Date().toISOString().split('T')[0]}-${observados.length}`;
  if (await alertaYaEnviada(companyId, 'DOCS_OBSERVADOS', ref)) return 0;

  const totalMonto = observados.reduce((s, d) => s + Math.abs(d.total as number), 0);
  let texto = `⚠️ *Sherman Finance*\n\n`;
  texto += `Tienes *${observados.length} comprobante${observados.length > 1 ? 's' : ''} observado${observados.length > 1 ? 's' : ''}* en SUNAT:\n\n`;

  observados.slice(0, 4).forEach(d => {
    const tipo = d.operation === 'COMPRA' ? '📥' : '📤';
    texto += `${tipo} ${d.serie}-${d.number} — S/ ${fmt(Math.abs(d.total as number))}\n`;
  });
  if (observados.length > 4) texto += `• ...y ${observados.length - 4} más\n`;
  texto += `\n*Total afectado: S/ ${fmt(totalMonto)}*\n`;
  texto += `\nRevisa en Sherman Finance → Documentos → Filtro: Observados\n\n_${companyName}_`;

  const msgs = users.map(u => ({ to: u.phone, body: texto }));
  const r = await sendWhatsAppBulk(msgs);
  if (r.sent > 0) {
    await registrarAlerta(companyId, 'DOCS_OBSERVADOS', ref);
    return r.sent;
  }
  return 0;
}

// ══════════════════════════════════════════════════════════
//  ALERTA 4: CXC vencidas (facturas de venta sin cobrar)
// ══════════════════════════════════════════════════════════
export async function alertarCxc(companyId: string, companyName: string): Promise<number> {
  const vencidas = await queryAll(
    `SELECT * FROM cxc_records WHERE "companyId"=$1 AND status='PENDIENTE' AND "dueDate" < CURRENT_DATE`,
    [companyId]
  ) as Record<string, unknown>[];

  if (vencidas.length === 0) return 0;

  const users = await getPhoneUsers(companyId);
  if (!users.length) return 0;

  const ref = `cxc-${new Date().toISOString().split('T')[0]}`;
  if (await alertaYaEnviada(companyId, 'CXC_VENCIDA', ref)) return 0;

  const totalMonto = vencidas.reduce((s, d) => s + (d.amount as number), 0);
  let texto = `💰 *Sherman Finance*\n\n`;
  texto += `Tienes *${vencidas.length} factura${vencidas.length > 1 ? 's' : ''} de venta vencida${vencidas.length > 1 ? 's' : ''}* sin cobrar:\n\n`;

  vencidas.slice(0, 3).forEach(d => {
    const dias = Math.abs(diffDays(d.dueDate as string));
    texto += `• ${(d.clientName as string).substring(0, 25)} — S/ ${fmt(d.amount as number)} (hace ${dias}d)\n`;
  });
  if (vencidas.length > 3) texto += `• ...y ${vencidas.length - 3} más\n`;
  texto += `\n*Total por cobrar: S/ ${fmt(totalMonto)}*\n\n_${companyName}_`;

  const msgs = users.map(u => ({ to: u.phone, body: texto }));
  const r = await sendWhatsAppBulk(msgs);
  if (r.sent > 0) {
    await registrarAlerta(companyId, 'CXC_VENCIDA', ref);
    return r.sent;
  }
  return 0;
}

// ══════════════════════════════════════════════════════════
//  RUNNER PRINCIPAL — Ejecutar todas las alertas
// ══════════════════════════════════════════════════════════
export async function runAlertas(companyId: string, companyName: string): Promise<{
  detracciones: number;
  cxp: number;
  cxc: number;
  observados: number;
  total: number;
}> {
  console.log(`[ALERTAS] Iniciando para ${companyName} (${companyId})`);

  const [detracciones, cxp, cxc, observados] = await Promise.all([
    alertarDetracciones(companyId, companyName).catch(e => { console.error('[ALERTAS] det:', e.message); return 0; }),
    alertarCxp(companyId, companyName).catch(e => { console.error('[ALERTAS] cxp:', e.message); return 0; }),
    alertarCxc(companyId, companyName).catch(e => { console.error('[ALERTAS] cxc:', e.message); return 0; }),
    alertarObservados(companyId, companyName).catch(e => { console.error('[ALERTAS] obs:', e.message); return 0; }),
  ]);

  const total = detracciones + cxp + cxc + observados;
  console.log(`[ALERTAS] Completado — det:${detracciones} cxp:${cxp} cxc:${cxc} obs:${observados} total:${total}`);
  return { detracciones, cxp, cxc, observados, total };
}
