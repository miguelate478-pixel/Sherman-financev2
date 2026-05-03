export interface LineClassification {
  pcgeAccount: string;
  accountName: string;
  costCenter: string;
  category: string;
  confidence: number;
  needsReview: boolean;
  isRecurrent: boolean;
  reasoning: string;
}

export interface IAiProvider {
  classifyLine(description: string, amount: number, docType: string): Promise<LineClassification>;
}

const PCGE_MAP: Record<string, { account: string; name: string; cc: string; cat: string }> = {
  'consultor': { account: '63-03', name: 'Servicios de terceros', cc: 'GE-TI', cat: 'Consultoría TI' },
  'asesor':    { account: '63-03', name: 'Servicios de terceros', cc: 'GE-ADM', cat: 'Asesoría' },
  'licencia':  { account: '63-03', name: 'Servicios de terceros', cc: 'GE-TI', cat: 'Licencias Software' },
  'software':  { account: '63-03', name: 'Servicios de terceros', cc: 'GE-TI', cat: 'Software' },
  'mantenimiento': { account: '63-04', name: 'Mantenimiento y reparaciones', cc: 'OPE-INFRA', cat: 'Mantenimiento' },
  'reparaci':  { account: '63-04', name: 'Mantenimiento y reparaciones', cc: 'OPE-INFRA', cat: 'Reparación' },
  'alquiler':  { account: '63-05', name: 'Arrendamientos', cc: 'GE-ADM', cat: 'Arrendamiento' },
  'arrendamiento': { account: '63-05', name: 'Arrendamientos', cc: 'GE-ADM', cat: 'Arrendamiento' },
  'oficina':   { account: '63-05', name: 'Arrendamientos', cc: 'GE-ADM', cat: 'Arrendamiento' },
  'mercader':  { account: '60-01', name: 'Mercaderías', cc: 'OPE-LOG', cat: 'Compra Mercaderías' },
  'material':  { account: '60-05', name: 'Materiales auxiliares', cc: 'OPE-INFRA', cat: 'Materiales' },
  'suministro': { account: '60-03', name: 'Suministros', cc: 'OPE-LOG', cat: 'Suministros' },
  'servidor':  { account: '33-00', name: 'Inmuebles, maq. y equipo', cc: 'TI-INFRA', cat: 'Activo fijo TI' },
  'equipo':    { account: '33-00', name: 'Inmuebles, maq. y equipo', cc: 'TI-INFRA', cat: 'Activo fijo' },
  'publicidad': { account: '63-01', name: 'Publicidad', cc: 'MKT', cat: 'Marketing' },
  'transporte': { account: '63-06', name: 'Transporte', cc: 'OPE-LOG', cat: 'Transporte' },
  'seguro':    { account: '63-08', name: 'Seguros', cc: 'GE-ADM', cat: 'Seguros' },
  'energia':   { account: '63-04', name: 'Suministro de energía', cc: 'OPE-INFRA', cat: 'Servicios básicos' },
  'electricidad': { account: '63-04', name: 'Suministro de energía', cc: 'OPE-INFRA', cat: 'Servicios básicos' },
  'internet':  { account: '63-04', name: 'Telecomunicaciones', cc: 'GE-TI', cat: 'Telecomunicaciones' },
  'telefon':   { account: '63-04', name: 'Telecomunicaciones', cc: 'GE-ADM', cat: 'Telecomunicaciones' },
  'capacitaci': { account: '63-03', name: 'Servicios de terceros', cc: 'GE-RH', cat: 'Capacitación' },
  'audit':     { account: '63-03', name: 'Servicios de terceros', cc: 'GE-ADM', cat: 'Auditoría' },
  'contab':    { account: '63-03', name: 'Servicios de terceros', cc: 'GE-ADM', cat: 'Contabilidad' },
  'legal':     { account: '63-03', name: 'Servicios de terceros', cc: 'GE-ADM', cat: 'Legal' },
  'niif':      { account: '63-03', name: 'Servicios de terceros', cc: 'GE-ADM', cat: 'NIIF' },
};

export class MockAiProvider implements IAiProvider {
  async classifyLine(description: string, amount: number, _docType: string): Promise<LineClassification> {
    const lower = description.toLowerCase();
    let best = { account: '65-09', name: 'Otros gastos de gestión', cc: 'GE-ADM', cat: 'Otros' };
    let confidence = 55;

    for (const [kw, val] of Object.entries(PCGE_MAP)) {
      if (lower.includes(kw)) { best = val; confidence = 75 + Math.floor(Math.random() * 22); break; }
    }

    const isRecurrent = lower.includes('mensual') || lower.includes('mes') || lower.includes('período') || lower.includes('periodo');
    const needsReview = confidence < 70 || amount > 50000;

    return {
      pcgeAccount: best.account,
      accountName: best.name,
      costCenter: best.cc,
      category: best.cat,
      confidence,
      needsReview,
      isRecurrent,
      reasoning: `Clasificado por palabras clave "${lower.slice(0, 40)}..." → Cuenta ${best.account}`,
    };
  }
}

export class OpenAiProvider implements IAiProvider {
  async classifyLine(description: string, amount: number, docType: string): Promise<LineClassification> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.OPENAI_API_KEY ?? '', 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: `Clasifica contablemente según PCGE peruano:\nDescripción: "${description}"\nMonto: ${amount} PEN\nTipo doc: ${docType}\n\nResponde SOLO JSON: {"pcgeAccount":"63-03","accountName":"Servicios de terceros","costCenter":"GE-TI","category":"Consultoría TI","confidence":90,"needsReview":false,"isRecurrent":false,"reasoning":"..."}` }],
      }),
    });
    const j = await res.json();
    const text = j.content?.[0]?.text ?? '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return parsed;
  }
}

export function getAiProvider(): IAiProvider {
  return process.env.AI_PROVIDER === 'openai' ? new OpenAiProvider() : new MockAiProvider();
}
