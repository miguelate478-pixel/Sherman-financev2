// ══════════════════════════════════════════════════════════
//  Motor de Alertas — Sherman Finance v2
//  Envía emails automáticos via Resend (gratis)
// ══════════════════════════════════════════════════════════

import { queryAll, execute } from './db';
import { sendEmailBulk, emailTemplate, fmtMoney, alertRow } from './email';

function diffDays(target: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t = new Date(target); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}

// ── Obtener emails de usuarios activos de una empresa ─────
async function getEmailUsers(companyId: string): Promise<{ name: string; email: string }[]> {
  const rows = await queryAll(
    `SELECT name, email FROM users
     WHERE status='activo' AND email IS NOT NULL AND email != ''
     AND ("companyIds" LIKE $1 OR role='Administrador')`,
    [`%${companyId}%`]
  ) as { name: string; email: string }[];
  return rows;
}

// ── Anti-duplicado: una alerta por tipo por día ───────────
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
//  ALERTA 1: Detracciones próximas a vencer (día 12)
//  Avisa 5 días antes
// ══════════════════════════════════════════════════════════
export async function alertarDetracciones(companyId: string, companyName: string): Promise<number> {
  const pendientes = await queryAll(
    `SELECT * FROM detractions WHERE "companyId"=$1 AND status='PENDIENTE'`,
    [companyId]
  ) as Record<string, unknown>[];

  const porVencer = pendientes.filter(d => {
    const venc = new Date(d.createdAt as string || new Date().toISOString());
    venc.setMonth(venc.getMonth() + 1);
    venc.setDate(12);
    const dias = diffDays(venc.toISOString().split('T')[0]);
    return dias >= 0 && dias <= 5;
  });

  if (porVencer.length === 0) return 0;

  const users = await getEmailUsers(companyId);
  if (!users.length) return 0;

  const ref = `det-${new Date().toISOString().split('T')[0]}`;
  if (await alertaYaEnviada(companyId, 'DETRACCION_VENCE', ref)) return 0;

  const totalMonto = porVencer.reduce((s, d) => s + (d.amount as number), 0);

  const rows = porVencer.slice(0, 5).map(d =>
    alertRow('◑', String(d.provider).substring(0, 35), `S/ ${fmtMoney(d.amount as number)}`, '#D97706')
  ).join('');

  const body = `
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div style="font-size:14px;font-weight:700;color:#D97706;">⚠️ Detracciones próximas a vencer</div>
      <div style="font-size:13px;color:#92400E;margin-top:4px;">Vencen el día 12 del mes. Deposita en tu cuenta Banco de la Nación.</div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    ${porVencer.length > 5 ? `<div style="font-size:12px;color:#6B7280;margin-top:8px;">...y ${porVencer.length - 5} más</div>` : ''}
    <div style="background:#F8FAFC;border-radius:8px;padding:16px;margin-top:20px;text-align:center;">
      <div style="font-size:13px;color:#374151;">Total a depositar</div>
      <div style="font-size:28px;font-weight:800;color:#D97706;">S/ ${fmtMoney(totalMonto)}</div>
    </div>`;

  const html = emailTemplate(`◑ ${porVencer.length} detracción${porVencer.length > 1 ? 'es' : ''} por vencer — ${companyName}`, body);

  const msgs = users.map(u => ({
    to: u.email,
    subject: `⚠️ ${porVencer.length} detracción${porVencer.length > 1 ? 'es' : ''} vence${porVencer.length === 1 ? '' : 'n'} pronto — ${companyName}`,
    html,
    text: `Tienes ${porVencer.length} detracciones por vencer. Total: S/ ${fmtMoney(totalMonto)}. Deposita antes del día 12.`,
  }));

  const r = await sendEmailBulk(msgs);
  if (r.sent > 0) await registrarAlerta(companyId, 'DETRACCION_VENCE', ref);
  return r.sent;
}

