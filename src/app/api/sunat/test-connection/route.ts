import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { ok, unauthorized } from '@/lib/response';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const tests = [
    { name: 'api-sire.sunat.gob.pe', url: 'https://api-sire.sunat.gob.pe' },
    { name: 'api-seguridad.sunat.gob.pe', url: 'https://api-seguridad.sunat.gob.pe' },
    { name: 'api.sunat.gob.pe', url: 'https://api.sunat.gob.pe' },
  ];

  const results: Record<string, unknown>[] = [];

  for (const test of tests) {
    try {
      const start = Date.now();
      const r = await fetch(test.url, { signal: AbortSignal.timeout(5000) });
      results.push({ name: test.name, status: r.status, ms: Date.now() - start, ok: true });
    } catch (e) {
      results.push({ name: test.name, error: (e as Error).message, ok: false });
    }
  }

  return ok({ server: 'Railway', results });
}
