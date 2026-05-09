import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized, getIP } from '@/lib/response';
import { queryAll, execute, findCompanyById } from '@/lib/db';
import { runAlertas } from '@/lib/alerts';
import { sendWhatsApp, normalizePhone } from '@/lib/whatsapp';
import { createAuditLog } from '@/lib/db';

// GET /api/alerts?companyId=xxx  — estado de alertas + config de teléfonos
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');

  try {
    // Últimas alertas enviadas
    const logs = companyId
      ? await queryAll(
          `SELECT * FROM alert_logs WHERE "companyId"=$1 ORDER BY "createdAt" DESC LIMIT 50`,
          [companyId]
        )
      : await queryAll(`SELECT * FROM alert_logs ORDER BY "createdAt" DESC LIMIT 100`);

    // Usuarios con teléfono configurado
    const usersWithPhone = await queryAll(
      `SELECT id, name, email, role, phone FROM users WHERE phone IS NOT NULL AND phone != '' AND status='activo'`
    );

    // Resumen de alertas pendientes
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

    return ok({ logs, usersWithPhone, pendientes, twilioConfigured: !!process.env.TWILIO_ACCOUNT_SID });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}

// POST /api/alerts — acciones
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const { action, companyId, userId, phone } = body;

    // ── Guardar teléfono de usuario ──────────────────────
    if (action === 'save-phone') {
      if (!userId || !phone) return err('userId y phone requeridos');
      const normalized = normalizePhone(phone);
      await execute(`UPDATE users SET phone=$1,"updatedAt"=NOW() WHERE id=$2`, [normalized, userId]);
      return ok({ saved: true, phone: normalized });
    }

    // ── Test: enviar mensaje de prueba ───────────────────
    if (action === 'test') {
      if (!phone) return err('phone requerido');
      const r = await sendWhatsApp({
        to: phone,
        body: `✅ *Sherman Finance*\n\nPrueba de conexión exitosa.\nTus alertas de WhatsApp están configuradas correctamente.\n\n_${new Date().toLocaleString('es-PE')}_`,
      });
      return ok(r);
    }

    // ── Ejecutar alertas manualmente ─────────────────────
    if (action === 'run') {
      if (!companyId) return err('companyId requerido');
      const company = await findCompanyById(companyId);
      if (!company) return err('Empresa no encontrada');

      const result = await runAlertas(companyId, company.nombre as string || company.ruc as string);

      await createAuditLog({
        userId: user.sub, userEmail: user.email, userRole: user.role,
        action: 'ALERTAS_WHATSAPP_MANUAL',
        object: `${companyId} — ${result.total} mensajes enviados`,
        ip: getIP(req),
      });

      return ok({ ...result, message: `${result.total} alertas enviadas` });
    }

    return err('action inválido. Usa: save-phone | test | run');
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
