import { NextRequest } from 'next/server';
import { execute, queryAll } from '@/lib/db';
import { sendEmail, emailTemplate } from '@/lib/email';
import { ok, err } from '@/lib/response';

// ── Migración inline: crear tabla si no existe ────────────
async function ensureTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS demo_requests (
      id          SERIAL PRIMARY KEY,
      nombre      VARCHAR(200) NOT NULL,
      email       VARCHAR(200) NOT NULL,
      whatsapp    VARCHAR(30)  NOT NULL,
      estudio     VARCHAR(200) NOT NULL,
      ruc         VARCHAR(20),
      num_clientes VARCHAR(20),
      como_encontro VARCHAR(50),
      mensaje     TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, email, whatsapp, estudio, ruc, numClientes, comoEncontro, mensaje } = body;

    if (!nombre || !email || !whatsapp || !estudio) {
      return err('Nombre, email, WhatsApp y estudio son requeridos');
    }

    await ensureTable();

    // 1. Guardar en BD
    await execute(
      `INSERT INTO demo_requests (nombre, email, whatsapp, estudio, ruc, num_clientes, como_encontro, mensaje)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [nombre, email, whatsapp, estudio, ruc || null, numClientes || null, comoEncontro || null, mensaje || null]
    );

    // 2. Email al admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@shermaninmobiliaria.pe';
    const adminHtml = emailTemplate(
      '🚀 Nueva solicitud de demo',
      `<table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#6B7280;">Nombre</td><td style="text-align:right;font-weight:700;font-size:13px;color:#0F172A;">${nombre}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#6B7280;">Email</td><td style="text-align:right;font-weight:700;font-size:13px;color:#2563EB;">${email}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#6B7280;">WhatsApp</td><td style="text-align:right;font-weight:700;font-size:13px;color:#0F172A;">${whatsapp}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#6B7280;">Estudio/Empresa</td><td style="text-align:right;font-weight:700;font-size:13px;color:#0F172A;">${estudio}</td></tr>
        ${ruc ? `<tr><td style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#6B7280;">RUC</td><td style="text-align:right;font-weight:700;font-size:13px;font-family:monospace;color:#0F172A;">${ruc}</td></tr>` : ''}
        <tr><td style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#6B7280;">Clientes que maneja</td><td style="text-align:right;font-weight:700;font-size:13px;color:#0F172A;">${numClientes || '—'}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#6B7280;">Cómo nos encontró</td><td style="text-align:right;font-weight:700;font-size:13px;color:#0F172A;">${comoEncontro || '—'}</td></tr>
        ${mensaje ? `<tr><td colspan="2" style="padding:12px 0;font-size:13px;color:#374151;"><strong>Mensaje:</strong><br/>${mensaje}</td></tr>` : ''}
      </table>
      <div style="background:#EFF6FF;border-radius:8px;padding:12px 16px;margin-top:16px;font-size:13px;color:#1D4ED8;">
        📱 Contactar por WhatsApp: <strong>${whatsapp}</strong>
      </div>`
    );

    await sendEmail({
      to: adminEmail,
      subject: `🚀 Nueva demo: ${nombre} — ${estudio}`,
      html: adminHtml,
    });

    // 3. Email de confirmación al prospecto
    const confirmHtml = emailTemplate(
      '¡Solicitud recibida! 🚀',
      `<p style="font-size:15px;color:#374151;margin-bottom:16px;">Hola <strong>${nombre}</strong>,</p>
       <p style="font-size:14px;color:#374151;line-height:1.8;margin-bottom:20px;">
         Gracias por tu interés en <strong>Sherman Finance</strong>. Hemos recibido tu solicitud de demo.
       </p>
       <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:20px;margin-bottom:20px;text-align:center;">
         <div style="font-size:32px;margin-bottom:8px;">📱</div>
         <div style="font-size:14px;color:#1D4ED8;font-weight:700;">Te contactaremos en menos de 24 horas</div>
         <div style="font-size:13px;color:#3B82F6;margin-top:4px;">al WhatsApp: <strong>${whatsapp}</strong></div>
       </div>
       <p style="font-size:13px;color:#6B7280;line-height:1.8;">
         Mientras tanto, puedes explorar el sistema en modo demo en:<br/>
         <a href="${process.env.APP_URL || 'https://shermanfinance.pe'}" style="color:#2563EB;font-weight:700;">${process.env.APP_URL || 'https://shermanfinance.pe'}</a>
       </p>`,
      'Equipo Sherman Finance · contacto@shermanfinance.pe'
    );

    await sendEmail({
      to: email,
      subject: '✅ Solicitud de demo recibida — Sherman Finance',
      html: confirmHtml,
    });

    return ok({ success: true, message: '¡Solicitud enviada! Te contactamos pronto 🚀' });

  } catch (e) {
    console.error('[DEMO]', (e as Error).message);
    return err((e as Error).message, 500);
  }
}

// GET — listar solicitudes (solo admin)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return err('No autorizado', 401);

  try {
    await ensureTable();
    const rows = await queryAll(`SELECT * FROM demo_requests ORDER BY "createdAt" DESC LIMIT 100`);
    return ok(rows);
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
