import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized, getIP } from '@/lib/response';
import { queryAll, findCompanyById, createAuditLog } from '@/lib/db';
import { runAlertas } from '@/lib/alerts';
import { sendEmail, emailTemplate } from '@/lib/email';

// GET /api/alerts?companyId=xxx
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');

  try {
    const logs = companyId
      ? await queryAll(`SELECT * FROM alert_logs WHERE "companyId"=$1 ORDER BY "createdAt" DESC LIMIT 50`, [companyId])
      : await queryAll(`SELECT * FROM alert_logs ORDER BY "createdAt" DESC LIMIT 100`);

    const usersWithEmail = await queryAll(
      `SELECT id, name, email, role FROM users WHERE email IS NOT NULL AND status='activo'`
    );

    let pendientes = null;
    if (companyId) {
      const [dets, cxps, cxcs, obs] = await Promise.all([
        queryAll(`SELECT COUNT(*) as n FROM detractions WHERE "companyId"=$1 AND status='PENDIENTE'`, [companyId]),
        queryAll(`SELECT COUNT(*) as n FROM cxp_records WHERE "companyId"=$1 AND status='PENDIENTE' AND "dueDate" <= CURRENT_DATE + INTERVAL '3 days'`, [companyId]),
        queryAll(`SELECT COUNT(*) as n FROM cxc_records WHERE "companyId"=$1 AND status='PENDIENTE' AND "dueDate" < CURRENT_DATE`, [companyId]),
        queryAll(`SELECT COUNT(*) as n FROM documents WHERE "companyId"=$1 AND "sunatStatus"='OBSERVADO'`, [companyId]),
      ]);
      pendientes = {
        detracciones: parseInt((dets[0] as Record<string,string>).n || '0'),
        cxpCriticas:  parseInt((cxps[0] as Record<string,string>).n || '0'),
        cxcVencidas:  parseInt((cxcs[0] as Record<string,string>).n || '0'),
        observados:   parseInt((obs[0]  as Record<string,string>).n || '0'),
      };
    }

    return ok({
      logs,
      usersWithEmail,
      pendientes,
      resendConfigured: !!process.env.RESEND_API_KEY,
    });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}

// POST /api/alerts
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const { action, companyId, email } = body;

    // ── Test: enviar email de prueba ─────────────────────
    if (action === 'test') {
      if (!email) return err('email requerido');
      const html = emailTemplate(
        '✅ Prueba de conexión exitosa',
        `<p style="font-size:14px;color:#374151;">Las alertas por email están configuradas correctamente en <strong>Sherman Finance</strong>.</p>
         <p style="font-size:13px;color:#6B7280;margin-top:12px;">Recibirás notificaciones automáticas sobre:</p>
         <ul style="font-size:13px;color:#374151;line-height:2;">
           <li>◑ Detracciones próximas a vencer</li>
           <li>← Facturas de proveedores vencidas</li>
           <li>→ Facturas de venta sin cobrar</li>
           <li>⚠️ Comprobantes observados en SUNAT</li>
         </ul>
         <p style="font-size:12px;color:#9CA3AF;margin-top:16px;">${new Date().toLocaleString('es-PE')}</p>`
      );
      const r = await sendEmail({ to: email, subject: '✅ Sherman Finance — Prueba de alertas', html });
      return ok(r);
    }

    // ── Ejecutar alertas manualmente ─────────────────────
    if (action === 'run') {
      if (!companyId) return err('companyId requerido');
      const company = await findCompanyById(companyId);
      if (!company) return err('Empresa no encontrada');

      const result = await runAlertas(companyId, (company.nombre || company.ruc) as string);

      await createAuditLog({
        userId: user.sub, userEmail: user.email, userRole: user.role,
        action: 'ALERTAS_EMAIL_MANUAL',
        object: `${companyId} — ${result.total} emails enviados`,
        ip: getIP(req),
      });

      return ok({ ...result, message: `${result.total} alertas enviadas` });
    }

    return err('action inválido. Usa: test | run');
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
