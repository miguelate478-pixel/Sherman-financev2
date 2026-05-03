import { NextRequest } from 'next/server';
import { getReportData } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ok, err, unauthorized } from '@/lib/response';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();
  const p = new URL(req.url).searchParams;
  const companyId = p.get('companyId');
  const period    = p.get('period') || '2026-04';
  if (!companyId) return err('companyId requerido');

  const { docs, lines } = await getReportData(companyId, period);
  const compras = docs.filter((d:Record<string,unknown>) => d.operation==='COMPRA');
  const ventas  = docs.filter((d:Record<string,unknown>) => d.operation==='VENTA');

  const totalCompras = compras.reduce((s:number,d:Record<string,unknown>)=>s+Math.abs(d.total as number),0);
  const totalVentas  = ventas.reduce((s:number,d:Record<string,unknown>)=>s+(d.total as number),0);
  const igvCredito   = compras.filter((d:Record<string,unknown>)=>d.sunatStatus==='ACEPTADO'&&d.currency==='PEN').reduce((s:number,d:Record<string,unknown>)=>s+Math.abs(d.igv as number),0);
  const igvDebito    = ventas.filter((d:Record<string,unknown>)=>d.sunatStatus==='ACEPTADO').reduce((s:number,d:Record<string,unknown>)=>s+(d.igv as number),0);

  const bySupplier: Record<string,number> = {};
  compras.forEach((d:Record<string,unknown>)=>{bySupplier[d.issuerName as string]=(bySupplier[d.issuerName as string]||0)+Math.abs(d.total as number);});
  const topSuppliers = Object.entries(bySupplier).sort(([,a],[,b])=>b-a).slice(0,8).map(([name,amount])=>({name:name.slice(0,25),amount:Math.round(amount)}));

  const byAccount: Record<string,number> = {};
  lines.forEach((l:Record<string,unknown>)=>{if(l.pcgeAccount)byAccount[l.pcgeAccount as string]=(byAccount[l.pcgeAccount as string]||0)+Math.abs(l.lineTotal as number);});
  const topAccounts = Object.entries(byAccount).sort(([,a],[,b])=>b-a).slice(0,6).map(([account,amount])=>({account,amount:Math.round(amount)}));

  const sunatStatus: Record<string,number> = {};
  [...compras,...ventas].forEach((d:Record<string,unknown>)=>{sunatStatus[d.sunatStatus as string]=(sunatStatus[d.sunatStatus as string]||0)+1;});

  const months = [
    {mes:'Ene',compras:74000,ventas:102000,igv:4680},
    {mes:'Feb',compras:68000,ventas:89000,igv:3480},
    {mes:'Mar',compras:95000,ventas:115000,igv:5400},
    {mes:'Abr',compras:Math.round(totalCompras),ventas:Math.round(totalVentas),igv:Math.round(igvCredito)},
  ];

  return ok({
    totalCompras, totalVentas, igvCredito, igvDebito, igvNeto:igvDebito-igvCredito,
    docsCompras:compras.length, docsVentas:ventas.length,
    docsAceptados:docs.filter((d:Record<string,unknown>)=>d.sunatStatus==='ACEPTADO').length,
    docsObservados:docs.filter((d:Record<string,unknown>)=>d.sunatStatus==='OBSERVADO').length,
    docsParaConcar:docs.filter((d:Record<string,unknown>)=>d.concarStatus==='LISTO').length,
    linesTotal:lines.length, linesWithAI:lines.filter((l:Record<string,unknown>)=>l.pcgeAccount).length,
    avgConfidence:lines.length?Math.round(lines.reduce((s:number,l:Record<string,unknown>)=>s+(l.iaConfidence as number),0)/lines.length):0,
    topSuppliers, topAccounts, sunatStatus, months,
  });
}
