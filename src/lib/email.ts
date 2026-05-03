import nodemailer from 'nodemailer';

function getTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  // Development: log to console instead of sending
  return null;
}

const FROM = `"Sherman Finance Control AI" <${process.env.SMTP_FROM || 'noreply@shermanfinance.pe'}>`;

export async function sendWelcomeEmail(to: string, name: string, tempPassword: string) {
  const t = getTransporter();
  if (!t) { console.log(`[EMAIL] Welcome to ${to}: tempPass=${tempPassword}`); return; }
  await t.sendMail({
    from: FROM, to,
    subject: 'Bienvenido a Sherman Finance Control AI',
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0F172A;padding:2rem;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:20px">Sherman Finance Control AI</h1>
          <p style="color:rgba(255,255,255,.6);margin:.5rem 0 0">Sistema contable · SUNAT/SIRE · CONCAR</p>
        </div>
        <div style="background:#fff;padding:2rem;border:1px solid #E2E8F0;border-top:none">
          <h2 style="color:#111827;margin:0 0 1rem">Hola ${name} 👋</h2>
          <p style="color:#374151">Tu cuenta ha sido creada. Estos son tus datos de acceso:</p>
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:1rem;margin:1rem 0">
            <div><strong>Email:</strong> ${to}</div>
            <div style="margin-top:.5rem"><strong>Contraseña temporal:</strong> <code style="background:#E2E8F0;padding:2px 8px;border-radius:4px">${tempPassword}</code></div>
          </div>
          <p style="color:#6B7280;font-size:13px">⚠ Cambia tu contraseña en el primer inicio de sesión.</p>
          <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard" style="display:inline-block;background:#2563EB;color:#fff;padding:.75rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600;margin-top:1rem">Iniciar sesión →</a>
        </div>
      </div>
    `,
  });
}

export async function sendAlertEmail(to: string, alerts: { message: string; level: string }[]) {
  const t = getTransporter();
  if (!t) { console.log(`[EMAIL] Alerts to ${to}:`, alerts.map(a=>a.message).join(', ')); return; }
  const errorCount = alerts.filter(a => a.level === 'error').length;
  await t.sendMail({
    from: FROM, to,
    subject: `⚠ ${errorCount > 0 ? errorCount + ' alertas urgentes' : 'Notificaciones'} — Sherman Finance`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0F172A;padding:1.5rem;border-radius:12px 12px 0 0">
          <h2 style="color:#fff;margin:0;font-size:18px">Alertas del sistema</h2>
        </div>
        <div style="background:#fff;padding:1.5rem;border:1px solid #E2E8F0;border-top:none">
          ${alerts.map(a => `
            <div style="border-left:4px solid ${a.level==='error'?'#DC2626':a.level==='warning'?'#D97706':'#2563EB'};padding:.75rem 1rem;margin-bottom:.75rem;background:${a.level==='error'?'#FEF2F2':a.level==='warning'?'#FFFBEB':'#EFF6FF'}">
              <span style="color:${a.level==='error'?'#DC2626':a.level==='warning'?'#D97706':'#2563EB'};font-weight:600">${a.message}</span>
            </div>
          `).join('')}
          <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard" style="display:inline-block;background:#2563EB;color:#fff;padding:.6rem 1.2rem;border-radius:8px;text-decoration:none;font-weight:600;margin-top:1rem;font-size:13px">Ver en el sistema →</a>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetToken: string) {
  const t = getTransporter();
  const url = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  if (!t) { console.log(`[EMAIL] Reset password for ${to}: ${url}`); return; }
  await t.sendMail({
    from: FROM, to,
    subject: 'Restablecer contraseña — Sherman Finance',
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0F172A;padding:1.5rem;border-radius:12px 12px 0 0">
          <h2 style="color:#fff;margin:0">Restablecer contraseña</h2>
        </div>
        <div style="background:#fff;padding:1.5rem;border:1px solid #E2E8F0;border-top:none">
          <p style="color:#374151">Hemos recibido una solicitud para restablecer tu contraseña.</p>
          <a href="${url}" style="display:inline-block;background:#2563EB;color:#fff;padding:.75rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600">Restablecer contraseña →</a>
          <p style="color:#9CA3AF;font-size:12px;margin-top:1rem">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este email.</p>
        </div>
      </div>
    `,
  });
}
