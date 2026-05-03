// Compatibility shim — all routes now use @/lib/db directly
// This file kept to avoid import errors in any legacy code
export { getDb as prisma } from './db';