// ══════════════════════════════════════════════════════════
//  ALERTA 2: CXP vencidas o por vencer (3 días)
// ══════════════════════════════════════════════════════════
export async function alertarCxp(companyId: string, companyName: string): Promise<number> {
  const pendientes = await queryAll(
    `SELECT * FROM cxp_records WHERE "companyId"=$1 AND status='PENDIENTE'`,
    [companyId]
  ) as Record<string, unknown>[];

  const criticas = pendientes.filter(d => {
    const dias = diffDays(d.dueDate as string);
    return dias >= -7 && dias <= 3;
  });

  if (criticas.length === 0) return 0;

  const users = await getEmailUsers(companyId);
  if (!users.length) return 0;

  const ref = `cxp-${new Date().toISOString().split('T')[0]}`;
  if (await alertaYaEnviada(companyId, 'CXP_VENCE', ref)) return 0;

  const vencidas  = criticas.filter(d => diffDays(d.dueDate as string) < 0);
  const porVencer = criticas.filter(d => diffDays(d.dueDate as string) >= 0);
  const total     = criticas.reduce((s, d) => s + (d.amount as number), 0);

  const rows = criticas.slice(0, 6).map(d => {
    const dias = diffDays(d.dueDate as string);
    const estado = dias < 0 ? `Vencida hace ${Math.abs(dias)}d` : dias === 0 ? 'Vence HOY' : `Vence en ${dias}d`;
    const color  = dias < 0 ? '#DC2626' : dias === 0 ? '#D97706' : '#2563EB';
    return alertRow('←', `${String(d.providerName).substring(0, 30)} · ${estado}`, `S/ ${fmtMoney(d.amount as number)}`, color);
  }).join('');

  const body = `
    ${vencidas.length > 0 ? `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:12px 16px;margin-bottom:12px;font-size:13px;color:#DC2626;font-weight:700;">🔴 ${vencidas.length} factura${vencidas.length > 1 ? 's' : ''} VENCIDA${vencidas.length > 1 ? 'S' : ''} — S/ ${fmtMoney(vencidas.reduce((s, d) => s + (d.amount as number), 0))}</div>` : ''}
    ${porVencer.length > 0 ? `<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#D97706;font-weight:700;">🟡 ${porVencer.length} factura${porVencer.length > 1 ? 's' : ''} por vencer — S/ ${fmtMoney(porVencer.reduce((s, d) => s + (d.amount as number), 0))}</div>` : ''}
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    ${criticas.length > 6 ? `<div style="font-size:12px;color:#6B7280;margin-top:8px;">...y ${criticas.length - 6} más</div>` : ''}
    <div style="background:#F8FAFC;border-radius:8px;padding:16px;margin-top:20px;text-align:center;">
      <div style="font-size:13px;color:#374151;">Total pendiente</div>
      <div style="font-size:28px;font-weight:800;color:#DC2626;">S/ ${fmtMoney(total)}</div>
    </div>`;

  const html = emailTemplate(`← Facturas de proveedores pendientes — ${companyName}`, body);

  const msgs = users.map(u => ({
    to: u.email,
    subject: `💳 ${criticas.length} factura${criticas.length > 1 ? 's' : ''} de proveedor${vencidas.length > 0 ? ' VENCIDA' + (vencidas.length > 1 ? 'S' : '') : ' por vencer'} — ${companyName}`,
    html,
    text: `Tienes ${vencidas.length} facturas vencidas y ${porVencer.length} por vencer. Total: S/ ${fmtMoney(total)}.`,
  }));

  const r = await sendEmailBulk(msgs);
  if (r.sent > 0) await registrarAlerta(companyId, 'CXP_VENCE', ref);
  return r.sent;
}

// ══════════════════════════════════════════════════════════
//  ALERTA 3: Documentos observados por SUNAT
// ══════════════════════════════════════════════════════════
export async function alertarObservados(companyId: string, companyName: string): Promise<number> {
  const observados = await queryAll(
    `SELECT * FROM documents WHERE "companyId"=$1 AND "sunatStatus"='OBSERVADO'`,
    [companyId]
  ) as Record<string, unknown>[];

  if (observados.length === 0) return 0;

  const users = await getEmailUsers(companyId);
  if (!users.length) return 0;

  const ref = `obs-${new Date().toISOString().split('T')[0]}-${observados.length}`;
  if (await alertaYaEnviada(companyId, 'DOCS_OBSERVADOS', ref)) return 0;

  const total = observados.reduce((s, d) => s + Math.abs(d.total as number), 0);

  const rows = observados.slice(0, 6).map(d => {
    const icon = d.operation === 'COMPRA' ? '📥' : '📤';
    return alertRow(icon, `${d.serie}-${d.number} · ${d.issuerName || d.receiverName || ''}`.substring(0, 40), `S/ ${fmtMoney(Math.abs(d.total as number))}`, '#DC2626');
  }).join('');

  const body = `
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div style="font-size:14px;font-weight:700;color:#DC2626;">⚠️ Comprobantes observados en SUNAT</div>
      <div style="font-size:13px;color:#991B1B;margin-top:4px;">Revisa y regulariza estos comprobantes para evitar problemas tributarios.</div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    ${observados.length > 6 ? `<div style="font-size:12px;color:#6B7280;margin-top:8px;">...y ${observados.length - 6} más</div>` : ''}
    <div style="background:#F8FAFC;border-radius:8px;padding:16px;margin-top:20px;text-align:center;">
      <div style="font-size:13px;color:#374151;">Total afectado</div>
      <div style="font-size:28px;font-weight:800;color:#DC2626;">S/ ${fmtMoney(total)}</div>
    </div>`;

  const html = emailTemplate(`⚠️ ${observados.length} comprobante${observados.length > 1 ? 's' : ''} observado${observados.length > 1 ? 's' : ''} — ${companyName}`, body);

  const msgs = users.map(u => ({
    to: u.email,
    subject: `⚠️ ${observados.length} comprobante${observados.length > 1 ? 's' : ''} observado${observados.length > 1 ? 's' : ''} en SUNAT — ${companyName}`,
    html,
    text: `Tienes ${observados.length} comprobantes observados en SUNAT. Total afectado: S/ ${fmtMoney(total)}.`,
  }));

  const r = await sendEmailBulk(msgs);
  if (r.sent > 0) await registrarAlerta(companyId, 'DOCS_OBSERVADOS', ref);
  return r.sent;
}

// ══════════════════════════════════════════════════════════
//  ALERTA 4: CXC vencidas (facturas de venta sin cobrar)
// ══════════════════════════════════════════════════════════
export async function alertarCxc(companyId: string, companyName: string): Promise<number> {
  const vencidas = await queryAll(
    `SELECT * FROM cxc_records WHERE "companyId"=$1 AND status='PENDIENTE' AND "dueDate"::date < CURRENT_DATE`,
    [companyId]
  ) as Record<string, unknown>[];

  if (vencidas.length === 0) return 0;

  const users = await getEmailUsers(companyId);
  if (!users.length) return 0;

  const ref = `cxc-${new Date().toISOString().split('T')[0]}`;
  if (await alertaYaEnviada(companyId, 'CXC_VENCIDA', ref)) return 0;

  const total = vencidas.reduce((s, d) => s + (d.amount as number), 0);

  const rows = vencidas.slice(0, 6).map(d => {
    const dias = Math.abs(diffDays(d.dueDate as string));
    return alertRow('→', `${String(d.clientName).substring(0, 30)} · hace ${dias}d`, `S/ ${fmtMoney(d.amount as number)}`, '#7C3AED');
  }).join('');

  const body = `
    <div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div style="font-size:14px;font-weight:700;color:#7C3AED;">💰 Facturas de venta sin cobrar</div>
      <div style="font-size:13px;color:#5B21B6;margin-top:4px;">Estas facturas ya vencieron. Gestiona el cobro con tus clientes.</div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    ${vencidas.length > 6 ? `<div style="font-size:12px;color:#6B7280;margin-top:8px;">...y ${vencidas.length - 6} más</div>` : ''}
    <div style="background:#F8FAFC;border-radius:8px;padding:16px;margin-top:20px;text-align:center;">
      <div style="font-size:13px;color:#374151;">Total por cobrar</div>
      <div style="font-size:28px;font-weight:800;color:#7C3AED;">S/ ${fmtMoney(total)}</div>
    </div>`;

  const html = emailTemplate(`→ ${vencidas.length} factura${vencidas.length > 1 ? 's' : ''} vencida${vencidas.length > 1 ? 's' : ''} sin cobrar — ${companyName}`, body);

  const msgs = users.map(u => ({
    to: u.email,
    subject: `💰 ${vencidas.length} factura${vencidas.length > 1 ? 's' : ''} de venta vencida${vencidas.length > 1 ? 's' : ''} sin cobrar — ${companyName}`,
    html,
    text: `Tienes ${vencidas.length} facturas de venta vencidas sin cobrar. Total: S/ ${fmtMoney(total)}.`,
  }));

  const r = await sendEmailBulk(msgs);
  if (r.sent > 0) await registrarAlerta(companyId, 'CXC_VENCIDA', ref);
  return r.sent;
}

// ══════════════════════════════════════════════════════════
//  RUNNER PRINCIPAL
// ══════════════════════════════════════════════════════════
export async function runAlertas(companyId: string, companyName: string): Promise<{
  detracciones: number; cxp: number; cxc: number; observados: number; total: number;
}> {
  console.log(`[ALERTAS] Iniciando para ${companyName} (${companyId})`);
  const [detracciones, cxp, cxc, observados] = await Promise.all([
    alertarDetracciones(companyId, companyName).catch(e => { console.error('[ALERTAS] det:', e.message); return 0; }),
    alertarCxp(companyId, companyName).catch(e => { console.error('[ALERTAS] cxp:', e.message); return 0; }),
    alertarCxc(companyId, companyName).catch(e => { console.error('[ALERTAS] cxc:', e.message); return 0; }),
    alertarObservados(companyId, companyName).catch(e => { console.error('[ALERTAS] obs:', e.message); return 0; }),
  ]);
  const total = detracciones + cxp + cxc + observados;
  console.log(`[ALERTAS] Completado — det:${detracciones} cxp:${cxp} cxc:${cxc} obs:${observados}`);
  return { detracciones, cxp, cxc, observados, total };
}
