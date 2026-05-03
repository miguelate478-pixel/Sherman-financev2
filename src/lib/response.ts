import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export const ok = <T>(data: T, status = 200) => NextResponse.json({ ok: true, data }, { status });
export const err = (message: string, status = 400) => NextResponse.json({ ok: false, error: message }, { status });
export const unauthorized = () => NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
export const forbidden = () => NextResponse.json({ ok: false, error: 'Sin permisos' }, { status: 403 });
export const getIP = (req: NextRequest) => req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
