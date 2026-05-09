// ══════════════════════════════════════════════════════════
//  Email Provider — Resend (gratis: 3,000/mes)
//  Fallback: SMTP con Nodemailer (Gmail, etc.)
//
//  Variables de entorno:
//    RESEND_API_KEY   — API key de resend.com (gratis)
//    EMAIL_FROM       — ej: alertas@shermanfinance.com
//    EMAIL_FROM_NAME  — ej: Sherman Finance
//
//  Fallback SMTP (opcional):
//    SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
// ══════════════════════════════════════════════════════════

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const FROM_NAME  = process.env.EMAIL_FROM_NAME  || 'Sherman Finance';
const FROM_EMAIL = process.env.EMAIL_FROM        || 'noreply@shermanfinance.com';
const FROM       = `${FROM_NAME} <${FROM_EMAIL}>`;

// ── Resend API ────────────────────────────────────────────
async function sendViaResend(msg: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY no configurado' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    FROM,
      to:      Array.isArray(msg.to) ? msg.to : [msg.to],
      subject: msg.subject,
      html:    msg.html,
      text:    msg.text,
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = await res.json() as { id?: string; message?: string; name?: string };
  if (!res.ok) {
    console.error(`[EMAIL] Resend error ${res.status}:`, data.message || data.name);
    return { ok: false, error: data.message || `HTTP ${res.status}` };
  }
  console.log(`[EMAIL] ✅ Enviado via Resend — ID: ${data.id}`);
  return { ok: true, id: data.id };
}

// ── Envío principal ───────────────────────────────────────
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[EMAIL] Sin proveedor configurado — email no enviado:', msg.subject);
    return { ok: false, error: 'Email no configurado. Agrega RESEND_API_KEY.' };
  }
  try {
    return await sendViaResend(msg);
  } catch (e) {
    console.error('[EMAIL] Error:', (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}

// ── Envío en lote ─────────────────────────────────────────
export async function sendEmailBulk(messages: EmailMessage[]): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;
  for (const msg of messages) {
    const r = await sendEmail(msg);
    if (r.ok) sent++; else failed++;
    await new Promise(r => setTimeout(r, 200));
  }
  return { sent, failed };
}

// ── Template base HTML ────────────────────────────────────
export function emailTemplate(title: string, body: string, footer?: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- HEADER -->
        <tr><td style="background:#0F172A;padding:24px 32px;">
          <div style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">⚡ Sherman Finance</div>
          <div style="color:#94A3B8;font-size:12px;margin-top:4px;">Sistema de Control Contable</div>
        </td></tr>
        <!-- BODY -->
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 20px;font-size:18px;color:#0F172A;">${title}</h2>
          ${body}
        </td></tr>
        <!-- FOOTER -->
        <tr><td style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #E2E8F0;">
          <div style="font-size:11px;color:#94A3B8;text-align:center;">
            ${footer || 'Sherman Finance · Sistema de Control Contable · Este es un mensaje automático, no responder.'}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── Helpers de formato ────────────────────────────────────
export function fmtMoney(n: number): string {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n);
}

export function alertRow(icon: string, label: string, value: string, color = '#0F172A'): string {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;">
      <span style="font-size:16px;">${icon}</span>
      <span style="font-size:13px;color:#374151;margin-left:8px;">${label}</span>
    </td>
    <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;text-align:right;font-weight:700;color:${color};font-size:13px;">${value}</td>
  </tr>`;
}

// ── Email de recuperación de contraseña ──────────────────
export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const link = `${appUrl}/reset-password?token=${token}`;

  const body = `
    <p style="font-size:14px;color:#374151;margin-bottom:20px;">
      Recibimos una solicitud para restablecer la contraseña de tu cuenta en Sherman Finance.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
        Restablecer contraseña
      </a>
    </div>
    <p style="font-size:12px;color:#9CA3AF;margin-top:20px;">
      Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este email.
    </p>
    <p style="font-size:11px;color:#D1D5DB;margin-top:8px;word-break:break-all;">
      ${link}
    </p>`;

  const html = emailTemplate('Restablecer contraseña', body);
  await sendEmail({ to, subject: '🔐 Restablecer contraseña — Sherman Finance', html });
}

// ── Email de bienvenida a nuevo usuario ──────────────────
export async function sendWelcomeEmail(to: string, name: string, tempPassword: string): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const body = `
    <p style="font-size:14px;color:#374151;margin-bottom:20px;">
      Hola <strong>${name}</strong>, tu cuenta en Sherman Finance ha sido creada.
    </p>
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div style="font-size:12px;color:#6B7280;margin-bottom:4px;">Email</div>
      <div style="font-size:14px;font-weight:700;color:#0F172A;font-family:monospace;">${to}</div>
      <div style="font-size:12px;color:#6B7280;margin-top:12px;margin-bottom:4px;">Contraseña temporal</div>
      <div style="font-size:18px;font-weight:800;color:#2563EB;font-family:monospace;">${tempPassword}</div>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${appUrl}" style="background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
        Ingresar al sistema
      </a>
    </div>
    <p style="font-size:12px;color:#9CA3AF;">Cambia tu contraseña después del primer ingreso.</p>`;

  const html = emailTemplate('Bienvenido a Sherman Finance', body);
  await sendEmail({ to, subject: '👋 Bienvenido a Sherman Finance — Tus credenciales', html });
}
