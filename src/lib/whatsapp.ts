// ══════════════════════════════════════════════════════════
//  WhatsApp Provider — Twilio WhatsApp API
//  Docs: https://www.twilio.com/docs/whatsapp
//
//  Variables de entorno requeridas:
//    TWILIO_ACCOUNT_SID   — Account SID de Twilio
//    TWILIO_AUTH_TOKEN    — Auth Token de Twilio
//    TWILIO_WHATSAPP_FROM — Número Twilio ej: whatsapp:+14155238886
// ══════════════════════════════════════════════════════════

export interface WhatsAppMessage {
  to: string;       // Número destino ej: +51987654321
  body: string;     // Texto del mensaje
}

export interface SendResult {
  ok: boolean;
  sid?: string;
  error?: string;
}

// Normaliza número peruano → formato E.164
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Si ya tiene código de país
  if (digits.startsWith('51') && digits.length === 11) return `+${digits}`;
  // Si es número local de 9 dígitos
  if (digits.length === 9) return `+51${digits}`;
  // Si tiene + al inicio
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
}

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<SendResult> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_WHATSAPP_FROM;

  if (!sid || !token || !from) {
    console.warn('[WA] Twilio no configurado — mensaje no enviado:', msg.body.substring(0, 60));
    return { ok: false, error: 'Twilio no configurado' };
  }

  const to = `whatsapp:${normalizePhone(msg.to)}`;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const body = new URLSearchParams({ From: from, To: to, Body: msg.body });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json() as { sid?: string; message?: string; code?: number };

    if (!res.ok) {
      console.error(`[WA] Error Twilio ${res.status}:`, data.message);
      return { ok: false, error: data.message || `HTTP ${res.status}` };
    }

    console.log(`[WA] ✅ Enviado a ${to} — SID: ${data.sid}`);
    return { ok: true, sid: data.sid };

  } catch (e) {
    console.error('[WA] Error fetch:', (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}

// Envío en lote — no falla si uno falla
export async function sendWhatsAppBulk(messages: WhatsAppMessage[]): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;
  for (const msg of messages) {
    const r = await sendWhatsApp(msg);
    if (r.ok) sent++; else failed++;
    // Pequeña pausa para no saturar la API
    await new Promise(r => setTimeout(r, 300));
  }
  return { sent, failed };
}
