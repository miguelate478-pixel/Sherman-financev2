// ═══════════════════════════════════════════════════
// DB ADAPTER — SQLite (dev) or PostgreSQL (prod)
// Auto-detects from DATABASE_URL
// ═══════════════════════════════════════════════════
import { createClient, Client as LibsqlClient } from '@libsql/client';

let _client: LibsqlClient | null = null;

export function getDb(): LibsqlClient {
  if (!_client) {
    const url = process.env.DATABASE_URL ?? 'file:prisma/dev.db';
    _client = createClient({ url });
  }
  return _client;
}
