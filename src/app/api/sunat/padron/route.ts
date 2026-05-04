import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized } from '@/lib/response';

const cache = new Map<string, { data: Record<string,unknown>; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24;

function validarRuc(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) return false;
  const d = ruc.split('').map(Number);
  const f = [5,4,3,2,7,6,5,4,3,2];
  const sum = f.reduce((s,v,i) => s + v * d[i], 0);
  const rem = sum % 11;
  return (rem < 2 ? rem : 11 - rem) === d[10];
}

async function getSunatToken(): Promise<string | null> {
  const clientId     = process.env.SUNAT_CLIENT_ID;
  const clientSecret = process.env.SUNAT_CLIENT_SECRET;
  if (!clientId || !clientSecret || process.env.SUNAT_PROVIDER !== 'direct') return null;

  try {
    const res = await fetch(`https://api-seguridad.sunat.gob.pe/v1/clientesextranet/${clientId}/oauth2/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        scope:         'https://api.sunat.gob.pe/v1/contribuyente/controlcpe',
        client_id:     clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const j = await res.json() as { access_token: string };
    return j.access_token || null;
  } catch { return null; }
}

async function consultarSunatOficial(ruc: string, token: string): Promise<Record<string,unknown> | null> {
  try {
    const res = await fetch(`https://api.sunat.gob.pe/v1/contribuyente/controlcpe/${ruc}/validacion`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const data = await res.json() as Record<string,unknown>;
    const nombre = (data.ddp_nombre || data.razonSocial || '') as string;
    if (!nombre) return null;

    return {
      razonSocial: nombre.trim(),
      estado:    (data.desc_estado_contribuyente || 'ACTIVO') as string,
      condicion: (data.ddp_condicion_domicilio || 'HABIDO') as string,
      tipo:      (data.desc_tipo_contribuyente || '') as string,
      source:    'sunat-oficial',
    };
  } catch { return null; }
}

async function consultarApiPublica(ruc: string): Promise<Record<string,unknown> | null> {
  const endpoints = [
    { url: `https://api.apis.net.pe/v2/sunat/ruc?numero=${ruc}`, field: 'razonSocial' },
    { url: `https://api.apis.net.pe/v1/ruc?numero=${ruc}`,       field: 'razonSocial' },
    { url: `https://apiperu.dev/api/ruc/${ruc}`,                  field: 'razon_social' },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) continue;
      const data = await res.json() as Record<string,unknown>;
      const nombre = (data[ep.field] || data.razonSocial || data.nombre || '') as string;
      if (!nombre) continue;

      return {
        razonSocial: nombre.trim(),
        estado:    (data.estado || 'ACTIVO') as string,
        condicion: (data.condicionDomicilio || data.condicion || 'HABIDO') as string,
        tipo:      (data.tipoContribuyente || '') as string,
        source:    'api-publica',
      };
    } catch { continue; }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const ruc = new URL(req.url).searchParams.get('ruc')?.trim() || '';
  if (!/^\d{11}$/.test(ruc)) return err('RUC debe tener 11 dígitos');
  if (!validarRuc(ruc)) return err('RUC inválido — dígito verificador incorrecto');

  const cached = cache.get(ruc);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return ok({ ...cached.data, source: 'cache' });
  }

  const token = await getSunatToken();
  if (token) {
    const data = await consultarSunatOficial(ruc, token);
    if (data) {
      cache.set(ruc, { data, ts: Date.now() });
      return ok({ ruc, ...data });
    }
  }

  const pubData = await consultarApiPublica(ruc);
  if (pubData) {
    cache.set(ruc, { data: pubData, ts: Date.now() });
    return ok({ ruc, ...pubData });
  }

  return ok({
    ruc,
    razonSocial: null,
    estado: null,
    condicion: null,
    tipo: null,
    source: 'none',
    message: 'RUC válido ✓ — escribe la razón social manualmente.',
  });
}