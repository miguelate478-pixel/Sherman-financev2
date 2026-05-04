import { NextRequest } from 'next/server';
import { getDocuments, getBankMovements, getDetracciones, getAuditLogs } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized } from '@/lib/response';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  try {
    const { message, companyId, period, history } = await req.json();
    if (!message?.trim()) return err('Mensaje requerido');

    // Load real context from DB
    const [docs, movs, detrs] = await Promise.all([
      companyId ? getDocuments({ companyId, period: period || '2026-04' }) : Promise.resolve([]),
      companyId ? getBankMovements(companyId) : Promise.resolve([]),
      companyId ? getDetracciones(companyId) : Promise.resolve([]),
    ]);

    const compras = docs.filter((d: Record<string,unknown>) => d.operation === 'COMPRA');
    const ventas  = docs.filter((d: Record<string,unknown>) => d.operation === 'VENTA');

    const context = `Eres el Copiloto Contable IA de Sherman Finance, un asistente especializado en contabilidad peruana.

DATOS REALES DE LA EMPRESA (período ${period || '2026-04'}):
- Comprobantes compras: ${compras.length} (Total: S/ ${compras.reduce((s: number, d: Record<string,unknown>) => s + Math.abs(d.total as number), 0).toFixed(2)})
- Comprobantes ventas: ${ventas.length} (Total: S/ ${ventas.reduce((s: number, d: Record<string,unknown>) => s + (d.total as number), 0).toFixed(2)})
- IGV crédito fiscal: S/ ${compras.filter((d: Record<string,unknown>) => d.sunatStatus === 'ACEPTADO' && d.currency === 'PEN').reduce((s: number, d: Record<string,unknown>) => s + Math.abs(d.igv as number), 0).toFixed(2)}
- Documentos ACEPTADOS SUNAT: ${docs.filter((d: Record<string,unknown>) => d.sunatStatus === 'ACEPTADO').length}
- Documentos OBSERVADOS: ${docs.filter((d: Record<string,unknown>) => d.sunatStatus === 'OBSERVADO').length}
- Para CONCAR (LISTO): ${docs.filter((d: Record<string,unknown>) => d.concarStatus === 'LISTO').length}
- Parseados XML: ${docs.filter((d: Record<string,unknown>) => d.parserStatus === 'PARSEADO').length}
- Clasificados IA: ${docs.filter((d: Record<string,unknown>) => d.aiStatus === 'CLASIFICADO').length}
- Movimientos bancarios: ${movs.length} (Saldo: S/ ${movs.length ? (movs[movs.length - 1] as Record<string,unknown>).balance : 0})
- Sin conciliar: ${movs.filter((m: Record<string,unknown>) => !m.reconciled).length}
- Detracciones pendientes: ${detrs.filter((d: Record<string,unknown>) => d.status === 'PENDIENTE').length}
- Detracciones depositadas: ${detrs.filter((d: Record<string,unknown>) => d.status === 'DEPOSITADO').length}

Top proveedores:
${compras.slice(0, 5).map((d: Record<string,unknown>) => `  - ${d.issuerName} (${d.issuerRuc}): S/ ${Math.abs(d.total as number).toFixed(2)}`).join('\n')}

Responde de forma concisa y precisa. Usa formato markdown simple (negrita con **). 
Eres experto en: SUNAT, SIRE, IGV, retenciones, detracciones, percepciones, CONCAR, PCGE, NIC/NIIF, PLE.
Si no sabes algo específico de la empresa, di que necesitas más datos.
Responde siempre en español.`;

    // Try real AI first, fall back to rule-based
    if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
      try {
        const messages = [
          ...(history || []).slice(-6).map((h: {role: string; content: string}) => ({ role: h.role, content: h.content })),
          { role: 'user', content: message }
        ];

        const isAnthropic = !!process.env.ANTHROPIC_API_KEY;
        
        if (isAnthropic) {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, system: context, messages }),
          });
          const data = await res.json();
          return ok({ reply: data.content?.[0]?.text || 'Sin respuesta', source: 'anthropic' });
        } else {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 800, messages: [{ role: 'system', content: context }, ...messages] }),
          });
          const data = await res.json();
          return ok({ reply: data.choices?.[0]?.message?.content || 'Sin respuesta', source: 'openai' });
        }
      } catch (e) {
        console.error('[COPILOTO AI]', e);
      }
    }

    // Rule-based fallback (always available)
    const l = message.toLowerCase();
    let reply = '';

    if (l.includes('comprobante') || l.includes('factura') || l.includes('documento')) {
      reply = `**Comprobantes en BD (${period}):**\n• Total: ${docs.length} documentos\n• Compras: ${compras.length} · Ventas: ${ventas.length}\n• Parseados XML: ${docs.filter((d: Record<string,unknown>) => d.parserStatus === 'PARSEADO').length}\n• Clasificados IA: ${docs.filter((d: Record<string,unknown>) => d.aiStatus === 'CLASIFICADO').length}\n• Observados SUNAT: ${docs.filter((d: Record<string,unknown>) => d.sunatStatus === 'OBSERVADO').length}\n• Para CONCAR: ${docs.filter((d: Record<string,unknown>) => d.concarStatus === 'LISTO').length}`;
    } else if (l.includes('banco') || l.includes('saldo') || l.includes('conciliaci')) {
      const totalCred = movs.filter((m: Record<string,unknown>) => m.type === 'CRÉDITO').reduce((s: number, m: Record<string,unknown>) => s + (m.amount as number), 0);
      const totalDeb  = movs.filter((m: Record<string,unknown>) => m.type === 'DÉBITO').reduce((s: number, m: Record<string,unknown>) => s + (m.amount as number), 0);
      reply = `**Estado bancario:**\n• Movimientos: ${movs.length}\n• Saldo actual: S/ ${movs.length ? (movs[movs.length - 1] as Record<string,unknown>).balance : 0}\n• Entradas: S/ ${totalCred.toFixed(2)}\n• Salidas: S/ ${totalDeb.toFixed(2)}\n• Sin conciliar: ${movs.filter((m: Record<string,unknown>) => !m.reconciled).length} movimientos`;
    } else if (l.includes('detraccion') || l.includes('detracción')) {
      const pendM = detrs.filter((d: Record<string,unknown>) => d.status === 'PENDIENTE').reduce((s: number, d: Record<string,unknown>) => s + (d.amount as number), 0);
      reply = `**Detracciones:**\n• Total: ${detrs.length}\n• Pendientes: ${detrs.filter((d: Record<string,unknown>) => d.status === 'PENDIENTE').length} (S/ ${pendM.toFixed(2)})\n• Depositadas: ${detrs.filter((d: Record<string,unknown>) => d.status === 'DEPOSITADO').length}\n\n⚠ Plazo: hasta el día 12 del mes siguiente a la emisión.`;
    } else if (l.includes('igv') || l.includes('crédito fiscal') || l.includes('credito fiscal')) {
      const igvCred = compras.filter((d: Record<string,unknown>) => d.sunatStatus === 'ACEPTADO' && d.currency === 'PEN').reduce((s: number, d: Record<string,unknown>) => s + Math.abs(d.igv as number), 0);
      const igvDeb  = ventas.filter((d: Record<string,unknown>) => d.sunatStatus === 'ACEPTADO').reduce((s: number, d: Record<string,unknown>) => s + (d.igv as number), 0);
      reply = `**IGV ${period}:**\n• Crédito fiscal (compras): S/ ${igvCred.toFixed(2)}\n• IGV débito (ventas): S/ ${igvDeb.toFixed(2)}\n• **IGV neto a pagar: S/ ${(igvDeb - igvCred).toFixed(2)}**\n• Docs excluidos (observados/anulados): ${docs.filter((d: Record<string,unknown>) => d.sunatStatus === 'OBSERVADO' || d.sunatStatus === 'ANULADO').length}`;
    } else if (l.includes('concar')) {
      reply = `**Estado CONCAR:**\n• LISTO para exportar: ${docs.filter((d: Record<string,unknown>) => d.concarStatus === 'LISTO').length}\n• PREPARADO (pendiente aprobación Supervisor): ${docs.filter((d: Record<string,unknown>) => d.concarStatus === 'PREPARADO').length}\n• EXPORTADO a CONCAR: ${docs.filter((d: Record<string,unknown>) => d.concarStatus === 'EXPORTADO').length}\n• BLOQUEADO (observados): ${docs.filter((d: Record<string,unknown>) => d.concarStatus === 'BLOQUEADO').length}`;
    } else if (l.includes('proveedor') || l.includes('top')) {
      const provMap: Record<string, number> = {};
      compras.forEach((d: Record<string,unknown>) => { const k = d.issuerName as string; provMap[k] = (provMap[k] || 0) + Math.abs(d.total as number); });
      const top = Object.entries(provMap).sort(([,a],[,b]) => b - a).slice(0, 5);
      reply = `**Top proveedores por monto:**\n${top.map(([n,v]) => `• ${n}: S/ ${v.toFixed(2)}`).join('\n')}`;
    } else if (l.includes('resumen') || l.includes('dashboard') || l.includes('situación')) {
      const igvCred = compras.filter((d: Record<string,unknown>) => d.sunatStatus === 'ACEPTADO' && d.currency === 'PEN').reduce((s: number, d: Record<string,unknown>) => s + Math.abs(d.igv as number), 0);
      reply = `**Resumen ejecutivo ${period}:**\n• Compras totales: S/ ${compras.reduce((s: number, d: Record<string,unknown>) => s + Math.abs(d.total as number), 0).toFixed(2)}\n• Ventas totales: S/ ${ventas.reduce((s: number, d: Record<string,unknown>) => s + (d.total as number), 0).toFixed(2)}\n• IGV crédito fiscal: S/ ${igvCred.toFixed(2)}\n• Saldo banco: S/ ${movs.length ? (movs[movs.length - 1] as Record<string,unknown>).balance : 0}\n• Detracciones pendientes: ${detrs.filter((d: Record<string,unknown>) => d.status === 'PENDIENTE').length}\n• Docs para CONCAR: ${docs.filter((d: Record<string,unknown>) => d.concarStatus === 'LISTO').length}`;
    } else {
      reply = `Entendido: "${message}"\n\nPuedo ayudarte con:\n• **Comprobantes** — estado SUNAT, parser XML, clasificación IA\n• **Bancos** — saldo, movimientos, conciliación\n• **Detracciones** — pendientes, montos, fechas\n• **IGV** — crédito fiscal, débito, neto a pagar\n• **CONCAR** — documentos listos para exportar\n• **Proveedores** — top por monto\n• **Resumen ejecutivo** — KPIs del período\n\nTambién puedes activar **IA real** configurando ANTHROPIC_API_KEY o OPENAI_API_KEY en las variables de entorno del servidor.`;
    }

    return ok({ reply, source: 'rules' });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
