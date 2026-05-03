import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const k = process.env.ENCRYPTION_KEY ?? 'sherman-encrypt-key-exactly-32b!';
  return Buffer.from(k.slice(0, 32).padEnd(32, '0'));
}

export function encrypt(text: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return { encrypted: encrypted.toString('hex'), iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex') };
}

export function decrypt(encHex: string, ivHex: string, authTagHex: string): string {
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
}
