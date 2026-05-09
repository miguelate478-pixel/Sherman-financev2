import { NextRequest } from 'next/server';
import { execute } from '@/lib/db';

// GET /api/alerts/migrate — crea tablas y columnas necesarias para alertas
// Llamar UNA VEZ después del deploy
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-migrate-secret') || new URL(req.url).searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const steps: string[] = [];

  // 1. Columna phone en users
  try {
    await execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`);
    steps.push('✅ users.phone agregado');
  } catch (e) {
    steps.push(`⚠ users.phone: ${(e as Error).message}`);
  }

  // 2. Tabla alert_logs
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS alert_logs (
        id          SERIAL PRIMARY KEY,
        "companyId" VARCHAR(100) NOT NULL,
        tipo        VARCHAR(50)  NOT NULL,
        ref         VARCHAR(200) NOT NULL,
        fecha       DATE         NOT NULL,
        "createdAt" TIMESTAMPTZ  DEFAULT NOW(),
        UNIQUE("companyId", tipo, ref, fecha)
      )
    `);
    steps.push('✅ alert_logs creada');
  } catch (e) {
    steps.push(`⚠ alert_logs: ${(e as Error).message}`);
  }

  // 3. Índice para búsquedas rápidas
  try {
    await execute(`CREATE INDEX IF NOT EXISTS idx_alert_logs_company ON alert_logs ("companyId", fecha DESC)`);
    steps.push('✅ índice alert_logs creado');
  } catch (e) {
    steps.push(`⚠ índice: ${(e as Error).message}`);
  }

  return Response.json({ ok: true, steps });
}
