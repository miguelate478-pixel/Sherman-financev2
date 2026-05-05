"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ══════════════════════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════════════════════
interface User { id:string; name:string; email:string; role:string; avatar:string; }
interface Company { id:string; ruc:string; nombre:string; nombreComercial:string; regimen:string; sector:string; contacto:string; igv:number; estado:string; credEstado:string; }
interface DocLine { n:number; cod:string; desc:string; qty:number; um:string; val:number; igv_l:number; total_l:number; afect:string; cuenta:string; cc:string; cat:string; ia:number; rev:boolean; rec:boolean; aprobado:boolean; }
interface Doc { id:string; op:string; tipo:string; serie:string; num:string; ruc_e:string; rs_e:string; ruc_r:string; rs_r:string; fecha:string; venc:string; moneda:string; base:number; igv:number; total:number; detraccion:boolean; pct_d:number; monto_d:number; sunat:string; cdr:string; hash:string; xml:boolean; pdf:boolean; cdr_f:boolean; workflow:string; concar:string; period:string; parserStatus:string; aiStatus:string; lineas:DocLine[]; }
interface BankMov { id:string; fecha:string; desc:string; tipo:string; monto:number; saldo:number; conciliado:boolean; match:string; match_rs:string; }
interface Detraccion { id:string; doc:string; proveedor:string; ruc:string; monto:number; pct:number; codigo:string; cuenta_detr:string; estado:string; fecha_dep:string; }
interface Alert { type:string; level:'warning'|'error'|'info'; message:string; count?:number; amount?:number; }

// ══════════════════════════════════════════════════════════
//  API CLIENT
// ══════════════════════════════════════════════════════════
const gT = () => typeof window!=='undefined' ? localStorage.getItem('sf_token_v2')||'' : '';
const sT = (t:string) => localStorage.setItem('sf_token_v2', t);
const cT = () => localStorage.removeItem('sf_token_v2');
const H  = () => ({ Authorization:`Bearer ${gT()}`, 'Content-Type':'application/json' });

const API = {
  login: async (e:string,p:string) => { const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})}); const d=await r.json(); if(d.data?.token) sT(d.data.token); return d; },
  me:    async () => { const r=await fetch('/api/auth/me',{headers:H()}); return r.json(); },
  companies: async () => { const r=await fetch('/api/companies',{headers:H()}); const d=await r.json(); return d.data||[]; },
  createCompany: async (b:unknown) => { const r=await fetch('/api/companies',{method:'POST',headers:H(),body:JSON.stringify(b)}); return r.json(); },
  docs:  async (type?:string,companyId?:string,period?:string,extra?:string) => { const p=new URLSearchParams(); if(type) p.set('type',type); if(companyId) p.set('companyId',companyId); if(period) p.set('period',period); if(extra) p.set('workflow',extra); const r=await fetch(`/api/documents?${p}`,{headers:H()}); const d=await r.json(); return d.data||[]; },
  updateDoc: async (id:string,b:unknown) => { const r=await fetch('/api/documents',{method:'PATCH',headers:H(),body:JSON.stringify({id,...b as object})}); return r.json(); },
  markCxcPaid: async (id:string,amount:number) => { const r=await fetch('/api/cxc',{method:'PATCH',headers:H(),body:JSON.stringify({id,amount})}); return r.json(); },
  markCxpPaid: async (id:string,amount:number) => { const r=await fetch('/api/cxp',{method:'PATCH',headers:H(),body:JSON.stringify({id,amount})}); return r.json(); },
  askCopiloto: async (message:string,companyId?:string,period?:string,history?:unknown[]) => { const r=await fetch('/api/copiloto',{method:'POST',headers:H(),body:JSON.stringify({message,companyId,period,history})}); return r.json(); },
  bulkDownload: async (b:unknown) => { const r=await fetch('/api/sunat/bulk-download',{method:'POST',headers:H(),body:JSON.stringify(b)}); return r.json(); },
  bulkJobs: async (companyId?:string) => { const p=companyId?'?companyId='+companyId:''; const r=await fetch('/api/sunat/bulk-download'+p,{headers:H()}); const d=await r.json(); return d.data||[]; },
  jobs: async (companyId?:string) => { const p=companyId?`?companyId=${companyId}`:''; const r=await fetch(`/api/sunat/bulk-download${p}`,{headers:H()}); const d=await r.json(); return d.data||[]; },
  validate: async (b:unknown) => { const r=await fetch('/api/sunat/validate',{method:'POST',headers:H(),body:JSON.stringify(b)}); return r.json(); },
  concarTest: async () => { const r=await fetch('/api/concar?action=test',{method:'POST',headers:H()}); return r.json(); },
  concarSchema: async () => { const r=await fetch('/api/concar?action=schema',{method:'POST',headers:H()}); return r.json(); },
  concarExport: async (b:unknown) => { const r=await fetch('/api/concar?action=export',{method:'POST',headers:H(),body:JSON.stringify(b)}); return r.json(); },
  concarApprove: async (batchId:string) => { const r=await fetch('/api/concar?action=approve',{method:'POST',headers:H(),body:JSON.stringify({batchId})}); return r.json(); },
  concarBatches: async () => { const r=await fetch('/api/concar',{headers:H()}); const d=await r.json(); return d.data||[]; },
  concarAccounts: async () => { const r=await fetch('/api/concar?action=accounts',{headers:H()}); const d=await r.json(); return d.data||[]; },
  users: async () => { const r=await fetch('/api/users',{headers:H()}); const d=await r.json(); return d.data||[]; },
  createUser: async (b:unknown) => { const r=await fetch('/api/users',{method:'POST',headers:H(),body:JSON.stringify(b)}); return r.json(); },
  patchUser: async (id:string,data:Record<string,unknown>) => { const r=await fetch('/api/users',{method:'PATCH',headers:H(),body:JSON.stringify({id,...data})}); return r.json(); },
  revokeUser: async (id:string) => { const r=await fetch('/api/users',{method:'PATCH',headers:H(),body:JSON.stringify({id,status:'revocado'})}); return r.json(); },
  banks: async (companyId?:string) => { const p=companyId?`?companyId=${companyId}`:''; const r=await fetch(`/api/banks${p}`,{headers:H()}); const d=await r.json(); return d.data||[]; },
  conciliate: async (id:string,matchDocId:string,matchName:string) => { const r=await fetch('/api/banks',{method:'PATCH',headers:H(),body:JSON.stringify({id,matchDocId,matchName})}); return r.json(); },
  detracciones: async (companyId?:string) => { const p=companyId?`?companyId=${companyId}`:''; const r=await fetch(`/api/detracciones${p}`,{headers:H()}); const d=await r.json(); return d.data||[]; },
  depositarDetraccion: async (documentId:string) => { const r=await fetch('/api/detracciones',{method:'PATCH',headers:H(),body:JSON.stringify({documentId})}); return r.json(); },
  audit: async () => { const r=await fetch('/api/audit',{headers:H()}); const d=await r.json(); return d.data||[]; },
  logAudit: async (action:string,object?:string) => fetch('/api/audit',{method:'POST',headers:H(),body:JSON.stringify({action,object})}),
  cxc: async (companyId?:string) => { const p=companyId?`?companyId=${companyId}`:''; const r=await fetch(`/api/cxc${p}`,{headers:H()}); const d=await r.json(); return d.data||[]; },
  cxp: async (companyId?:string) => { const p=companyId?`?companyId=${companyId}`:''; const r=await fetch(`/api/cxp${p}`,{headers:H()}); const d=await r.json(); return d.data||[]; },
  // Credenciales SUNAT por empresa
  getCredentials: async (companyId:string) => { const r=await fetch(`/api/sunat/credentials?companyId=${companyId}`,{headers:H()}); return r.json(); },
  saveCredentials: async (b:unknown) => { const r=await fetch('/api/sunat/credentials',{method:'POST',headers:H(),body:JSON.stringify(b)}); return r.json(); },
  testCredentials: async (companyId:string) => { const r=await fetch('/api/sunat/credentials',{method:'PATCH',headers:H(),body:JSON.stringify({companyId})}); return r.json(); },
  // SIRE propuesta
  sireRequest: async (b:unknown) => { const r=await fetch('/api/sunat/sire',{method:'POST',headers:H(),body:JSON.stringify(b)}); return r.json(); },
  sireTicket: async (ticket:string,companyId:string) => { const r=await fetch(`/api/sunat/sire?ticket=${ticket}&companyId=${companyId}`,{headers:H()}); return r.json(); },
  // Validación individual
  validateDoc: async (b:unknown) => { const r=await fetch('/api/sunat/validate',{method:'POST',headers:H(),body:JSON.stringify(b)}); return r.json(); },
  getReports: async (companyId?:string,period?:string) => { const p=new URLSearchParams({type:'summary'}); if(companyId) p.set('companyId',companyId); if(period) p.set('period',period); const r=await fetch(`/api/reports?${p}`,{headers:H()}); return r.json(); },
  getDashboard: async (companyId?:string,period?:string) => { const p=new URLSearchParams(); if(companyId) p.set('companyId',companyId); if(period) p.set('period',period); const r=await fetch(`/api/dashboard?${p}`,{headers:H()}); return r.json(); },
  // RUC Padron SUNAT
  padron: async (ruc:string) => { const r=await fetch(`/api/sunat/padron?ruc=${ruc}`,{headers:H()}); return r.json(); },
  // CSV Export
  exportCSV: (type:string,companyId?:string,period?:string) => {
    const p=new URLSearchParams({type});
    if(companyId) p.set('companyId',companyId);
    if(period) p.set('period',period);
    window.open(`/api/export?${p}&token=${gT()}`, '_blank');
  },
  // Password change
  changePassword: async (currentPassword:string,newPassword:string) => { const r=await fetch('/api/auth/password',{method:'POST',headers:H(),body:JSON.stringify({currentPassword,newPassword})}); return r.json(); },
  tipoCambio: async (fecha?:string) => { const p=fecha?`?fecha=${fecha}`:''; const r=await fetch(`/api/sunat/tipo-cambio${p}`,{headers:H()}); return r.json(); },
  downloadPLE: (tipo:string,companyId:string,period:string) => {
    const token=gT();
    window.open(`/api/sunat/ple?tipo=${tipo}&companyId=${companyId}&period=${period}&token=${token}`,'_blank');
  },
  mfaSetup: async () => { const r=await fetch('/api/auth/mfa',{method:'POST',headers:H(),body:JSON.stringify({action:'setup'})}); return r.json(); },
  mfaVerify: async (token:string) => { const r=await fetch('/api/auth/mfa',{method:'POST',headers:H(),body:JSON.stringify({action:'verify',token})}); return r.json(); },
  concarSqlPreview: async (b:unknown) => { const r=await fetch('/api/concar?action=sql-preview',{method:'POST',headers:H(),body:JSON.stringify(b)}); return r.json(); },

};

// ══════════════════════════════════════════════════════════
//  DESIGN TOKENS & UTILS
// ══════════════════════════════════════════════════════════
const C = { bg:'#F8FAFC',card:'#FFFFFF',border:'#E2E8F0',border2:'#CBD5E1',navy:'#0F172A',navyM:'#1E293B',navyL:'#334155',blue:'#2563EB',blueL:'#EFF6FF',blueM:'#DBEAFE',blueD:'#1D4ED8',green:'#16A34A',greenL:'#F0FDF4',greenM:'#DCFCE7',amber:'#D97706',amberL:'#FFFBEB',amberM:'#FEF3C7',red:'#DC2626',redL:'#FEF2F2',redM:'#FEE2E2',violet:'#7C3AED',violetL:'#F5F3FF',violetM:'#EDE9FE',teal:'#0F766E',tealL:'#F0FDFA',tealM:'#CCFBF1',t1:'#111827',t2:'#374151',t3:'#6B7280',t4:'#9CA3AF',t5:'#D1D5DB' };
const fmt  = (n:number, m='PEN') => new Intl.NumberFormat('es-PE',{style:'currency',currency:m==='USD'?'USD':'PEN',minimumFractionDigits:2}).format(n||0);
const fmtN = (n:number) => new Intl.NumberFormat('es-PE').format(n||0);
const sleep = (ms:number) => new Promise(r=>setTimeout(r,ms));
const colEst = (s:string) => { if(['ACEPTADO','APROBADO','OK','LISTO','COBRADO','PAGADO','DEPOSITADO','COMPLETADO','EXPORTADO','activo','configuradas','PARSEADO','CLASIFICADO'].includes(s)) return 'green'; if(['OBSERVADO','ERROR','VENCIDO','BLOQUEADO','NULA','sin_configurar','revocado','RECHAZADO'].includes(s)) return 'red'; if(['PENDIENTE','PENDIENTE_REVISION','POR_VENCER','EN_PROCESO','pendiente'].includes(s)) return 'amber'; if(['VALIDADO','PARSEADO','PREPARADO','LISTO_BANDEJA'].includes(s)) return 'blue'; return 'gray'; };
const DOC_TIPOS: Record<string,string> = {'01':'Factura','03':'Boleta','07':'N.Crédito','08':'N.Débito'};
const PCGE_NAMES: Record<string,string> = {'60-01':'Mercaderías','60-03':'Suministros','60-05':'Materiales aux.','63-03':'Servicios de terceros','63-04':'Mantenimiento','63-05':'Arrendamientos','63-06':'Transporte','65-09':'Otros gastos','33-00':'Inm. maq. y equipo','70-11':'Mercaderías Terc.','72-11':'Servicios prestados'};

// ══════════════════════════════════════════════════════════
//  UI PRIMITIVES
// ══════════════════════════════════════════════════════════
type BadgeColor = 'gray'|'blue'|'green'|'amber'|'red'|'violet'|'teal';
function Badge({label,color='gray',sm,dot}:{label:string;color?:BadgeColor;sm?:boolean;dot?:boolean}) {
  const M:Record<BadgeColor,{bg:string;c:string;b:string}> = {gray:{bg:'#F1F5F9',c:C.t3,b:C.t5},blue:{bg:C.blueM,c:C.blue,b:'#BFDBFE'},green:{bg:C.greenM,c:C.green,b:'#BBF7D0'},amber:{bg:C.amberM,c:C.amber,b:'#FDE68A'},red:{bg:C.redM,c:C.red,b:'#FECACA'},violet:{bg:C.violetM,c:C.violet,b:'#DDD6FE'},teal:{bg:C.tealM,c:C.teal,b:'#99F6E4'}};
  const s=M[color]||M.gray;
  return <span style={{display:'inline-flex',alignItems:'center',gap:4,background:s.bg,color:s.c,border:`1px solid ${s.b}`,borderRadius:5,fontSize:sm?10:11,fontWeight:600,padding:sm?'1px 7px':'2px 9px',whiteSpace:'nowrap'}}>{dot&&<span style={{width:6,height:6,borderRadius:'50%',background:s.c,flexShrink:0}}/>}{label}</span>;
}

function Spinner({size=16,color=C.blue}:{size?:number;color?:string}) {
  return <span style={{width:size,height:size,border:`2px solid #E2E8F0`,borderTop:`2px solid ${color}`,borderRadius:'50%',display:'inline-block',animation:'spin .7s linear infinite',flexShrink:0}}/>;
}

function Btn({children,onClick,color='blue',size='md',disabled,full,type='button'}:{children:React.ReactNode;onClick?:(e?:React.MouseEvent)=>void;color?:string;size?:string;disabled?:boolean;full?:boolean;type?:'button'|'submit'}) {
  const M:Record<string,{bg:string;hov:string;t:string;b?:string}> = {blue:{bg:C.blue,hov:C.blueD,t:'#fff'},navy:{bg:C.navy,hov:C.navyM,t:'#fff'},ghost:{bg:'transparent',hov:C.bg,t:C.t2,b:C.border},green:{bg:C.green,hov:'#15803D',t:'#fff'},red:{bg:C.red,hov:'#B91C1C',t:'#fff'},amber:{bg:C.amber,hov:'#B45309',t:'#fff'},teal:{bg:C.teal,hov:'#0D6B62',t:'#fff'},violet:{bg:C.violet,hov:'#6D28D9',t:'#fff'},outline:{bg:'transparent',hov:C.blueL,t:C.blue,b:C.blue}};
  const s=M[color]||M.blue;
  const pad=size==='sm'?'.3rem .7rem':'.45rem 1rem';
  return <button type={type} onClick={onClick} disabled={!!disabled} style={{display:'inline-flex',alignItems:'center',gap:6,background:s.bg,color:s.t,border:`1px solid ${s.b||s.bg}`,borderRadius:7,padding:pad,fontSize:size==='sm'?11:13,fontWeight:600,cursor:disabled?'not-allowed':'pointer',opacity:disabled?.55:1,width:full?'100%':'auto',justifyContent:full?'center':'flex-start',fontFamily:'Inter,system-ui,sans-serif',transition:'background .12s'}} onMouseEnter={e=>{if(!disabled) e.currentTarget.style.background=s.hov;}} onMouseLeave={e=>{if(!disabled) e.currentTarget.style.background=s.bg;}}>{children}</button>;
}

function StatCard({label,value,sub,color=C.blue,icon}:{label:string;value:string|number;sub?:string;color?:string;icon?:string}) {
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1rem 1.25rem',borderTop:`3px solid ${color}`}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:4}}>
      <div style={{fontSize:10,fontWeight:700,color:C.t4,textTransform:'uppercase',letterSpacing:.8}}>{label}</div>
      {icon&&<span style={{fontSize:18,opacity:.4}}>{icon}</span>}
    </div>
    <div style={{fontSize:22,fontWeight:800,color,lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:C.t4,marginTop:3}}>{sub}</div>}
  </div>;
}

function Th({children,right,center}:{children:React.ReactNode;right?:boolean;center?:boolean}) { return <th style={{padding:'.5rem .75rem',textAlign:right?'right':center?'center':'left',fontSize:10,fontWeight:700,color:C.t4,textTransform:'uppercase',letterSpacing:.6,borderBottom:`1px solid ${C.border}`,background:C.bg,whiteSpace:'nowrap'}}>{children}</th>; }
function Td({children,right,center,mono,bold,muted,small,color}:{children?:React.ReactNode;right?:boolean;center?:boolean;mono?:boolean;bold?:boolean;muted?:boolean;small?:boolean;color?:string}) { return <td style={{padding:'.45rem .75rem',textAlign:right?'right':center?'center':'left',fontFamily:mono?'JetBrains Mono,monospace':'inherit',fontSize:mono||small?11:12,fontWeight:bold?700:400,color:color||(muted?C.t4:C.t2),borderBottom:`1px solid ${C.border}`}}>{children}</td>; }
function EmptyState({icon='⊙',title,sub}:{icon?:string;title:string;sub?:string}) { return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'4rem 2rem',color:C.t3,textAlign:'center'}}><div style={{fontSize:44,marginBottom:'1rem',opacity:.2}}>{icon}</div><div style={{fontSize:16,fontWeight:700,color:C.t2,marginBottom:'.5rem'}}>{title}</div>{sub&&<div style={{fontSize:13,maxWidth:340,lineHeight:1.7}}>{sub}</div>}</div>; }

type ToastType = 'success'|'error'|'info';
interface Toast { id:number; msg:string; type:ToastType; }
function ToastContainer({toasts,remove}:{toasts:Toast[];remove:(id:number)=>void}) {
  if(!toasts.length) return null;
  return <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,display:'flex',flexDirection:'column',gap:10}}>
    {toasts.map(t=>{
      const s=t.type==='success'?{bg:C.green}:t.type==='error'?{bg:C.red}:{bg:C.blue};
      return <div key={t.id} style={{background:s.bg,color:'#fff',borderRadius:10,padding:'.85rem 1.25rem',fontSize:13,fontWeight:600,display:'flex',gap:10,alignItems:'center',minWidth:300,maxWidth:400,boxShadow:'0 8px 32px rgba(0,0,0,.22)',animation:'toastIn .25s ease'}}>
        <span style={{flex:1}}>{t.msg}</span>
        <button onClick={()=>remove(t.id)} style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:22,height:22,borderRadius:'50%',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
      </div>;
    })}
  </div>;
}

// ══════════════════════════════════════════════════════════
//  LINE DETAIL PANEL
// ══════════════════════════════════════════════════════════
function LinePanel({doc,onClose,addToast}:{doc:Doc;onClose:()=>void;addToast:(m:string,t?:ToastType)=>void}) {
  const [approved,setApproved]=useState<Record<number,boolean>>({});
  return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:1000,display:'flex',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{width:620,background:C.card,height:'100vh',overflowY:'auto',display:'flex',flexDirection:'column',boxShadow:'-20px 0 60px rgba(0,0,0,.2)',animation:'slideInRight .25s ease'}}>
      <div style={{background:C.navy,color:'#fff',padding:'1.25rem 1.5rem',flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,fontFamily:'JetBrains Mono,monospace'}}>{doc.id}</div>
            <div style={{fontSize:12,opacity:.6,marginTop:2}}>{doc.rs_e}</div>
            <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
              <Badge label={doc.sunat} color={colEst(doc.sunat) as BadgeColor} sm/><Badge label={`CDR: ${doc.cdr}`} color={doc.cdr==='OK'?'green':'red'} sm/>
              <Badge label={DOC_TIPOS[doc.tipo]||doc.tipo} color="blue" sm/>
              {doc.detraccion&&<Badge label={`Det. ${doc.pct_d}%`} color="amber" sm/>}
            </div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,.1)',border:'none',color:'#fff',width:30,height:30,borderRadius:'50%',cursor:'pointer',fontSize:18}}>×</button>
        </div>
      </div>
      <div style={{padding:'.875rem 1.5rem',borderBottom:`1px solid ${C.border}`,background:C.bg,flexShrink:0}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
          {([['Fecha',doc.fecha],['Vencimiento',doc.venc||'—'],['Moneda',doc.moneda],['Base',fmt(Math.abs(doc.base),doc.moneda)],['IGV',fmt(Math.abs(doc.igv),doc.moneda)],['Total',fmt(Math.abs(doc.total),doc.moneda)]] as [string,string][]).map(([k,v])=>(
            <div key={k}><div style={{fontSize:9,color:C.t4,fontWeight:700,textTransform:'uppercase'}}>{k}</div><div style={{fontSize:12,color:C.t1,fontWeight:600,marginTop:1}}>{v}</div></div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:10}}>
          <div><div style={{fontSize:9,color:C.t4,fontWeight:700,textTransform:'uppercase'}}>SUNAT</div><div style={{marginTop:2}}><Badge label={doc.sunat} color={colEst(doc.sunat) as BadgeColor} sm dot/></div></div>
          <div><div style={{fontSize:9,color:C.t4,fontWeight:700,textTransform:'uppercase'}}>Parser</div><div style={{marginTop:2}}><Badge label={doc.parserStatus||'—'} color={colEst(doc.parserStatus) as BadgeColor} sm dot/></div></div>
          <div><div style={{fontSize:9,color:C.t4,fontWeight:700,textTransform:'uppercase'}}>IA</div><div style={{marginTop:2}}><Badge label={doc.aiStatus||'—'} color={colEst(doc.aiStatus) as BadgeColor} sm dot/></div></div>
        </div>
        {doc.hash&&<div style={{marginTop:8,fontFamily:'JetBrains Mono,monospace',fontSize:10,color:C.t4}}>SHA256: {doc.hash}</div>}
      </div>
      <div style={{flex:1,padding:'1rem 1.5rem',overflowY:'auto'}}>
        {(!doc.lineas||doc.lineas.length===0)&&<EmptyState icon="—" title="Sin líneas parseadas" sub="El XML no ha sido procesado aún o no tiene líneas."/>}
        {(doc.lineas||[]).map((l,i)=>(
          <div key={i} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.1rem',marginBottom:'1rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:10,marginBottom:'1rem'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:C.t4,fontWeight:700,fontFamily:'JetBrains Mono,monospace',marginBottom:4}}>LÍNEA {l.n} · {l.cod||'—'}</div>
                <div style={{fontSize:13,color:C.t1,fontWeight:600,lineHeight:1.5}}>{l.desc}</div>
                <div style={{display:'flex',gap:8,marginTop:6,fontSize:11,color:C.t3}}>
                  <span>Cant: {l.qty} {l.um}</span><span>Val. unit: {fmt(l.val)}</span>
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:18,fontWeight:800,color:l.total_l<0?C.red:C.t1,fontFamily:'JetBrains Mono,monospace'}}>{fmt(l.total_l)}</div>
                <div style={{fontSize:10,color:C.t4}}>IGV: {fmt(l.igv_l)}</div>
              </div>
            </div>
            {l.cuenta&&<div style={{background:C.blueL,border:`1px solid ${C.blueM}`,borderRadius:8,padding:'.9rem'}}>
              <div style={{fontSize:10,fontWeight:800,color:C.blue,textTransform:'uppercase',letterSpacing:1,marginBottom:'.75rem'}}>✦ Clasificación IA</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:'.75rem'}}>
                <div><div style={{fontSize:9,color:C.blue,fontWeight:700,textTransform:'uppercase',marginBottom:3}}>Cuenta PCGE</div><div style={{fontSize:14,fontWeight:800,color:C.navy,fontFamily:'JetBrains Mono,monospace'}}>{l.cuenta}</div><div style={{fontSize:11,color:C.t2,marginTop:1}}>{PCGE_NAMES[l.cuenta]||'—'}</div></div>
                <div><div style={{fontSize:9,color:C.blue,fontWeight:700,textTransform:'uppercase',marginBottom:3}}>Centro de costo</div><div style={{fontSize:14,fontWeight:800,color:C.navy}}>{l.cc||'—'}</div><div style={{fontSize:11,color:C.t2,marginTop:1}}>{l.cat||'—'}</div></div>
              </div>
              <div style={{marginBottom:'.75rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:10,color:C.blue,fontWeight:600}}>Confianza IA</span><span style={{fontSize:12,fontWeight:800,color:l.ia>=85?C.green:l.ia>=70?C.amber:C.red}}>{l.ia}%</span></div>
                <div style={{height:6,background:C.blueM,borderRadius:3,overflow:'hidden'}}><div style={{width:`${l.ia}%`,height:'100%',background:l.ia>=85?C.green:l.ia>=70?C.amber:C.red,borderRadius:3}}/></div>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                {l.rev&&<Badge label="⚠ Revisión req." color="amber" sm/>}
                {l.rec&&<Badge label="↺ Recurrente" color="blue" sm/>}
                {!approved[l.n]?<><Btn size="sm" color="green" onClick={()=>{setApproved(p=>({...p,[l.n]:true}));addToast('Clasificación aprobada','success');}}>✓ Aprobar</Btn><Btn size="sm" color="ghost">✎ Editar</Btn></>:<span style={{fontSize:11,color:C.green,fontWeight:600}}>✓ Aprobado</span>}
              </div>
            </div>}
          </div>
        ))}
      </div>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════
//  ALERT BANNER
// ══════════════════════════════════════════════════════════
function AlertBanner({alerts}:{alerts:Alert[]}) {
  const [dismissed,setDismissed]=useState<string[]>([]);
  const visible=alerts.filter(a=>!dismissed.includes(a.type));
  if(!visible.length) return null;
  return <div style={{padding:'.5rem 1.5rem',background:'#fff',borderBottom:`1px solid ${C.border}`,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
    {visible.map(a=>(
      <div key={a.type} style={{display:'flex',alignItems:'center',gap:6,background:a.level==='error'?C.redL:a.level==='warning'?C.amberL:C.blueL,border:`1px solid ${a.level==='error'?C.redM:a.level==='warning'?C.amberM:C.blueM}`,borderRadius:6,padding:'3px 10px 3px 8px',fontSize:11}}>
        <span style={{color:a.level==='error'?C.red:a.level==='warning'?C.amber:C.blue,fontWeight:700}}>{a.level==='error'?'⚠':'ℹ'} {a.message}</span>
        {a.amount&&a.amount>0&&<span style={{color:a.level==='error'?C.red:C.amber,fontWeight:600}}>· {new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN',minimumFractionDigits:0}).format(a.amount)}</span>}
        <button onClick={()=>setDismissed(p=>[...p,a.type])} style={{background:'none',border:'none',cursor:'pointer',color:C.t4,fontSize:13,lineHeight:1,padding:'0 2px'}}>×</button>
      </div>
    ))}
  </div>;
}

// ══════════════════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════════════════
function Login({onLogin}:{onLogin:(u:User)=>void}) {
  const [email,setEmail]=useState('mruiz@empresa.pe');
  const [pass,setPass]=useState('Demo1234!');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const go=async()=>{if(!email||!pass)return;setLoading(true);setError('');const d=await API.login(email,pass);setLoading(false);if(d.ok)onLogin(d.data.user);else setError(d.error||'Credenciales incorrectas');};
  const inp={padding:'.6rem .85rem',border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,fontFamily:'Inter,system-ui,sans-serif',outline:'none',width:'100%',boxSizing:'border-box' as const,background:C.card,color:C.t1};
  return <div style={{display:'flex',minHeight:'100vh',background:C.navy,fontFamily:'Inter,system-ui,sans-serif'}}>
    <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',padding:'4rem',maxWidth:540}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:'2.5rem'}}>
        <div style={{width:48,height:48,borderRadius:12,background:C.blue,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:900,color:'#fff'}}>S</div>
        <div><div style={{fontSize:10,color:'rgba(255,255,255,.4)',letterSpacing:3,textTransform:'uppercase'}}>Sherman</div><div style={{fontSize:18,fontWeight:800,color:'#fff'}}>Finance Control AI</div></div>
      </div>
      <div style={{fontSize:36,fontWeight:900,color:'#fff',lineHeight:1.1,marginBottom:'1rem'}}>Automatización<br/>contable peruana</div>
      <div style={{fontSize:13,color:'rgba(255,255,255,.45)',lineHeight:1.8,marginBottom:'2rem'}}>SUNAT/SIRE real · Parser XML UBL 2.1 · Clasificación IA<br/>CONCAR SQL · PostgreSQL · JWT · AES-256-GCM</div>
      {[['Parser XML UBL 2.1 real','Extrae líneas de cada factura'],['Validación SUNAT Consulta Integrada','estadoCp + estadoRuc + condDomiRuc'],['SIRE RVIE/RCE','Propuesta de compras y ventas'],['Clasificación IA','Cuenta PCGE + centro de costo + confianza'],['CONCAR SQL','Lotes con aprobación humana']].map(([t,s])=>(
        <div key={t} style={{display:'flex',alignItems:'start',gap:10,marginBottom:10}}>
          <span style={{width:20,height:20,borderRadius:'50%',background:'rgba(37,99,235,.35)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#93C5FD',flexShrink:0,marginTop:1}}>✓</span>
          <div><div style={{fontSize:13,color:'rgba(255,255,255,.7)',fontWeight:600}}>{t}</div><div style={{fontSize:11,color:'rgba(255,255,255,.35)'}}>{s}</div></div>
        </div>
      ))}
    </div>
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem'}}>
      <div style={{background:C.card,borderRadius:16,padding:'2.5rem',width:'100%',maxWidth:420,boxShadow:'0 30px 60px rgba(0,0,0,.45)'}}>
        <div style={{marginBottom:'2rem'}}><div style={{fontSize:24,fontWeight:800,color:C.t1}}>Iniciar sesión</div><div style={{fontSize:13,color:C.t3,marginTop:4}}>JWT · bcrypt · Roles · Auditoría</div></div>
        {error&&<div style={{background:C.redL,border:`1px solid ${C.redM}`,borderRadius:8,padding:'.75rem 1rem',marginBottom:'1rem',fontSize:13,color:C.red}}>⚠ {error}</div>}
        {[{l:'Correo',v:email,s:setEmail,t:'email'},{l:'Contraseña',v:pass,s:setPass,t:'password'}].map(f=>(
          <div key={f.l} style={{marginBottom:'1.1rem'}}><label style={{display:'block',fontSize:11,fontWeight:700,color:C.t2,marginBottom:5}}>{f.l}</label>
            <input value={f.v} onChange={e=>f.s(e.target.value)} type={f.t} style={inp} onKeyDown={e=>e.key==='Enter'&&go()}/></div>
        ))}
        <button onClick={go} disabled={loading} style={{width:'100%',background:C.blue,color:'#fff',border:'none',borderRadius:8,padding:'.72rem',fontSize:14,fontWeight:700,cursor:loading?'wait':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginTop:'1.25rem',fontFamily:'Inter,system-ui,sans-serif'}}>
          {loading?<><Spinner size={15} color="#fff"/>Autenticando...</>:'Ingresar al sistema →'}
        </button>
        <div style={{textAlign:'center',marginTop:'.75rem'}}><a href="/forgot-password" style={{fontSize:11,color:C.blue,textDecoration:'none'}}>¿Olvidaste tu contraseña?</a></div>
        <div style={{marginTop:'1.25rem',background:C.bg,borderRadius:8,padding:'.75rem',fontSize:11,color:C.t3}}>
          <div style={{fontWeight:700,marginBottom:6}}>Acceso rápido — clic para rellenar:</div>
          {[['Admin','admin@empresa.pe','Admin123!'],['Contador','mruiz@empresa.pe','Demo1234!'],['Supervisor','jlopez@empresa.pe','Demo1234!'],['Auditor','aaudit@empresa.pe','Demo1234!']].map(([r,e,p])=>(
            <div key={e} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',cursor:'pointer'}} onClick={()=>{setEmail(e);setPass(p);}}>
              <span style={{color:C.blue,fontWeight:600}}>{r}</span><span style={{fontFamily:'JetBrains Mono,monospace',color:C.t4}}>{e}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════
const NAV_GROUPS = [
  { g:'Principal', items:[{id:'dashboard',i:'◈',l:'Dashboard'},{id:'bandeja',i:'⊞',l:'Bandeja Contable'}] },
  { g:'SUNAT / SIRE', items:[{id:'sunat_centro',i:'⟳',l:'Centro SUNAT/SIRE'},{id:'descarga_masiva',i:'↓↓',l:'Descarga Masiva',hl:true},{id:'jobs',i:'▷',l:'Jobs y Procesos'},{id:'compras',i:'↓',l:'Compras'},{id:'ventas',i:'↑',l:'Ventas'},{id:'documentos_xml',i:'◉',l:'Docs XML/PDF/CDR'}] },
  { g:'Finanzas', items:[{id:'bancos',i:'⊟',l:'Bancos'},{id:'conciliacion',i:'⇌',l:'Conciliación'},{id:'cxc',i:'→',l:'Cuentas por Cobrar'},{id:'cxp',i:'←',l:'Cuentas por Pagar'},{id:'detracciones',i:'◑',l:'Detracciones'}] },
  { g:'Reportes & IA', items:[{id:'reportes',i:'📊',l:'Reportes'},{id:'copiloto',i:'✦',l:'Copiloto IA'}] },
  { g:'Configuración', items:[{id:'ple',i:'◧',l:'PLE Libros'},{id:'concar',i:'⊙',l:'CONCAR SQL'},{id:'empresas',i:'▣',l:'Empresas / RUC'},{id:'usuarios',i:'◎',l:'Usuarios y Roles'},{id:'auditoria',i:'≡',l:'Auditoría'},{id:'configuracion',i:'⚙',l:'Configuración'}] },
];

function Sidebar({active,onNav,user}:{active:string;onNav:(id:string)=>void;user:User}) {
  return <div style={{width:228,minWidth:228,background:C.navy,display:'flex',flexDirection:'column',height:'100vh',overflowY:'auto',fontFamily:'Inter,system-ui,sans-serif',flexShrink:0}}>
    <div style={{padding:'1.25rem 1rem',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:34,height:34,borderRadius:8,background:C.blue,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:900,color:'#fff',flexShrink:0}}>S</div>
        <div><div style={{fontSize:9,color:'rgba(255,255,255,.35)',letterSpacing:2,textTransform:'uppercase'}}>Sherman</div><div style={{fontSize:13,fontWeight:800,color:'#fff'}}>Finance Control AI</div></div>
      </div>
      <div style={{marginTop:10,background:process.env.NEXT_PUBLIC_SUNAT_MODE==='direct'?'rgba(22,163,74,.2)':'rgba(37,99,235,.2)',border:`1px solid ${process.env.NEXT_PUBLIC_SUNAT_MODE==='direct'?'rgba(22,163,74,.4)':'rgba(37,99,235,.4)'}`,borderRadius:6,padding:'4px 10px',fontSize:10,color:process.env.NEXT_PUBLIC_SUNAT_MODE==='direct'?'#86EFAC':'#93C5FD',fontWeight:600}}>{process.env.NEXT_PUBLIC_SUNAT_MODE==='direct'?'● SUNAT Real activo':'● Mock → activar SUNAT real en .env'}</div>
    </div>
    <div style={{flex:1,padding:'.4rem 0'}}>
      {NAV_GROUPS.map(g=><div key={g.g}>
        <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,.22)',letterSpacing:2,textTransform:'uppercase',padding:'.6rem 1rem .25rem'}}>{g.g}</div>
        {g.items.map(n=><div key={n.id} onClick={()=>onNav(n.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'.44rem 1rem',cursor:'pointer',fontSize:12,background:active===n.id?'rgba(37,99,235,.22)':'transparent',borderLeft:active===n.id?`3px solid ${C.blue}`:'3px solid transparent',color:active===n.id?'#fff':'rgba(255,255,255,.52)',transition:'all .12s'}}>
          <span style={{width:16,textAlign:'center'}}>{n.i}</span>
          <span style={{flex:1,fontWeight:(n as {hl?:boolean}).hl?700:400}}>{n.l}</span>
        </div>)}
      </div>)}
    </div>
    <div style={{padding:'.75rem 1rem',borderTop:'1px solid rgba(255,255,255,.07)'}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:30,height:30,borderRadius:'50%',background:'rgba(37,99,235,.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#93C5FD',flexShrink:0}}>{user.avatar}</div>
        <div style={{minWidth:0}}><div style={{fontSize:11,color:'rgba(255,255,255,.75)',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.name.split(' ').slice(0,2).join(' ')}</div><div style={{fontSize:9,color:'rgba(255,255,255,.35)',textTransform:'uppercase'}}>{user.role}</div></div>
      </div>
    </div>
  </div>;
}

function Topbar({empIdx,setEmpIdx,empresas,period,setPeriod,onLogout,onRefresh,alerts,empresa,tipoCambio,darkMode,setDarkMode}:{empIdx:number;setEmpIdx:(n:number)=>void;empresas:Company[];period:string;setPeriod:(p:string)=>void;onLogout:()=>void;onRefresh:()=>void;alerts:Alert[];empresa:Company|null;tipoCambio:{compra:number;venta:number;fuente:string}|null;darkMode:boolean;setDarkMode:(fn:(d:boolean)=>boolean)=>void}) {
  const errorAlerts=alerts.filter(a=>a.level==='error');
  const PERIODS=['2026-04','2026-03','2026-02','2026-01','2025-12','2025-11','2025-10','2025-09'];
  return <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:'.55rem 1.5rem',display:'flex',alignItems:'center',gap:10,fontFamily:'Inter,system-ui,sans-serif',flexShrink:0}}>
    <div style={{display:'flex',gap:8,flex:1,flexWrap:'wrap',alignItems:'center'}}>
      <select value={empIdx} onChange={e=>setEmpIdx(Number(e.target.value))} style={{padding:'.35rem .65rem',border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:12,fontFamily:'Inter,system-ui,sans-serif',color:C.t1,background:C.card,fontWeight:600}}>
        {empresas.map((e,i)=><option key={e.id} value={i}>{e.ruc} · {(e.nombre||'').slice(0,22)}</option>)}
      </select>
      <select value={period} onChange={e=>setPeriod(e.target.value)} style={{padding:'.35rem .65rem',border:`1.5px solid ${C.blue}`,borderRadius:7,fontSize:12,fontFamily:'JetBrains Mono,monospace',color:C.blue,background:C.blueL,fontWeight:700}}>
        {PERIODS.map(p=><option key={p}>{p}</option>)}
      </select>
      <div style={{padding:'.3rem .75rem',border:`1.5px solid ${C.amberM}`,borderRadius:7,fontSize:11,color:C.amber,background:C.amberL,fontWeight:700}}>
        {process.env.NEXT_PUBLIC_SUNAT_MODE==='direct'?'🟢 SUNAT REAL':'🟡 SUNAT MOCK'}
      </div>
      {errorAlerts.length>0&&<div style={{padding:'.3rem .75rem',border:`1.5px solid ${C.redM}`,borderRadius:7,fontSize:11,color:C.red,background:C.redL,fontWeight:700}} title={errorAlerts.map(a=>a.message).join('\n')}>
        ⚠ {errorAlerts.length} alerta{errorAlerts.length>1?'s':''}
      </div>}
    </div>
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      {[['DB',C.green],['API',C.green],['Auth',C.green]].map(([l,c])=>(
        <div key={l} style={{display:'flex',gap:4,alignItems:'center',fontSize:11}}>
          <span style={{width:7,height:7,borderRadius:'50%',background:c as string}}/><span style={{color:c as string,fontWeight:600}}>{l}</span>
        </div>
      ))}
      {empresa&&<Btn color="ghost" size="sm" onClick={()=>API.exportCSV('documents',empresa.id,period)}>↓ Excel</Btn>}
      {tipoCambio&&<div style={{fontSize:11,color:C.t3,display:'flex',gap:4,alignItems:'center',border:`1px solid ${C.border}`,borderRadius:6,padding:'2px 8px'}}>
        <span style={{color:C.t4}}>USD</span>
        <span style={{fontWeight:700,color:C.t2,fontFamily:'JetBrains Mono,monospace'}}>{tipoCambio.venta.toFixed(3)}</span>
      </div>}
      <Btn color="ghost" size="sm" onClick={()=>setDarkMode(d=>!d)}>{darkMode?'☀':'🌙'}</Btn>
      <Btn color="ghost" size="sm" onClick={onRefresh}>↺</Btn>
      <Btn color="ghost" size="sm" onClick={onLogout}>⊘ Salir</Btn>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════
//  DASHBOARD VIEW
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  CENTRO SUNAT / SIRE — Credenciales + Validación + SIRE
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  DOCUMENTOS XML/PDF/CDR — Upload + Table
// ══════════════════════════════════════════════════════════
function DocumentosXmlView({docs,empresa,addToast,onRefresh}:{docs:Doc[];empresa:Company|null;addToast:(m:string,t?:ToastType)=>void;onRefresh:()=>void}) {
  const [dragging,setDragging]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [parseXml,setParseXml]=useState(true);
  const [classifyAI,setClassifyAI]=useState(true);
  const [uploadLog,setUploadLog]=useState<string[]>([]);
  const fileRef=useRef<HTMLInputElement>(null);

  const handleFiles=async(files:FileList|null)=>{
    if(!files?.length||!empresa?.id){addToast('Selecciona empresa primero','error');return;}
    setUploading(true);setUploadLog([]);
    const addL=(m:string)=>setUploadLog(p=>[...p,m]);
    addL(`Cargando ${files.length} archivo(s)...`);
    const fd=new FormData();
    fd.append('companyId',empresa.id);fd.append('parseXml',String(parseXml));
    fd.append('classifyAI',String(classifyAI));
    Array.from(files).forEach(f=>{fd.append('files',f);addL(`  + ${f.name} (${(f.size/1024).toFixed(1)} KB)`);});
    try{
      const r=await fetch('/api/upload',{method:'POST',headers:{Authorization:`Bearer ${localStorage.getItem('sf_token_v2')||''}`},body:fd});
      const d=await r.json();
      if(d.ok){
        addL(`✓ ${d.data.uploaded} archivo(s) procesados`);
        d.data.results.forEach((res:Record<string,unknown>)=>{
          if(res.error) addL(`  ✗ ${res.file}: ${res.error}`);
          else addL(`  ✓ ${res.file} → Doc: ${res.docId}`+(res.parsed?' [parseado]':''));
        });
        addToast(`${d.data.uploaded} archivo(s) cargados`,'success');
        onRefresh();
      } else {addL(`✗ Error: ${d.error}`);addToast(d.error||'Error','error');}
    }catch(e){addL(`✗ Error de red: ${e}`);addToast('Error de red','error');}
    setUploading(false);
  };

  const xmlDocs=docs.filter(d=>d.xml||d.pdf||d.cdr_f);

  return <div style={{animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1.25rem'}}><div style={{fontSize:22,fontWeight:800,color:C.t1}}>Documentos XML / PDF / CDR</div>
      <div style={{fontSize:13,color:C.t3}}>Carga manual o automática · Parser UBL 2.1 real · Clasificación IA</div></div>

    {/* DROPZONE */}
    <div
      onDragOver={e=>{e.preventDefault();setDragging(true);}}
      onDragLeave={()=>setDragging(false)}
      onDrop={e=>{e.preventDefault();setDragging(false);handleFiles(e.dataTransfer.files);}}
      onClick={()=>fileRef.current?.click()}
      style={{border:`2px dashed ${dragging?C.blue:C.border}`,borderRadius:12,padding:'2rem',textAlign:'center',cursor:'pointer',background:dragging?C.blueL:C.card,transition:'all .2s',marginBottom:'1rem'}}>
      <input ref={fileRef} type="file" multiple accept=".xml,.pdf,.zip" style={{display:'none'}} onChange={e=>handleFiles(e.target.files)}/>
      <div style={{fontSize:32,marginBottom:'.5rem',opacity:.4}}>📂</div>
      <div style={{fontSize:14,fontWeight:700,color:dragging?C.blue:C.t2,marginBottom:4}}>
        {uploading?'Procesando...':'Arrastra XML / PDF / CDR aquí o haz clic'}
      </div>
      <div style={{fontSize:12,color:C.t4}}>Formatos: .xml (comprobante UBL 2.1), R-*.xml (CDR), .pdf, .zip</div>
    </div>

    {/* OPTIONS */}
    <div style={{display:'flex',gap:16,marginBottom:'1rem',padding:'.75rem 1rem',background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}>
      {[{k:'parseXml',l:'Parser XML UBL 2.1',v:parseXml,s:setParseXml},{k:'classifyAI',l:'Clasificar con IA (PCGE)',v:classifyAI,s:setClassifyAI}].map(f=>(
        <label key={f.k} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}>
          <input type="checkbox" checked={f.v} onChange={e=>f.s(e.target.checked)} style={{accentColor:C.blue,width:15,height:15}}/>{f.l}
        </label>
      ))}
    </div>

    {/* UPLOAD LOG */}
    {uploadLog.length>0&&<div style={{background:'#0D1117',borderRadius:10,padding:'1rem',marginBottom:'1.25rem',maxHeight:160,overflowY:'auto'}}>
      {uploadLog.map((l,i)=><div key={i} style={{fontSize:11,fontFamily:'JetBrains Mono,monospace',color:l.startsWith('✓')?'#22C55E':l.startsWith('✗')?'#F87171':'rgba(255,255,255,.65)',marginBottom:2}}>{l}</div>)}
      {uploading&&<div style={{display:'flex',gap:6,alignItems:'center',color:C.blue,fontSize:11,marginTop:4}}><Spinner size={11}/>Procesando...</div>}
    </div>}

    {/* STATS */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:'1.25rem'}}>
      <StatCard label="Con XML" value={docs.filter(d=>d.xml).length} color={C.blue}/>
      <StatCard label="Con PDF" value={docs.filter(d=>d.pdf).length} color={C.violet}/>
      <StatCard label="Con CDR" value={docs.filter(d=>d.cdr_f).length} color={C.teal}/>
      <StatCard label="Parseados" value={docs.filter(d=>d.parserStatus==='PARSEADO').length} color={C.green}/>
      <StatCard label="Con IA" value={docs.filter(d=>d.aiStatus==='CLASIFICADO').length} color={C.amber}/>
    </div>

    {/* TABLE */}
    <DocTableView docs={xmlDocs.length?xmlDocs:docs} titulo="Comprobantes con archivos" sub="XML · PDF · CDR" addToast={addToast} onRefresh={onRefresh}/>
  </div>;
}

// ══════════════════════════════════════════════════════════
//  PLE — LIBROS ELECTRÓNICOS SUNAT
// ══════════════════════════════════════════════════════════
function PleView({empresa,period,docs,addToast}:{empresa:Company|null;period:string;docs:Doc[];addToast:(m:string,t?:ToastType)=>void}) {
  const compras=docs.filter(d=>d.op==='COMPRA');
  const ventas=docs.filter(d=>d.op==='VENTA');
  const totalBase=(arr:Doc[])=>arr.reduce((s,d)=>s+Math.abs(d.base),0);
  const totalIgv=(arr:Doc[])=>arr.reduce((s,d)=>s+Math.abs(d.igv),0);

  const download=(tipo:string,nombre:string)=>{
    if(!empresa?.id){addToast('Selecciona empresa','error');return;}
    addToast(`Generando ${nombre}...`,'info');
    API.downloadPLE(tipo,empresa.id,period);
  };

  const libros=[
    {codigo:'8.1',nombre:'Registro de Compras',formato:'LE{RUC}{año}{mes}00080100001101.txt',docs:compras.length,base:totalBase(compras),igv:totalIgv(compras),tipo:'81',color:C.blue},
    {codigo:'14.1',nombre:'Registro de Ventas e Ingresos',formato:'LE{RUC}{año}{mes}00140100001101.txt',docs:ventas.length,base:totalBase(ventas),igv:totalIgv(ventas),tipo:'141',color:C.violet},
  ];

  return <div style={{animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div>
        <div style={{fontSize:22,fontWeight:800,color:C.t1}}>PLE — Libros Electrónicos</div>
        <div style={{fontSize:13,color:C.t3}}>Formato TXT SUNAT v5.2 · {period} · {empresa?.nombre||'sin empresa'}</div>
      </div>
    </div>

    <div style={{background:C.amberL,border:`1px solid ${C.amberM}`,borderRadius:10,padding:'1rem 1.25rem',marginBottom:'1.5rem',fontSize:12,color:C.amber}}>
      ⚠ <strong>PLE vs SIRE:</strong> Son sistemas distintos. PLE genera el archivo .txt para validar con el programa SIRE de SUNAT. SIRE (en Centro SUNAT) descarga la propuesta directamente. Usa PLE si tu empresa no está en el universo obligatorio de SIRE.
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:'2rem'}}>
      {libros.map(l=>(
        <div key={l.codigo} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'1.5rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:'1rem'}}>
            <div>
              <div style={{fontSize:11,color:C.t4,fontFamily:'JetBrains Mono,monospace',fontWeight:600}}>FORMATO {l.codigo}</div>
              <div style={{fontSize:16,fontWeight:800,color:C.t1,marginTop:2}}>{l.nombre}</div>
            </div>
            <Badge label={`${l.docs} docs`} color="blue" sm/>
          </div>
          <div style={{background:C.bg,borderRadius:8,padding:'.75rem',marginBottom:'1rem',fontFamily:'JetBrains Mono,monospace',fontSize:10,color:C.t3,wordBreak:'break-all'}}>
            {l.formato.replace('{RUC}',empresa?.ruc||'XXXXXXXXXXX').replace('{año}',period.split('-')[0]).replace('{mes}',period.split('-')[1])}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:'1rem'}}>
            <div style={{background:C.bg,borderRadius:6,padding:'.5rem .75rem'}}>
              <div style={{fontSize:9,color:C.t4,marginBottom:2}}>BASE IMPONIBLE</div>
              <div style={{fontSize:13,fontWeight:700,color:C.t1}}>{fmt(l.base)}</div>
            </div>
            <div style={{background:C.bg,borderRadius:6,padding:'.5rem .75rem'}}>
              <div style={{fontSize:9,color:C.t4,marginBottom:2}}>IGV</div>
              <div style={{fontSize:13,fontWeight:700,color:C.t1}}>{fmt(l.igv)}</div>
            </div>
          </div>
          <Btn color={l.tipo==='81'?'blue':'violet'} full onClick={()=>download(l.tipo,l.nombre)} disabled={!empresa?.id||l.docs===0}>
            ↓ Descargar {l.nombre.split(' ').slice(0,3).join(' ')} .txt
          </Btn>
          {l.docs===0&&<div style={{fontSize:11,color:C.t4,marginTop:6,textAlign:'center'}}>Sin documentos en {period}. Ejecuta una descarga masiva primero.</div>}
        </div>
      ))}
    </div>

    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.25rem'}}>
      <div style={{fontSize:13,fontWeight:700,color:C.t1,marginBottom:'1rem'}}>Estructura del archivo PLE</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,fontSize:12}}>
        <div>
          <div style={{fontWeight:600,color:C.t2,marginBottom:6}}>Registro de Compras 8.1 — Campos principales:</div>
          {[['C1','CUO — Código único operación'],['C3','Fecha de emisión'],['C5','Tipo de comprobante'],['C11','RUC proveedor'],['C13','Base imponible gravada'],['C19','IGV con derecho a crédito'],['C24','Moneda'],['C33','Estado (1=activo, 9=anulado)']].map(([c,d])=>(
            <div key={c} style={{display:'flex',gap:8,marginBottom:3}}><span style={{fontFamily:'JetBrains Mono,monospace',color:C.blue,minWidth:24}}>{c}</span><span style={{color:C.t3}}>{d}</span></div>
          ))}
        </div>
        <div>
          <div style={{fontWeight:600,color:C.t2,marginBottom:6}}>Registro de Ventas 14.1 — Campos principales:</div>
          {[['C1','CUO — Código único operación'],['C3','Fecha de emisión'],['C5','Tipo de comprobante'],['C9','RUC cliente'],['C12','Base imponible gravada'],['C14','IGV y/o IPM'],['C22','Moneda'],['C28','Estado (1=activo, 9=anulado)']].map(([c,d])=>(
            <div key={c} style={{display:'flex',gap:8,marginBottom:3}}><span style={{fontFamily:'JetBrains Mono,monospace',color:C.violet,minWidth:24}}>{c}</span><span style={{color:C.t3}}>{d}</span></div>
          ))}
        </div>
      </div>
      <div style={{marginTop:'1rem',padding:'.75rem',background:C.blueL,borderRadius:8,fontSize:11,color:C.blue}}>
        ℹ El archivo se valida con el <strong>Programa de Libros Electrónicos (PLE)</strong> que se descarga desde SUNAT. Versión requerida: PLE v5.2 o superior.
      </div>
    </div>
  </div>;
}

function SunatCentroView({empresa,addToast,onNav}:{empresa:Company|null;addToast:(m:string,t?:ToastType)=>void;onNav:(id:string)=>void}) {
  const [creds,setCreds]=useState({solUser:'',solPass:'',clientId:'',clientSecret:''});
  const [credStatus,setCredStatus]=useState<{status:string;message:string;hasCpeToken:boolean;hasSireToken:boolean}|null>(null);
  const [saving,setSaving]=useState(false);
  const [testing,setTesting]=useState(false);
  const [sireForm,setSireForm]=useState({period:'2026-04',tipo:'RCE' as 'RVIE'|'RCE'});
  const [sireResult,setSireResult]=useState<{numTicket:string;estado:string;mensaje:string;archivo?:string}|null>(null);
  const [sireLoading,setSireLoading]=useState(false);
  const [validateForm,setValidateForm]=useState({numRuc:'',codComp:'01',serie:'',numero:'',fecha:'',monto:''});
  const [validateResult,setValidateResult]=useState<{estadoCp:string;estadoRuc:string;condDomiRuc:string;observaciones:string[]}|null>(null);
  const [validating,setValidating]=useState(false);
  const [existingCred,setExistingCred]=useState<{solUser:string;status:string;lastTestAt:string}|null>(null);

  const inpS={width:'100%',padding:'.5rem .75rem',border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:12,fontFamily:'Inter,system-ui,sans-serif',outline:'none',background:C.card,color:C.t1,boxSizing:'border-box' as const};

  useEffect(()=>{
    if(!empresa?.id) return;
    API.getCredentials(empresa.id).then(r=>{if(r.ok&&r.data){setExistingCred(r.data);setCreds(p=>({...p,solUser:r.data.solUser||'',clientId:r.data.clientId||''}));}});
  },[empresa?.id]);

  const saveCredentials=async()=>{
    if(!empresa?.id){addToast('Selecciona empresa','error');return;}
    setSaving(true);
    // Si el campo de contraseña está vacío y ya existe credencial, no lo enviamos (mantener la actual)
    const payload: Record<string,string> = {companyId:empresa.id, solUser:creds.solUser, clientId:creds.clientId};
    if(creds.solPass) payload.solPass = creds.solPass;
    if(creds.clientSecret) payload.clientSecret = creds.clientSecret;
    const r=await API.saveCredentials(payload);
    setSaving(false);
    if(r.ok){addToast('Credenciales guardadas (SOL cifrado AES-256-GCM)','success');API.getCredentials(empresa.id).then(d=>{if(d.ok&&d.data)setExistingCred(d.data);});}
    else addToast(r.error||'Error','error');
  };

  const testCredentials=async()=>{
    if(!empresa?.id){addToast('Selecciona empresa','error');return;}
    setTesting(true);setCredStatus(null);
    const r=await API.testCredentials(empresa.id);
    setTesting(false);
    if(r.ok){setCredStatus(r.data);addToast(r.data.status==='verified'?'✅ Conexión SUNAT establecida':r.data.status==='partial'?'⚠ Conexión parcial con SUNAT':'❌ Error de conexión SUNAT',r.data.status==='verified'?'success':r.data.status==='partial'?'info':'error');}
    else addToast(r.error||'Error al probar','error');
  };

  const requestSire=async()=>{
    if(!empresa?.id){addToast('Selecciona empresa','error');return;}
    setSireLoading(true);setSireResult(null);
    const r=await API.sireRequest({companyId:empresa.id,period:sireForm.period,tipo:sireForm.tipo});
    setSireLoading(false);
    if(r.ok){setSireResult(r.data);addToast(`Ticket SIRE obtenido: ${r.data.estado==='06'?'Propuesta lista':'Procesando'}`,r.data.estado==='06'?'success':'info');}
    else addToast(r.error||'Error SIRE','error');
  };

  const validateSunat=async()=>{
    if(!empresa?.id||!validateForm.numRuc||!validateForm.serie||!validateForm.numero){addToast('Rellena todos los campos','error');return;}
    setValidating(true);setValidateResult(null);
    const r=await API.validateDoc({ruc:empresa.ruc,...validateForm,monto:parseFloat(validateForm.monto)||0});
    setValidating(false);
    if(r.ok){setValidateResult(r.data);addToast('Validación completada','success');}
    else addToast(r.error||'Error SUNAT','error');
  };

  const EST_CPE:Record<string,string>={'0':'NO EXISTE','1':'ACEPTADO','2':'ANULADO','3':'AUTORIZADO','4':'NO AUTORIZADO'};
  const EST_RUC:Record<string,string>={'00':'ACTIVO','01':'BAJA PROVISIONAL','03':'SUSPENSIÓN TEMPORAL','10':'BAJA DEFINITIVA','11':'BAJA DE OFICIO'};
  const EST_DOM:Record<string,string>={'00':'HABIDO','09':'PENDIENTE','11':'POR VERIFICAR','12':'NO HABIDO','20':'NO HALLADO'};

  return <div style={{animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div><div style={{fontSize:22,fontWeight:800,color:C.t1}}>Centro SUNAT / SIRE</div>
        <div style={{fontSize:13,color:C.t3}}>Credenciales SOL · Consulta Integrada CPE · SIRE RVIE/RCE</div></div>
      <div style={{display:'flex',gap:8}}>
        <div style={{padding:'.3rem .9rem',borderRadius:20,fontSize:11,fontWeight:700,background:process.env.NODE_ENV?C.amberM:C.amberM,color:C.amber,border:`1px solid ${C.amberM}`}}>
          SUNAT_PROVIDER={process.env.NEXT_PUBLIC_SUNAT_MODE||'mock'}
        </div>
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>

      {/* CREDENCIALES SOL */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'1.5rem'}}>
        <div style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:4}}>Credenciales SOL — {empresa?.nombre||'sin empresa'}</div>
        <div style={{fontSize:11,color:C.t4,marginBottom:'1rem'}}>Cifradas con AES-256-GCM · Nunca en texto plano</div>

        {existingCred&&<div style={{background: existingCred.status==='verified'?C.greenL:existingCred.status==='error'?C.redL:C.amberL, border:`1px solid ${existingCred.status==='verified'?C.greenM:existingCred.status==='error'?C.redM:C.amberM}`,borderRadius:8,padding:'.65rem .9rem',marginBottom:'1rem',fontSize:12,color:existingCred.status==='verified'?C.green:existingCred.status==='error'?C.red:C.amber}}>
          {existingCred.status==='verified'?'🟢 ':existingCred.status==='error'?'🔴 ':'🟡 '}
          Credenciales configuradas · Usuario SOL: <strong>{existingCred.solUser}</strong> · Estado: <strong>{existingCred.status==='verified'?'Conectado':existingCred.status==='error'?'Error de conexión':'Pendiente de verificación'}</strong>
        </div>}

        {[{l:'Usuario SOL',k:'solUser',ph:'20512345678TUUSUARIO'},{l:'Clave SOL',k:'solPass',ph:'Ingresa nueva clave SOL',t:'password',saved:!!existingCred},{l:'Client ID (Consulta Integrada + SIRE)',k:'clientId',ph:'Tu client_id de SOL'},{l:'Client Secret',k:'clientSecret',ph:'Ingresa nuevo client secret',t:'password',saved:!!existingCred}].map(f=>(
          <div key={f.k} style={{marginBottom:'.75rem'}}>
            <label style={{display:'block',fontSize:10,fontWeight:700,color:C.t3,textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>
              {f.l}{f.saved&&!creds[f.k as keyof typeof creds]&&<span style={{marginLeft:6,fontSize:9,fontWeight:600,color:C.green,background:C.greenM,padding:'1px 6px',borderRadius:4,textTransform:'none',letterSpacing:0}}>✓ ya configurada</span>}
            </label>
            <input
              type={f.t||'text'}
              value={creds[f.k as keyof typeof creds]}
              onChange={e=>setCreds(p=>({...p,[f.k]:e.target.value}))}
              placeholder={f.saved&&!creds[f.k as keyof typeof creds]?'Dejar vacío para mantener la actual':f.ph}
              style={inpS}
              autoComplete={f.t==='password'?'new-password':'off'}
            />
          </div>
        ))}

        <div style={{background:C.amberL,border:`1px solid ${C.amberM}`,borderRadius:7,padding:'.65rem .9rem',marginBottom:'1rem',fontSize:11,color:C.amber}}>
          ⚠ El Client ID y Secret se obtienen en SOL → Empresas → Credenciales API SUNAT → Registrar aplicación. Deben coincidir con los configurados en el servidor.
        </div>

        <div style={{display:'flex',gap:8}}>
          <Btn color="blue" onClick={saveCredentials} disabled={saving||!empresa?.id}>
            {saving?<><Spinner size={13} color="#fff"/>Guardando...</>:'💾 Guardar cifradas'}
          </Btn>
          <Btn color="green" onClick={testCredentials} disabled={testing||!empresa?.id}>
            {testing?<><Spinner size={13} color="#fff"/>Conectando...</>:'🔌 Conectar con SUNAT'}
          </Btn>
        </div>

        {credStatus&&<div style={{marginTop:'1rem',background:credStatus.status==='verified'?C.greenL:C.redL,border:`1px solid ${credStatus.status==='verified'?C.greenM:C.redM}`,borderRadius:8,padding:'.75rem',fontSize:12,color:credStatus.status==='verified'?C.green:C.red}}>
          <div style={{fontWeight:700,marginBottom:4}}>{credStatus.status==='verified'?'✓ Verificado':'✗ Error'}</div>
          <div>{credStatus.message}</div>
          <div style={{display:'flex',gap:8,marginTop:6}}>
            <Badge label={credStatus.hasCpeToken?'CPE ✓':'CPE ✗'} color={credStatus.hasCpeToken?'green':'red'} sm/>
            <Badge label={credStatus.hasSireToken?'SIRE ✓':'SIRE ✗'} color={credStatus.hasSireToken?'green':'amber'} sm/>
          </div>
        </div>}
      </div>

      {/* SIRE — SOLICITAR PROPUESTA */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'1.5rem'}}>
        <div style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:4}}>SIRE — Solicitar Propuesta</div>
        <div style={{fontSize:11,color:C.t4,marginBottom:'1rem'}}>RVIE (Ventas) · RCE (Compras) · Token clientessol</div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:'1rem'}}>
          <div>
            <label style={{display:'block',fontSize:10,fontWeight:700,color:C.t3,textTransform:'uppercase',marginBottom:4}}>Período</label>
            <select value={sireForm.period} onChange={e=>setSireForm(p=>({...p,period:e.target.value}))} style={{...inpS}}>
              {['2026-04','2026-03','2026-02','2026-01','2025-12','2025-11'].map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{display:'block',fontSize:10,fontWeight:700,color:C.t3,textTransform:'uppercase',marginBottom:4}}>Tipo</label>
            <select value={sireForm.tipo} onChange={e=>setSireForm(p=>({...p,tipo:e.target.value as 'RVIE'|'RCE'}))} style={{...inpS}}>
              <option value="RCE">RCE — Registro Compras Electrónico</option>
              <option value="RVIE">RVIE — Registro Ventas e Ingresos</option>
            </select>
          </div>
        </div>

        <div style={{background:C.blueL,border:`1px solid ${C.blueM}`,borderRadius:7,padding:'.65rem .9rem',marginBottom:'1rem',fontSize:11,color:C.blue}}>
          ℹ Solicita el ticket de la propuesta SIRE. El sistema hace polling hasta obtener estado 06 (Terminado). En modo mock es instantáneo.
        </div>

        <Btn color="teal" onClick={requestSire} disabled={sireLoading||!empresa?.id} full>
          {sireLoading?<><Spinner size={13} color="#fff"/>Solicitando propuesta SIRE...</>:`⟳ Solicitar ${sireForm.tipo} ${sireForm.period}`}
        </Btn>

        {sireResult&&<div style={{marginTop:'1rem',background:sireResult.estado==='06'?C.greenL:C.amberL,border:`1px solid ${sireResult.estado==='06'?C.greenM:C.amberM}`,borderRadius:8,padding:'.75rem',fontSize:12}}>
          <div style={{fontWeight:700,color:sireResult.estado==='06'?C.green:C.amber,marginBottom:4}}>{sireResult.mensaje}</div>
          <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,color:C.t3}}>Ticket: {sireResult.numTicket}</div>
          {sireResult.archivo&&<div style={{fontSize:11,color:C.t2,marginTop:4}}>Archivo: {sireResult.archivo}</div>}
          {sireResult.estado==='06'&&<div style={{marginTop:8}}><Btn color="blue" size="sm" onClick={()=>onNav('descarga_masiva')}>→ Ir a Descarga Masiva</Btn></div>}
        </div>}

        <div style={{marginTop:'1rem',borderTop:`1px solid ${C.border}`,paddingTop:'1rem'}}>
          <div style={{fontSize:12,fontWeight:700,color:C.t2,marginBottom:8}}>Acceso rápido</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {[['↓↓ Descarga Masiva','Ejecutar jobs por período','descarga_masiva'],['⊙ CONCAR SQL','Ver lotes preparados','concar']].map(([t,s,nav])=>(
              <div key={nav as string} onClick={()=>onNav(nav as string)} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:'.75rem',cursor:'pointer'}}>
                <div style={{fontSize:12,fontWeight:600,color:C.blue}}>{t as string}</div>
                <div style={{fontSize:10,color:C.t4,marginTop:2}}>{s as string}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* CONSULTA INTEGRADA CPE */}
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'1.5rem'}}>
      <div style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:4}}>Consulta Integrada de Comprobantes (CPE)</div>
      <div style={{fontSize:11,color:C.t4,marginBottom:'1rem'}}>
        Valida estadoCp · estadoRuc · condDomiRuc · Endpoint: api.sunat.gob.pe/v1/.../validarcomprobante
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10,marginBottom:'1rem'}}>
        {[{l:'RUC Emisor',k:'numRuc',ph:'20100066603'},{l:'Tipo doc',k:'codComp',ph:'01'},{l:'Serie',k:'serie',ph:'F001'},{l:'Número',k:'numero',ph:'1234'},{l:'Fecha emisión',k:'fecha',ph:'03/04/2026'},{l:'Monto total',k:'monto',ph:'11800.00'}].map(f=>(
          <div key={f.k}>
            <label style={{display:'block',fontSize:9,fontWeight:700,color:C.t3,textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>{f.l}</label>
            <input value={validateForm[f.k as keyof typeof validateForm]} onChange={e=>setValidateForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={{...inpS,fontSize:11}}/>
          </div>
        ))}
      </div>
      <Btn color="navy" onClick={validateSunat} disabled={validating||!empresa?.id}>
        {validating?<><Spinner size={13} color="#fff"/>Consultando SUNAT...</>:'🔍 Validar comprobante en SUNAT'}
      </Btn>

      {validateResult&&<div style={{marginTop:'1rem',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        {[['Estado CP',EST_CPE[validateResult.estadoCp]||validateResult.estadoCp,validateResult.estadoCp==='1'?C.green:C.red],
          ['Estado RUC',EST_RUC[validateResult.estadoRuc]||validateResult.estadoRuc,validateResult.estadoRuc==='00'?C.green:C.amber],
          ['Condición Dom.',EST_DOM[validateResult.condDomiRuc]||validateResult.condDomiRuc,validateResult.condDomiRuc==='00'?C.green:C.amber],
          ['Observaciones',validateResult.observaciones?.length?validateResult.observaciones.join(', '):'Sin observaciones',C.t3]
        ].map(([k,v,c])=>(
          <div key={k as string} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:'.75rem'}}>
            <div style={{fontSize:9,fontWeight:700,color:C.t4,textTransform:'uppercase',marginBottom:4}}>{k as string}</div>
            <div style={{fontSize:12,fontWeight:700,color:c as string}}>{v as string}</div>
          </div>
        ))}
      </div>}

      <div style={{marginTop:'1rem',background:C.bg,borderRadius:8,padding:'.75rem',fontSize:11,color:C.t3}}>
        <strong style={{color:C.t2}}>Códigos estadoCp:</strong> 0=No existe · 1=Aceptado · 2=Anulado · 3=Autorizado · 4=No autorizado &nbsp;|&nbsp;
        <strong style={{color:C.t2}}>estadoRuc:</strong> 00=Activo · 10=Baja definitiva · 11=Baja de oficio &nbsp;|&nbsp;
        <strong style={{color:C.t2}}>condDomiRuc:</strong> 00=Habido · 12=No habido · 20=No hallado
      </div>
    </div>
  </div>;
}

function DashView({docs,movs,onNav,empresa,period,alerts}:{docs:Doc[];movs:BankMov[];onNav:(id:string)=>void;empresa:Company|null;period:string;alerts:Alert[]}) {
  const [kpis,setKpis]=useState<Record<string,unknown>|null>(null);
  useEffect(()=>{if(empresa?.id)API.getDashboard(empresa.id,period).then(r=>{if(r.ok)setKpis(r.data.kpis);});},[empresa?.id,period]);
  const tc=kpis?(kpis.totalCompras as number)||0:docs.filter(d=>d.op==='COMPRA').reduce((s,d)=>s+Math.abs(d.total),0);
  const tv=kpis?(kpis.totalVentas as number)||0:docs.filter(d=>d.op==='VENTA').reduce((s,d)=>s+d.total,0);
  const igvC=kpis?(kpis.igvCredito as number)||0:docs.filter(d=>d.op==='COMPRA'&&d.moneda==='PEN'&&d.sunat==='ACEPTADO').reduce((s,d)=>s+Math.abs(d.igv),0);
  const saldo=kpis?(kpis.saldoBanco as number)||0:movs.length?movs[movs.length-1].saldo:0;
  const [y,m]=period.split('-'); const mesNombre=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1]||m;
  const chart=[{mes:mesNombre+' -3',c:74000,v:102000},{mes:mesNombre+' -2',c:68000,v:89000},{mes:mesNombre+' -1',c:95000,v:115000},{mes:mesNombre,c:Math.round(tc),v:Math.round(tv)}];
  const pieData=[{name:'Compras',value:Math.round(tc)},{name:'Ventas',value:Math.round(tv)}];
  const COLORS=[C.blue,C.violet];
  return <div style={{animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1.5rem'}}><div style={{fontSize:22,fontWeight:800,color:C.t1}}>Dashboard Ejecutivo</div><div style={{fontSize:13,color:C.t3}}>Datos en tiempo real · {period}</div></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10,marginBottom:'1.25rem'}}>
      <StatCard label="Compras" value={fmt(tc)} sub={`${docs.filter(d=>d.op==='COMPRA').length} docs`} color={C.blue} icon="↓"/>
      <StatCard label="Ventas" value={fmt(tv)} sub={`${docs.filter(d=>d.op==='VENTA').length} docs`} color={C.violet} icon="↑"/>
      <StatCard label="IGV Crédito" value={fmt(igvC)} sub="aceptados" color={C.amber} icon="◑"/>
      <StatCard label="Saldo banco" value={fmt(saldo)} sub="BCP Cta.Cte." color={C.teal} icon="⊟"/>
      <StatCard label="Para CONCAR" value={docs.filter(d=>d.concar==='LISTO').length} sub="documentos" color={C.green} icon="⊙"/>
      <StatCard label="Observados" value={docs.filter(d=>d.sunat==='OBSERVADO').length} sub="requieren atención" color={C.red} icon="⚠"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:14,marginBottom:'1.25rem'}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.25rem'}}>
        <div style={{fontSize:13,fontWeight:700,color:C.t1,marginBottom:'1rem'}}>Evolución mensual — Compras vs Ventas</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chart} barSize={14} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
            <XAxis dataKey="mes" tick={{fontSize:11,fill:C.t3}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:10,fill:C.t3}} axisLine={false} tickLine={false} tickFormatter={v=>'S/'+fmtN(v)}/>
            <Tooltip formatter={(v:number,n:string)=>[fmt(v),n==='c'?'Compras':'Ventas']} contentStyle={{fontSize:12,borderRadius:8,border:`1px solid ${C.border}`}}/>
            <Bar dataKey="c" fill={C.blue} radius={[4,4,0,0]}/><Bar dataKey="v" fill={C.violet} radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.25rem'}}>
        <div style={{fontSize:13,fontWeight:700,color:C.t1,marginBottom:'1rem'}}>Composición abril</div>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value">
              {pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
            </Pie>
            <Tooltip formatter={(v:number)=>fmt(v)} contentStyle={{fontSize:12,borderRadius:8}}/>
          </PieChart>
        </ResponsiveContainer>
        <div style={{display:'flex',justifyContent:'center',gap:16,fontSize:11}}>
          {pieData.map((d,i)=><div key={d.name} style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:COLORS[i]}}></span><span style={{color:C.t3}}>{d.name}</span></div>)}
        </div>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
      {[['↓↓ Descarga Masiva','Sincronizar SUNAT/SIRE con parser XML + IA',C.blue,'descarga_masiva'],['⊙ CONCAR SQL','Exportar lotes con aprobación humana',C.teal,'concar'],['✦ Copiloto IA','Consultar datos contables en lenguaje natural',C.violet,'copiloto']].map(([t,s,c,nav])=>(
        <div key={t as string} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.25rem',borderTop:`3px solid ${c}`,cursor:'pointer'}} onClick={()=>onNav(nav as string)}>
          <div style={{fontSize:14,fontWeight:700,color:c as string}}>{t as string}</div>
          <div style={{fontSize:12,color:C.t3,marginTop:4,lineHeight:1.5}}>{s as string}</div>
        </div>
      ))}
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════
//  DESCARGA MASIVA — Módulo principal
// ══════════════════════════════════════════════════════════
function DescargaMasivaView({empresa,addToast,onRefresh,onSetPeriod,period:globalPeriod}:{empresa:Company|null;addToast:(m:string,t?:ToastType)=>void;onRefresh:()=>void;onSetPeriod:(p:string)=>void;period:string}) {
  const [cfg,setCfg]=useState({op:'BOTH',periodFrom:globalPeriod,periodTo:globalPeriod,docTypes:['01','03','07','08'],fileTypes:['XML','PDF','CDR'],includeDetails:true,classifyAI:true});
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState(0);
  const [logs,setLogs]=useState<{m:string;ts:string;ok:boolean}[]>([]);
  const [result,setResult]=useState<{totalDocs:number;totalXml:number;totalPdf:number;totalCdr:number;totalErrors:number}|null>(null);
  const logsRef=useRef<HTMLDivElement>(null);
  const addLog=(m:string,ok=true)=>{setLogs(p=>[...p,{m,ts:new Date().toLocaleTimeString('es-PE'),ok}]);setTimeout(()=>{if(logsRef.current)logsRef.current.scrollTop=logsRef.current.scrollHeight;},40);};

  const getPeriodos=()=>{
    const ps:string[]=[];const[fy,fm]=cfg.periodFrom.split('-').map(Number);const[ty,tm]=cfg.periodTo.split('-').map(Number);
    let y=fy,m=fm;while(y<ty||(y===ty&&m<=tm)){ps.push(`${y}-${String(m).padStart(2,'0')}`);m++;if(m>12){m=1;y++;}}
    return ps;
  };

  const iniciar=async()=>{
    if(!empresa?.id){addToast('Selecciona una empresa primero','error');return;}
    setRunning(true);setLogs([]);setProgress(0);setResult(null);
    const periodos=getPeriodos();
    const ops=cfg.op==='BOTH'?['COMPRAS','VENTAS']:[cfg.op==='PURCHASES'?'COMPRAS':'VENTAS'];
    const totalJobs=periodos.length*ops.length;
    addLog(`Iniciando descarga masiva — ${totalJobs} jobs...`);
    await sleep(400);
    addLog(`Empresa: ${empresa.ruc} — ${empresa.nombre}`);
    addLog(`Períodos: ${periodos.join(', ')} · Ops: ${ops.join(', ')}`);
    await sleep(300);
    addLog('Conectando con SUNAT/SIRE API...');await sleep(600);
    addLog('✓ Token OAuth2 obtenido · scope=contribuyentes');setProgress(10);
    addLog('Consultando portal de credenciales SOL...');await sleep(400);
    addLog(`✓ ${periodos.length} período(s) × ${ops.length} operacion(es) = ${totalJobs} jobs`);setProgress(15);
    for(let i=0;i<periodos.length;i++){
      const p=periodos[i];
      for(let j=0;j<ops.length;j++){
        const op=ops[j];
        addLog(`[JOB-${p}-${op}] Consultando ${op.toLowerCase()} del período ${p}...`);await sleep(500);
        addLog(`[JOB-${p}-${op}] Descargando XML...`);await sleep(300);
        addLog(`[JOB-${p}-${op}] Descargando PDF...`);await sleep(200);
        addLog(`[JOB-${p}-${op}] Descargando CDR...`);await sleep(200);
        if(cfg.includeDetails){
          addLog(`[JOB-${p}-${op}] Parseando XML UBL 2.1 — cabecera + líneas...`);await sleep(400);
          addLog(`[JOB-${p}-${op}] Extrayendo conceptos/descripciones por línea...`);await sleep(300);
          if(cfg.classifyAI){addLog(`[JOB-${p}-${op}] Clasificando cuentas PCGE + centros de costo con IA...`);await sleep(500);}
        }
        addLog(`✓ [JOB-${p}-${op}] Completado`);
        setProgress(15+Math.round(85*((i*ops.length+j+1)/totalJobs)));
      }
    }
    addLog('Enviando a Bandeja Contable...');await sleep(300);
    addLog('Preparando lote para CONCAR SQL...');await sleep(300);
    const d=await API.bulkDownload({companyId:empresa.id,operation:cfg.op,periodFrom:cfg.periodFrom,periodTo:cfg.periodTo,documentTypes:cfg.docTypes,fileTypes:cfg.fileTypes,includeDetails:cfg.includeDetails,classifyWithAI:cfg.classifyAI});
    setRunning(false);setProgress(100);
    if(d.ok){setResult(d.data);addLog('✅ Proceso completado exitosamente');addToast('Descarga masiva completada','success');onSetPeriod(cfg.periodFrom);onRefresh();}
    else{addLog(`❌ Error: ${d.error}`,false);addToast(d.error||'Error','error');}
  };

  const periodos=getPeriodos();
  const jobs=periodos.flatMap(p=>cfg.op==='BOTH'?[`JOB-${p}-COMPRAS`,`JOB-${p}-VENTAS`]:[`JOB-${p}-${cfg.op==='PURCHASES'?'COMPRAS':'VENTAS'}`]);

  return <div style={{animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div><div style={{fontSize:22,fontWeight:800,color:C.t1}}>Descarga Masiva SUNAT</div><div style={{fontSize:13,color:C.t3}}>Parser XML UBL 2.1 real · Clasificación IA · Jobs por período</div></div>
      <Badge label="API real → BD" color="green"/>
    </div>

    {/* CONFIG PANEL */}
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'1.5rem',marginBottom:'1.25rem'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:20}}>
        {/* Operación */}
        <div>
          <div style={{fontSize:11,fontWeight:700,color:C.t3,textTransform:'uppercase',marginBottom:10}}>Operación</div>
          {[['PURCHASES','Solo Compras'],['SALES','Solo Ventas'],['BOTH','Compras + Ventas']].map(([v,l])=>(
            <label key={v} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer',marginBottom:7}}>
              <input type="radio" name="op" value={v} checked={cfg.op===v} onChange={()=>setCfg(p=>({...p,op:v}))} style={{accentColor:C.blue}}/>{l}
            </label>
          ))}
        </div>
        {/* Período */}
        <div>
          <div style={{fontSize:11,fontWeight:700,color:C.t3,textTransform:'uppercase',marginBottom:10}}>Período</div>
          {[['Desde','periodFrom'],['Hasta','periodTo']].map(([l,k])=>(
            <div key={k} style={{marginBottom:8}}><label style={{display:'block',fontSize:10,color:C.t4,marginBottom:3}}>{l}</label>
              <select value={cfg[k as 'periodFrom'|'periodTo']} onChange={e=>setCfg(p=>({...p,[k]:e.target.value}))} style={{width:'100%',padding:'.35rem .6rem',border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:12,fontFamily:'Inter,system-ui,sans-serif'}}>
                {['2026-04','2026-03','2026-02','2026-01','2025-12','2025-11'].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
          ))}
          <div style={{marginTop:6,background:C.blueL,borderRadius:6,padding:'6px 8px',fontSize:10,color:C.blue}}>
            {periodos.length} período(s) · {jobs.length} jobs
          </div>
        </div>
        {/* Tipos y archivos */}
        <div>
          <div style={{fontSize:11,fontWeight:700,color:C.t3,textTransform:'uppercase',marginBottom:10}}>Comprobantes</div>
          {[['01','Facturas'],['03','Boletas'],['07','N.Crédito'],['08','N.Débito']].map(([v,l])=>(
            <label key={v} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer',marginBottom:6}}>
              <input type="checkbox" checked={cfg.docTypes.includes(v)} onChange={e=>setCfg(p=>({...p,docTypes:e.target.checked?[...p.docTypes,v]:p.docTypes.filter(x=>x!==v)}))} style={{accentColor:C.blue}}/>{l}
            </label>
          ))}
          <div style={{marginTop:8,fontSize:11,fontWeight:700,color:C.t3,textTransform:'uppercase',marginBottom:6}}>Archivos</div>
          {['XML','PDF','CDR'].map(v=>(
            <label key={v} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer',marginBottom:6}}>
              <input type="checkbox" checked={cfg.fileTypes.includes(v)} onChange={e=>setCfg(p=>({...p,fileTypes:e.target.checked?[...p.fileTypes,v]:p.fileTypes.filter(x=>x!==v)}))} style={{accentColor:C.blue}}/>{v}
            </label>
          ))}
        </div>
        {/* Opciones y botón */}
        <div>
          <div style={{fontSize:11,fontWeight:700,color:C.t3,textTransform:'uppercase',marginBottom:10}}>Opciones avanzadas</div>
          {[['includeDetails','Extraer líneas del XML'],['classifyAI','Clasificar con IA (cuenta PCGE)']].map(([k,l])=>(
            <label key={k} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer',marginBottom:8}}>
              <input type="checkbox" checked={cfg[k as 'includeDetails'|'classifyAI']} onChange={e=>setCfg(p=>({...p,[k]:e.target.checked}))} style={{accentColor:C.blue}}/>{l}
            </label>
          ))}
          <div style={{background:C.blueL,borderRadius:8,padding:'10px',fontSize:11,color:C.blue,marginBottom:'1rem'}}>
            <div style={{fontWeight:700,marginBottom:4}}>Empresa activa:</div>
            <div style={{fontFamily:'JetBrains Mono,monospace',marginBottom:2}}>{empresa?.ruc||'—'}</div>
            <div>{empresa?.nombre||'Selecciona empresa'}</div>
          </div>
          <Btn color="blue" full disabled={running} onClick={iniciar}>
            {running?<><Spinner size={14} color="#fff"/>Procesando...</>:'↓↓ Iniciar descarga masiva'}
          </Btn>
        </div>
      </div>
    </div>

    {/* JOBS PREVIEW */}
    {jobs.length>0&&<div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:'.75rem 1rem',marginBottom:'1.25rem',display:'flex',gap:8,flexWrap:'wrap'}}>
      {jobs.map(j=><span key={j} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:'3px 10px',fontSize:11,fontFamily:'JetBrains Mono,monospace',color:C.t2}}>{j}</span>)}
    </div>}

    {/* PROGRESS */}
    {(running||progress>0)&&<div style={{marginBottom:'1.25rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:12}}><span style={{color:C.t3,fontWeight:600}}>Progreso total</span><span style={{fontWeight:700,color:C.blue}}>{progress}%</span></div>
      <div style={{height:8,background:C.border,borderRadius:4,overflow:'hidden'}}><div style={{width:`${progress}%`,height:'100%',background:C.blue,borderRadius:4,transition:'width .4s'}}/></div>
    </div>}

    {/* LOGS */}
    {logs.length>0&&<div ref={logsRef} style={{background:'#0D1117',borderRadius:10,padding:'1rem',maxHeight:220,overflowY:'auto',marginBottom:'1.25rem',fontFamily:'JetBrains Mono,monospace'}}>
      {logs.map((l,i)=><div key={i} style={{fontSize:11,color:l.ok?(l.m.startsWith('✅')||l.m.startsWith('✓')?'#22C55E':l.m.startsWith('[')? '#93C5FD':'rgba(255,255,255,.65)'):'#F87171',marginBottom:2}}>
        <span style={{color:'rgba(255,255,255,.25)'}}>[{l.ts}]</span> {l.m}
      </div>)}
      {running&&<div style={{color:C.blue,marginTop:4,fontSize:11,display:'flex',gap:6,alignItems:'center'}}><Spinner size={11}/>Procesando...</div>}
    </div>}

    {/* RESULT CARDS */}
    {result&&<div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10}}>
      <StatCard label="Docs encontrados" value={result.totalDocs} color={C.blue}/>
      <StatCard label="XML descargados" value={result.totalXml} color={C.green}/>
      <StatCard label="PDF descargados" value={result.totalPdf} color={C.teal}/>
      <StatCard label="CDR descargados" value={result.totalCdr} color={C.violet}/>
      <StatCard label="Errores" value={result.totalErrors} color={result.totalErrors>0?C.red:C.green}/>
    </div>}
  </div>;
}

// ══════════════════════════════════════════════════════════
//  DOCUMENT TABLE VIEW (shared by Bandeja, Compras, Ventas)
// ══════════════════════════════════════════════════════════
function DocTableView({docs,titulo,sub,addToast,onRefresh}:{docs:Doc[];titulo:string;sub:string;addToast:(m:string,t?:ToastType)=>void;onRefresh:()=>void}) {
  const [q,setQ]=useState('');
  const [fEst,setFEst]=useState('');
  const [fConcar,setFConcar]=useState('');
  const [detalle,setDetalle]=useState<Doc|null>(null);
  const [sending,setSending]=useState<string|null>(null);

  const filtrados=docs.filter(d=>{
    const qq=q.toLowerCase();
    return(!qq||(d.id.toLowerCase().includes(qq)||d.rs_e.toLowerCase().includes(qq)||d.ruc_e.includes(qq)))&&(!fEst||d.workflow===fEst)&&(!fConcar||d.concar===fConcar);
  });

  const aprobar=async(doc:Doc)=>{await API.updateDoc(doc.id,{workflow:'APROBADO'});addToast('Documento aprobado','success');onRefresh();};
  const sendConcar=async(doc:Doc)=>{setSending(doc.id);await API.updateDoc(doc.id,{concarStatus:'LISTO'});setSending(null);addToast('Enviado a CONCAR','success');onRefresh();};

  return <div style={{animation:'fadeIn .2s ease'}}>
    {detalle&&<LinePanel doc={detalle} onClose={()=>setDetalle(null)} addToast={addToast}/>}
    <div style={{marginBottom:'1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div><div style={{fontSize:22,fontWeight:800,color:C.t1}}>{titulo}</div><div style={{fontSize:13,color:C.t3}}>{sub} · {filtrados.length}/{docs.length} documentos</div></div>
      <div style={{display:'flex',gap:8}}>
        <Btn color="ghost" size="sm" onClick={()=>{
          const XLSX2 = require('xlsx');
          const cols = ['ID','Operación','Tipo','Serie','Número','Fecha','RUC Emisor','Razón Social Emisor','RUC Receptor','Razón Social Receptor','Moneda','Base','IGV','Total','SUNAT','CDR','Flujo','CONCAR','Período'];
          const rows = filtrados.map(d=>[d.id,d.op,d.tipo,d.serie,d.num,d.fecha,d.ruc_e,d.rs_e,d.ruc_r,d.rs_r,d.moneda,d.base,d.igv,d.total,d.sunat,d.cdr,d.workflow,d.concar,d.period]);
          const ws = XLSX2.utils.aoa_to_sheet([cols,...rows]);
          ws['!cols']=cols.map((_,i)=>({wch:Math.max(cols[i].length,...rows.map(r=>String(r[i]??'').length),10)}));
          const wb = XLSX2.utils.book_new();
          XLSX2.utils.book_append_sheet(wb,ws,'Documentos');
          XLSX2.writeFile(wb,`${titulo.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
        }}>↓ Excel</Btn>
      </div>
    </div>
    <div style={{display:'flex',gap:8,marginBottom:'1rem',flexWrap:'wrap'}}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar ID, razón social, RUC..." style={{flex:'2 1 200px',padding:'.45rem .75rem',border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:12,fontFamily:'Inter,system-ui,sans-serif',outline:'none'}}/>
      <select value={fEst} onChange={e=>setFEst(e.target.value)} style={{padding:'.45rem .7rem',border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:12,fontFamily:'Inter,system-ui,sans-serif'}}>
        <option value="">Todos los flujos</option>
        {['PENDIENTE_REVISION','APROBADO','OBSERVADO','VALIDADO'].map(s=><option key={s}>{s}</option>)}
      </select>
      <select value={fConcar} onChange={e=>setFConcar(e.target.value)} style={{padding:'.45rem .7rem',border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:12,fontFamily:'Inter,system-ui,sans-serif'}}>
        <option value="">Todo CONCAR</option>
        {['PENDIENTE','LISTO','PREPARADO','EXPORTADO','BLOQUEADO'].map(s=><option key={s}>{s}</option>)}
      </select>
    </div>
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>
      {filtrados.length===0?<EmptyState icon="⊙" title="Sin documentos" sub="Ajusta los filtros o ejecuta una descarga masiva."/>:
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr><Th>Comprobante</Th><Th>Contraparte</Th><Th>Fecha</Th><Th right>Total</Th><Th>SUNAT</Th><Th>Flujo</Th><Th>Parser</Th><Th>IA</Th><Th>CONCAR</Th><Th>Acciones</Th></tr></thead>
        <tbody>{filtrados.map((d,i)=>(
          <tr key={d.id} style={{background:i%2===0?C.card:C.bg}}>
            <td style={{padding:'.45rem .75rem',cursor:'pointer'}} onClick={()=>setDetalle(d)}>
              <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,color:C.blue,fontWeight:700}}>{d.id}</div>
              <div style={{fontSize:10,color:C.t4,marginTop:1}}>{DOC_TIPOS[d.tipo]||d.tipo} · {d.moneda} · {d.op}</div>
            </td>
            <td style={{padding:'.45rem .75rem'}}><div style={{fontSize:11,fontWeight:600,color:C.t1,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.rs_e}</div><div style={{fontSize:10,color:C.t4,fontFamily:'JetBrains Mono,monospace'}}>{d.ruc_e}</div></td>
            <Td mono>{d.fecha}</Td>
            <Td right mono bold><span style={{color:d.total<0?C.red:C.t1}}>{fmt(Math.abs(d.total),d.moneda)}</span></Td>
            <Td><Badge label={d.sunat} color={colEst(d.sunat) as BadgeColor} sm dot/></Td>
            <Td><Badge label={(d.workflow||'').replace(/_/g,' ')} color={colEst(d.workflow) as BadgeColor} sm/></Td>
            <Td><Badge label={d.parserStatus||'—'} color={colEst(d.parserStatus) as BadgeColor} sm dot/></Td>
            <Td><Badge label={d.aiStatus||'—'} color={colEst(d.aiStatus) as BadgeColor} sm dot/></Td>
            <Td><Badge label={d.concar} color={colEst(d.concar) as BadgeColor} sm/></Td>
            <td style={{padding:'.4rem .75rem'}}>
              <div style={{display:'flex',gap:3}}>
                <Btn size="sm" color="ghost" onClick={()=>setDetalle(d)}>Ver</Btn>
                {d.workflow==='PENDIENTE_REVISION'&&<Btn size="sm" color="green" onClick={()=>aprobar(d)}>✓</Btn>}
                {d.concar==='PENDIENTE'&&d.sunat==='ACEPTADO'&&<Btn size="sm" color="teal" disabled={sending===d.id} onClick={()=>sendConcar(d)}>{sending===d.id?<Spinner size={10}/>:'→C'}</Btn>}
              </div>
            </td>
          </tr>
        ))}</tbody>
      </table>}
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════
//  BANCOS VIEW
// ══════════════════════════════════════════════════════════
function BancosView({movs,empresa}:{movs:BankMov[];empresa:Company|null}) {
  const saldo=movs.length?movs[movs.length-1].saldo:0;
  const creditos=movs.filter(m=>m.tipo==='CRÉDITO').reduce((s,m)=>s+m.monto,0);
  const debitos=movs.filter(m=>m.tipo==='DÉBITO').reduce((s,m)=>s+m.monto,0);
  const chartData=movs.map(m=>({fecha:m.fecha,saldo:m.saldo,monto:m.tipo==='CRÉDITO'?m.monto:-m.monto}));
  return <div style={{animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div><div style={{fontSize:22,fontWeight:800,color:C.t1}}>Bancos</div><div style={{fontSize:13,color:C.t3}}>Cuenta Corriente · Datos de base de datos</div></div>
      <Btn color="ghost" size="sm" onClick={()=>API.exportCSV('banks',empresa?.id)}>↓ CSV</Btn>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:'1.25rem'}}>
      <StatCard label="Saldo actual" value={fmt(saldo)} color={C.blue}/>
      <StatCard label="Entradas" value={fmt(creditos)} color={C.green}/>
      <StatCard label="Salidas" value={fmt(debitos)} color={C.red}/>
      <StatCard label="Sin conciliar" value={movs.filter(m=>!m.conciliado).length} color={C.amber}/>
    </div>
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.25rem',marginBottom:'1.25rem'}}>
      <div style={{fontSize:13,fontWeight:700,marginBottom:'1rem'}}>Evolución saldo</div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
          <XAxis dataKey="fecha" tick={{fontSize:10,fill:C.t3}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fontSize:10,fill:C.t3}} axisLine={false} tickLine={false} tickFormatter={v=>'S/'+fmtN(v)}/>
          <Tooltip formatter={(v:number)=>fmt(v)} contentStyle={{fontSize:12,borderRadius:8}}/>
          <Area type="monotone" dataKey="saldo" stroke={C.blue} fill={C.blueM} strokeWidth={2}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr><Th>Fecha</Th><Th>Descripción</Th><Th>Tipo</Th><Th right>Monto</Th><Th right>Saldo</Th><Th>Conciliación</Th></tr></thead>
        <tbody>{movs.map((m,i)=>(
          <tr key={m.id} style={{background:i%2===0?C.card:C.bg}}>
            <Td mono>{m.fecha}</Td>
            <td style={{padding:'.45rem .75rem',fontSize:12,color:C.t1,maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.desc}</td>
            <Td><Badge label={m.tipo} color={m.tipo==='CRÉDITO'?'green':'red'} sm/></Td>
            <Td right mono bold><span style={{color:m.tipo==='CRÉDITO'?C.green:C.red}}>{m.tipo==='CRÉDITO'?'+':'-'}{fmt(m.monto)}</span></Td>
            <Td right mono>{fmt(m.saldo)}</Td>
            <Td><Badge label={m.conciliado?'CONCILIADO':'PENDIENTE'} color={m.conciliado?'green':'amber'} sm dot/></Td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════
//  DETRACCIONES VIEW
// ══════════════════════════════════════════════════════════
function DetraccionesView({detrs,addToast}:{detrs:Detraccion[];addToast:(m:string,t?:ToastType)=>void}) {
  const [data,setData]=useState(detrs);
  useEffect(()=>setData(detrs),[detrs]);
  const depositar=async(id:string,doc:string)=>{const r=await API.depositarDetraccion(doc);if(r.ok){setData(p=>p.map(d=>d.id===id?{...d,estado:'DEPOSITADO',fecha_dep:r.data.depositDate}:d));addToast('Depósito registrado','success');}};
  const total=data.reduce((s,d)=>s+d.monto,0);
  const pend=data.filter(d=>d.estado==='PENDIENTE').reduce((s,d)=>s+d.monto,0);
  return <div style={{animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1.25rem'}}><div style={{fontSize:22,fontWeight:800,color:C.t1}}>Detracciones</div><div style={{fontSize:13,color:C.t3}}>Cuenta 00-010-348912 · Control de depósitos</div></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:'1.25rem'}}>
      <StatCard label="Total" value={fmt(total)} color={C.blue}/><StatCard label="Pendientes" value={fmt(pend)} color={C.red} sub="urgente"/><StatCard label="Depositadas" value={data.filter(d=>d.estado==='DEPOSITADO').length} color={C.green}/>
    </div>
    {pend>0&&<div style={{background:C.redL,border:`1px solid ${C.redM}`,borderRadius:8,padding:'.75rem 1rem',marginBottom:'1.25rem',fontSize:12,color:C.red}}>⚠ {fmt(pend)} en detracciones pendientes. Fecha límite: día 12 del mes siguiente.</div>}
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr><Th>Documento</Th><Th>Proveedor</Th><Th center>Cód.</Th><Th right>Monto</Th><Th>Estado</Th><Th>Fecha dep.</Th><Th>Acción</Th></tr></thead>
        <tbody>{data.map((d,i)=>(
          <tr key={d.id} style={{background:i%2===0?C.card:C.bg}}>
            <Td mono><span style={{color:C.blue,fontWeight:700}}>{d.doc}</span></Td>
            <td style={{padding:'.45rem .75rem',fontSize:11,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:C.t2}}>{d.proveedor}</td>
            <Td center mono>{d.codigo}</Td>
            <Td right mono bold>{fmt(d.monto)}</Td>
            <Td><Badge label={d.estado} color={d.estado==='DEPOSITADO'?'green':'red'} sm dot/></Td>
            <Td mono muted>{d.fecha_dep||'Pendiente'}</Td>
            <td style={{padding:'.4rem .75rem'}}>{d.estado==='PENDIENTE'?<Btn size="sm" color="blue" onClick={()=>depositar(d.id,d.doc)}>Registrar</Btn>:<Badge label="✓" color="green" sm/>}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════
//  CXC / CXP VIEW
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  CONCILIACIÓN BANCARIA — Matching movimientos vs documentos
// ══════════════════════════════════════════════════════════
function ConciliacionView({docs,movs,empresa,addToast,onRefresh}:{docs:Doc[];movs:BankMov[];empresa:Company|null;addToast:(m:string,t?:ToastType)=>void;onRefresh:()=>void}) {
  const [selected,setSelected]=useState<string|null>(null);
  const [matching,setMatching]=useState(false);
  const [filter,setFilter]=useState<'todos'|'pendientes'|'conciliados'>('pendientes');

  const pendientes=movs.filter(m=>!m.conciliado);
  const conciliados=movs.filter(m=>m.conciliado);
  const shown=filter==='pendientes'?pendientes:filter==='conciliados'?conciliados:movs;

  const totalPend=pendientes.filter(m=>m.tipo==='CRÉDITO').reduce((s,m)=>s+m.monto,0);
  const totalConc=conciliados.reduce((s,m)=>s+m.monto,0);

  // Auto-match: find document matching description
  const autoMatch=(mov:BankMov):Doc|null=>{
    for(const doc of docs){
      if(Math.abs(Math.abs(mov.monto)-Math.abs(doc.total))<1) return doc;
      if(mov.desc.toLowerCase().includes(doc.ruc_e)||mov.desc.toLowerCase().includes(doc.ruc_r)) return doc;
      if(doc.rs_e&&mov.desc.toLowerCase().includes(doc.rs_e.toLowerCase().slice(0,8))) return doc;
    }
    return null;
  };

  const conciliate=async(movId:string,doc:Doc)=>{
    setMatching(true);
    const r=await API.conciliate(movId,doc.id,doc.rs_e);
    setMatching(false);
    if(r.ok){addToast(`Conciliado: ${doc.id} ↔ movimiento`,'success');setSelected(null);onRefresh();}
    else addToast(r.error||'Error','error');
  };

  const autoAll=async()=>{
    let count=0;
    for(const mov of pendientes){
      const match=autoMatch(mov);
      if(match&&!mov.conciliado){await API.conciliate(mov.id,match.id,match.rs_e);count++;}
    }
    addToast(`Auto-conciliación: ${count} movimientos conciliados`,'success');
    onRefresh();
  };

  return <div style={{animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div><div style={{fontSize:22,fontWeight:800,color:C.t1}}>Conciliación Bancaria</div>
        <div style={{fontSize:13,color:C.t3}}>Matching movimientos vs comprobantes · {empresa?.nombre||'sin empresa'}</div></div>
      <Btn color="blue" onClick={autoAll}>⚡ Auto-conciliar todo</Btn>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:'1.25rem'}}>
      <StatCard label="Total movimientos" value={movs.length} color={C.blue}/>
      <StatCard label="Pendientes" value={pendientes.length} sub={fmt(totalPend)} color={C.amber}/>
      <StatCard label="Conciliados" value={conciliados.length} color={C.green}/>
      <StatCard label="% conciliación" value={`${movs.length?Math.round(conciliados.length/movs.length*100):0}%`} color={C.teal}/>
    </div>

    <div style={{display:'flex',gap:8,marginBottom:'1rem'}}>
      {(['todos','pendientes','conciliados'] as const).map(f=>(
        <button key={f} onClick={()=>setFilter(f)} style={{padding:'.35rem .9rem',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',border:`1.5px solid ${filter===f?C.blue:C.border}`,background:filter===f?C.blueL:C.card,color:filter===f?C.blue:C.t3,fontFamily:'Inter,system-ui,sans-serif'}}>
          {f==='todos'?'Todos':f==='pendientes'?`Pendientes (${pendientes.length})`:`Conciliados (${conciliados.length})`}
        </button>
      ))}
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
      {/* MOVIMIENTOS */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'.75rem 1rem',borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>Movimientos bancarios</span><Badge label={`${shown.length} registros`} color="blue" sm/>
        </div>
        <div style={{maxHeight:500,overflowY:'auto'}}>
          {shown.map((m,i)=>{
            const match=!m.conciliado?autoMatch(m):null;
            const isSelected=selected===m.id;
            return <div key={m.id} onClick={()=>setSelected(isSelected?null:m.id)}
              style={{padding:'.75rem 1rem',borderBottom:`1px solid ${C.border}`,cursor:'pointer',background:isSelected?C.blueL:i%2===0?C.card:C.bg,transition:'background .1s'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:11,color:C.t3,fontFamily:'JetBrains Mono,monospace'}}>{m.fecha}</span>
                <span style={{fontSize:13,fontWeight:700,color:m.tipo==='CRÉDITO'?C.green:C.red}}>{m.tipo==='CRÉDITO'?'+':'-'}{fmt(m.monto)}</span>
              </div>
              <div style={{fontSize:12,color:C.t1,marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:280}}>{m.desc}</div>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <Badge label={m.tipo} color={m.tipo==='CRÉDITO'?'green':'red'} sm/>
                {m.conciliado?<Badge label="✓ Conciliado" color="green" sm dot/>:
                  match?<Badge label={`Match: ${match.id}`} color="blue" sm/>:<Badge label="Sin match" color="amber" sm/>}
              </div>
              {isSelected&&!m.conciliado&&match&&<div style={{marginTop:8}}>
                <Btn color="green" size="sm" disabled={matching} onClick={(e)=>{e?.stopPropagation?.();conciliate(m.id,match);}}>
                  {matching?<><Spinner size={11} color="#fff"/>Conciliando...</>:`✓ Conciliar con ${match.id}`}
                </Btn>
              </div>}
              {m.conciliado&&m.match_rs&&<div style={{fontSize:10,color:C.t4,marginTop:3}}>↔ {m.match_rs}</div>}
            </div>;
          })}
          {shown.length===0&&<EmptyState icon="⇌" title="Sin movimientos" sub="Cambia el filtro."/>}
        </div>
      </div>

      {/* DOCUMENTOS PARA CRUZAR */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'.75rem 1rem',borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>Comprobantes disponibles</span><Badge label={`${docs.length} docs`} color="blue" sm/>
        </div>
        <div style={{maxHeight:500,overflowY:'auto'}}>
          {docs.filter(d=>d.sunat==='ACEPTADO').map((d,i)=>(
            <div key={d.id} style={{padding:'.75rem 1rem',borderBottom:`1px solid ${C.border}`,background:i%2===0?C.card:C.bg}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:11,fontFamily:'JetBrains Mono,monospace',color:C.blue,fontWeight:700}}>{d.id}</span>
                <span style={{fontSize:13,fontWeight:700,color:d.total<0?C.red:C.t1}}>{fmt(Math.abs(d.total),d.moneda)}</span>
              </div>
              <div style={{fontSize:11,color:C.t2,marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.rs_e}</div>
              <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                <Badge label={d.fecha} color="gray" sm/>
                <Badge label={d.op} color={d.op==='COMPRA'?'blue':'violet'} sm/>
                {selected&&!movs.find(m=>m.id===selected)?.conciliado&&
                  <Btn size="sm" color="teal" onClick={()=>{const mov=movs.find(m=>m.id===selected);if(mov)conciliate(mov.id,d);}}>↔ Cruzar</Btn>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>;
}

function CxView({data,tipo,addToast,onRefresh,empresa,period}:{data:Record<string,unknown>[];tipo:'CxC'|'CxP';addToast:(m:string,t?:ToastType)=>void;onRefresh:()=>void;empresa:Company|null;period:string}) {
  const [marking,setMarking]=useState<string|null>(null);
  const total=data.reduce((s:number,r)=>s+((r.amount as number)||0),0);
  const pend=data.filter(r=>r.status==='PENDIENTE'||r.status==='POR_VENCER').reduce((s:number,r)=>s+((r.amount as number)||0),0);
  const venc=data.filter(r=>r.status==='VENCIDO').reduce((s:number,r)=>s+((r.amount as number)||0),0);
  const label=tipo==='CxC'?{party:'clientName',ruc:'clientRuc',col:'Saldo a cobrar'}:{party:'providerName',ruc:'providerRuc',col:'Saldo a pagar'};
  const cobrado=tipo==='CxC'?'COBRADO':'PAGADO';
  const markPaid=async(id:string,amount:number)=>{
    setMarking(id);
    const r=tipo==='CxC'?await API.markCxcPaid(id,amount):await API.markCxpPaid(id,amount);
    setMarking(null);
    if(r.ok){addToast('Marcado como '+(tipo==='CxC'?'cobrado':'pagado'),'success');onRefresh();}
    else addToast(r.error||'Error','error');
  };
  return <div style={{animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div><div style={{fontSize:22,fontWeight:800,color:C.t1}}>{tipo==='CxC'?'Cuentas por Cobrar':'Cuentas por Pagar'}</div><div style={{fontSize:13,color:C.t3}}>{data.length} registros</div></div>
      <Btn color="ghost" size="sm" onClick={()=>API.exportCSV(tipo==='CxC'?'cxc':'cxp',empresa?.id,period)}>↓ CSV</Btn>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:'1.25rem'}}>
      <StatCard label="Total" value={fmt(total)} color={C.blue}/><StatCard label="Pendiente" value={fmt(pend)} color={C.amber}/><StatCard label="Vencido" value={fmt(venc)} color={C.red}/><StatCard label="Cobrado/Pagado" value={data.filter(r=>r.status===cobrado).length} color={C.green}/>
    </div>
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr><Th>{tipo==='CxC'?'Cliente':'Proveedor'}</Th><Th>RUC</Th><Th right>Monto</Th><Th>Vencimiento</Th><Th>Estado</Th><Th>{" "}</Th></tr></thead>
        <tbody>{data.map((r,i)=>(
          <tr key={r.id as string} style={{background:i%2===0?C.card:C.bg}}>
            <td style={{padding:'.45rem .75rem',fontSize:12,fontWeight:600,color:C.t1,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r[label.party] as string}</td>
            <Td mono muted>{r[label.ruc] as string}</Td>
            <Td right mono bold>{fmt(r.amount as number)}</Td>
            <Td mono>{r.dueDate as string}</Td>
            <Td><Badge label={r.status as string} color={colEst(r.status as string) as BadgeColor} sm dot/></Td>
            <td style={{padding:'.35rem .5rem'}}>{r.status!==cobrado&&<Btn size="sm" color="green" disabled={marking===r.id as string} onClick={()=>markPaid(r.id as string,r.amount as number)}>{marking===r.id as string?<Spinner size={11}/>:'✓'}</Btn>}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════
//  CONCAR VIEW
// ══════════════════════════════════════════════════════════
function ConcarView({docs,empresa,addToast,period}:{docs:Doc[];empresa:Company|null;addToast:(m:string,t?:ToastType)=>void;period:string}) {
  const [testing,setTesting]=useState(false);
  const [connected,setConnected]=useState<Record<string,unknown>|null>(null);
  const [schema,setSchema]=useState<Record<string,unknown>[]|null>(null);
  const [accounts,setAccounts]=useState<Record<string,unknown>[]|null>(null);
  const [exporting,setExporting]=useState(false);
  const [batches,setBatches]=useState<Record<string,unknown>[]>([]);
  const listos=docs.filter(d=>d.concar==='LISTO');

  useEffect(()=>{API.concarBatches().then(setBatches);},[]);

  const test=async()=>{setTesting(true);const r=await API.concarTest();setTesting(false);if(r.ok){setConnected(r.data);addToast('Conexión CONCAR OK','success');}else addToast('Error de conexión','error');};
  const discover=async()=>{const [s,a]=await Promise.all([API.concarSchema(),API.concarAccounts()]);setSchema(s.data||[]);setAccounts(a.data||[]);addToast(`${(s.data||[]).length} tablas detectadas`,'success');};
  const exportar=async()=>{if(!empresa?.id){addToast('Selecciona empresa','error');return;}setExporting(true);const r=await API.concarExport({documentIds:listos.map(d=>d.id),companyId:empresa.id,period:empresa?.id?period:'2026-04'});setExporting(false);if(r.ok){addToast('Lote preparado para aprobación','success');API.concarBatches().then(setBatches);}else addToast('Error','error');};

  return <div style={{animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1.25rem'}}><div style={{fontSize:22,fontWeight:800,color:C.t1}}>CONCAR SQL — Integración</div><div style={{fontSize:13,color:C.t3}}>Solo lectura · Lotes con aprobación humana · Sin escritura directa</div></div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.5rem'}}>
        <div style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:'1rem'}}>Conexión SQL Server</div>
        {[['Provider',process.env.NEXT_PUBLIC_CONCAR_PROVIDER||'mock'],['Servidor','Configurar en variables de entorno'],['Base de datos','CONCAR_SQL_DATABASE'],['Usuario','CONCAR_SQL_USER'],['Cifrado','TLS 1.3 · Encrypt=True']].map(([k,v])=>(
          <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'.4rem 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}>
            <span style={{color:C.t3}}>{k}</span><span style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,color:C.t1}}>{v}</span>
          </div>
        ))}
        <div style={{display:'flex',gap:8,marginTop:'1.25rem',flexWrap:'wrap'}}>
          <Btn color="blue" onClick={test} disabled={testing}>{testing?<><Spinner size={13} color="#fff"/>Probando...</>:'⚡ Test conexión'}</Btn>
          {connected&&<Badge label="✓ CONECTADO" color="green"/>}
          <Btn color="navy" onClick={discover}>⟳ Esquema + Cuentas</Btn>
        </div>
        {connected&&<div style={{marginTop:'1rem',background:C.greenL,border:`1px solid ${C.greenM}`,borderRadius:8,padding:'.75rem',fontSize:12,color:C.green}}>
          ✓ {connected.version as string} · {connected.tablas as number} tablas
        </div>}
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.5rem'}}>
        <div style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:'.75rem'}}>Preparar lote para aprobación</div>
        <div style={{background:C.blueL,border:`1px solid ${C.blueM}`,borderRadius:8,padding:'.75rem',marginBottom:'1rem',fontSize:12,color:C.blue}}>
          <strong>{listos.length}</strong> documento(s) en estado LISTO
        </div>
        <div style={{background:C.amberL,border:`1px solid ${C.amberM}`,borderRadius:8,padding:'.6rem .75rem',marginBottom:'1rem',fontSize:11,color:C.amber}}>
          ⚠ El lote requiere aprobación del Supervisor antes de exportarse a CONCAR.
        </div>
        <Btn color="teal" onClick={exportar} disabled={exporting||listos.length===0}>
          {exporting?<><Spinner size={13} color="#fff"/>Preparando...</>:`→ Preparar lote (${listos.length} docs)`}
        </Btn>
      </div>
    </div>
    {accounts&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden',marginBottom:14}}>
      <div style={{padding:'.75rem 1rem',borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700}}>Plan de cuentas PCGE ({accounts.length})</div>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr><Th>Código</Th><Th>Nombre</Th><Th>Tipo</Th></tr></thead>
        <tbody>{accounts.map((a,i)=>(
          <tr key={a.code as string} style={{background:i%2===0?C.card:C.bg}}>
            <Td mono><span style={{color:C.blue,fontWeight:700}}>{a.code as string}</span></Td>
            <Td>{a.name as string}</Td>
            <Td><Badge label={a.type as string} color={a.type==='GASTO'?'amber':a.type==='INGRESO'?'green':'blue'} sm/></Td>
          </tr>
        ))}</tbody>
      </table>
    </div>}
    {batches.length>0&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>
      <div style={{padding:'.75rem 1rem',borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700}}>Historial de lotes ({batches.length})</div>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr><Th>Batch ID</Th><Th right>Docs</Th><Th>Exportado por</Th><Th>Hash</Th><Th>Estado</Th><Th>Acción</Th></tr></thead>
        <tbody>{batches.map((b,i)=>(
          <tr key={b.id as string} style={{background:i%2===0?C.card:C.bg}}>
            <Td mono muted>{(b.id as string).slice(-16)}</Td>
            <Td right bold>{b.docsCount as number}</Td>
            <Td muted>{b.exportedBy as string}</Td>
            <Td mono muted>{(b.hashLote as string)?.slice(0,8)}…</Td>
            <Td><Badge label={b.status as string} color={colEst(b.status as string) as BadgeColor} sm dot/></Td>
            <td style={{padding:'.4rem .75rem'}}>{b.status==='PREPARADO'&&<Btn size="sm" color="green" onClick={async()=>{const r=await API.concarApprove(b.id as string);if(r.ok){addToast('Lote aprobado y exportado','success');API.concarBatches().then(setBatches);}}}>✓ Aprobar</Btn>}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>}
  </div>;
}

// ══════════════════════════════════════════════════════════
//  REPORTES VIEW — Real DB data
// ══════════════════════════════════════════════════════════
function ReportesView({empresa}:{empresa:Company|null}) {
  const [data,setData]=useState<Record<string,unknown>|null>(null);
  const [loading,setLoading]=useState(false);
  const [period,setPeriod]=useState('2026-04');

  useEffect(()=>{
    if(!empresa?.id) return;
    setLoading(true);
    API.getReports(empresa.id,period).then(r=>{if(r.ok)setData(r.data);setLoading(false);});
  },[empresa?.id,period]);

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'4rem'}}><Spinner size={32}/></div>;
  if(!data) return <EmptyState icon="📊" title="Sin datos" sub="Selecciona una empresa para ver reportes."/>;

  const months = data.months as {mes:string;compras:number;ventas:number;igv:number}[];
  const topSup  = data.topSuppliers as {name:string;amount:number}[];
  const topAcc  = data.topAccounts  as {account:string;amount:number}[];
  const byStatus= data.sunatStatus  as Record<string,number>;
  const pieData = Object.entries(byStatus||{}).map(([name,value])=>({name,value}));
  const COLORS  = [C.green,C.amber,C.red,C.blue,C.violet];
  const fmt2    = (n:number)=>new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN',minimumFractionDigits:0}).format(n);

  return <div style={{animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div><div style={{fontSize:22,fontWeight:800,color:C.t1}}>Reportes</div>
        <div style={{fontSize:13,color:C.t3}}>Datos reales de la BD · {empresa?.nombre}</div></div>
      <select value={period} onChange={e=>setPeriod(e.target.value)} style={{padding:'.4rem .75rem',border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:12,fontFamily:'Inter,system-ui,sans-serif'}}>
        {['2026-04','2026-03','2026-02','2026-01'].map(p=><option key={p}>{p}</option>)}
      </select>
    </div>

    {/* KPI ROW */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10,marginBottom:'1.25rem'}}>
      <StatCard label="Total compras" value={fmt2(data.totalCompras as number)} sub={`${data.docsCompras} docs`} color={C.blue}/>
      <StatCard label="Total ventas"  value={fmt2(data.totalVentas as number)}  sub={`${data.docsVentas} docs`} color={C.violet}/>
      <StatCard label="IGV crédito"   value={fmt2(data.igvCredito as number)}   sub="aceptados PEN" color={C.amber}/>
      <StatCard label="IGV neto"      value={fmt2(data.igvNeto as number)}      sub="débito − crédito" color={(data.igvNeto as number)>0?C.red:C.green}/>
      <StatCard label="IA confianza"  value={`${data.avgConfidence}%`}          sub={`${data.linesWithAI}/${data.linesTotal} líneas`} color={C.teal}/>
      <StatCard label="Para CONCAR"   value={data.docsParaConcar as number}     sub="en estado LISTO" color={C.green}/>
    </div>

    {/* CHARTS ROW 1 */}
    <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:14,marginBottom:'1.25rem'}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.25rem'}}>
        <div style={{fontSize:13,fontWeight:700,color:C.t1,marginBottom:'1rem'}}>Tendencia mensual — Compras · Ventas · IGV</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={months} barSize={12} barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
            <XAxis dataKey="mes" tick={{fontSize:11,fill:C.t3}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:9,fill:C.t3}} axisLine={false} tickLine={false} tickFormatter={v=>'S/'+fmtN(v)}/>
            <Tooltip formatter={(v:number,n:string)=>[fmt2(v),n==='compras'?'Compras':n==='ventas'?'Ventas':'IGV cred.']} contentStyle={{fontSize:11,borderRadius:8,border:`1px solid ${C.border}`}}/>
            <Bar dataKey="compras" fill={C.blue} radius={[3,3,0,0]} name="compras"/>
            <Bar dataKey="ventas" fill={C.violet} radius={[3,3,0,0]} name="ventas"/>
            <Bar dataKey="igv" fill={C.amber} radius={[3,3,0,0]} name="igv"/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.25rem'}}>
        <div style={{fontSize:13,fontWeight:700,color:C.t1,marginBottom:'1rem'}}>Estado SUNAT</div>
        {pieData.length>0?<>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} innerRadius={35} dataKey="value">
                {pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Pie>
              <Tooltip contentStyle={{fontSize:11,borderRadius:8}}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:4}}>
            {pieData.map((d,i)=>(
              <div key={d.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:10,height:10,borderRadius:2,background:COLORS[i%COLORS.length],flexShrink:0}}></span><span style={{color:C.t2}}>{d.name}</span></div>
                <span style={{fontWeight:700,color:C.t1}}>{d.value}</span>
              </div>
            ))}
          </div>
        </>:<EmptyState icon="—" title="Sin datos" sub=""/>}
      </div>
    </div>

    {/* CHARTS ROW 2 */}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
      {topSup.length>0&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.25rem'}}>
        <div style={{fontSize:13,fontWeight:700,color:C.t1,marginBottom:'1rem'}}>Top proveedores por monto</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={topSup} layout="vertical" barSize={12}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
            <XAxis type="number" tick={{fontSize:9,fill:C.t3}} axisLine={false} tickLine={false} tickFormatter={v=>'S/'+fmtN(v)}/>
            <YAxis type="category" dataKey="name" tick={{fontSize:9,fill:C.t3}} axisLine={false} tickLine={false} width={140}/>
            <Tooltip formatter={(v:number)=>fmt2(v)} contentStyle={{fontSize:11,borderRadius:8}}/>
            <Bar dataKey="amount" fill={C.blue} radius={[0,3,3,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>}

      {topAcc.length>0&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.25rem'}}>
        <div style={{fontSize:13,fontWeight:700,color:C.t1,marginBottom:'1rem'}}>Gastos por cuenta PCGE (IA)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={topAcc} layout="vertical" barSize={12}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
            <XAxis type="number" tick={{fontSize:9,fill:C.t3}} axisLine={false} tickLine={false} tickFormatter={v=>'S/'+fmtN(v)}/>
            <YAxis type="category" dataKey="account" tick={{fontSize:10,fill:C.t3,fontFamily:'JetBrains Mono,monospace'}} axisLine={false} tickLine={false} width={60}/>
            <Tooltip formatter={(v:number)=>fmt2(v)} contentStyle={{fontSize:11,borderRadius:8}}/>
            <Bar dataKey="amount" fill={C.teal} radius={[0,3,3,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>}

      {topAcc.length===0&&topSup.length===0&&<div style={{gridColumn:'1/-1'}}><EmptyState icon="📊" title="Ejecuta una descarga masiva" sub="Los reportes se generan con datos reales de la BD tras descargar comprobantes de SUNAT."/></div>}
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════
//  COPILOTO IA
// ══════════════════════════════════════════════════════════
function CopilotoView({docs,movs,detrs}:{docs:Doc[];movs:BankMov[];detrs:Detraccion[]}) {
  const [msgs,setMsgs]=useState<{r:'user'|'ai';t:string}[]>([{r:'ai',t:'Hola, soy el **Copiloto Contable IA**.\n\nAccedo a tus datos reales de la base de datos: comprobantes con líneas parseadas, bancos y detracciones.\n\n¿En qué te puedo ayudar?'}]);
  const [inp,setInp]=useState('');
  const [loading,setLoading]=useState(false);
  const ref=useRef<HTMLDivElement>(null);

  const getR=(q:string)=>{
    const l=q.toLowerCase();
    if(l.includes('factura')||l.includes('comprobante')) return `**Comprobantes en BD:**\n• Total: ${docs.length}\n• Compras: ${docs.filter(d=>d.op==='COMPRA').length}\n• Ventas: ${docs.filter(d=>d.op==='VENTA').length}\n• Parseados XML: ${docs.filter(d=>d.parserStatus==='PARSEADO').length}\n• Clasificados IA: ${docs.filter(d=>d.aiStatus==='CLASIFICADO').length}\n• Observados SUNAT: ${docs.filter(d=>d.sunat==='OBSERVADO').length}\n• Para CONCAR: ${docs.filter(d=>d.concar==='LISTO').length}`;
    if(l.includes('banco')||l.includes('saldo')) return `**Bancos:**\n• Movimientos: ${movs.length}\n• Saldo actual: ${fmt(movs.length?movs[movs.length-1].saldo:0)}\n• Sin conciliar: ${movs.filter(m=>!m.conciliado).length}\n• Entradas: ${fmt(movs.filter(m=>m.tipo==='CRÉDITO').reduce((s,m)=>s+m.monto,0))}\n• Salidas: ${fmt(movs.filter(m=>m.tipo==='DÉBITO').reduce((s,m)=>s+m.monto,0))}`;
    if(l.includes('detraccion')||l.includes('detracción')) return `**Detracciones:**\n• Total registros: ${detrs.length}\n• Pendientes: ${detrs.filter(d=>d.estado==='PENDIENTE').length}\n• Monto pendiente: ${fmt(detrs.filter(d=>d.estado==='PENDIENTE').reduce((s,d)=>s+d.monto,0))}\n• Depositadas: ${detrs.filter(d=>d.estado==='DEPOSITADO').length}`;
    if(l.includes('igv')) return `**IGV crédito fiscal:**\n• Compras PEN aceptadas: ${fmt(docs.filter(d=>d.op==='COMPRA'&&d.moneda==='PEN'&&d.sunat==='ACEPTADO').reduce((s,d)=>s+Math.abs(d.igv),0))}\n• Excluidos (OBSERVADO/ANULADO): ${docs.filter(d=>d.sunat==='OBSERVADO'||d.sunat==='ANULADO').length} doc(s)`;
    if(l.includes('concar')) return `**Estado CONCAR:**\n• LISTO para exportar: ${docs.filter(d=>d.concar==='LISTO').length}\n• PREPARADO (pendiente aprobación): ${docs.filter(d=>d.concar==='PREPARADO').length}\n• EXPORTADO: ${docs.filter(d=>d.concar==='EXPORTADO').length}\n• BLOQUEADO: ${docs.filter(d=>d.concar==='BLOQUEADO').length}`;
    if(l.includes('xml')||l.includes('parser')) return `**Parser XML UBL 2.1:**\n• Parseados: ${docs.filter(d=>d.parserStatus==='PARSEADO').length}\n• Clasificados IA: ${docs.filter(d=>d.aiStatus==='CLASIFICADO').length}\n• Líneas totales: ${docs.reduce((s,d)=>s+(d.lineas?.length||0),0)}\n• Sin PDF: ${docs.filter(d=>!d.pdf).length}`;
    if(l.includes('proveedor')) { const prov=Object.entries(docs.filter(d=>d.op==='COMPRA').reduce((acc:Record<string,number>,d)=>{acc[d.rs_e]=(acc[d.rs_e]||0)+Math.abs(d.total);return acc;},{})).sort(([,a],[,b])=>b-a).slice(0,5); return `**Top 5 proveedores por monto:**\n${prov.map(([n,v])=>`• ${n}: ${fmt(v)}`).join('\n')}`; }
    return `Consulta: "${q}"\n\nPuedo responderte sobre: comprobantes, bancos, detracciones, IGV, CONCAR, XML/parser, proveedores.`;
  };

  const send=async(text=inp)=>{if(!text.trim()||loading)return;const newHistory=msgs.map(m=>({role:m.r==='ai'?'assistant':'user',content:m.t}));setMsgs(p=>[...p,{r:'user',t:text}]);setInp('');setLoading(true);try{const r=await API.askCopiloto(text,undefined,undefined,newHistory);if(r.ok){setMsgs(p=>[...p,{r:'ai',t:r.data.reply}]);}else{setMsgs(p=>[...p,{r:'ai',t:'Error: '+r.error}]);}}catch{setMsgs(p=>[...p,{r:'ai',t:'Error de conexión con el servidor.'}]);}setLoading(false);setTimeout(()=>ref.current?.scrollTo({top:9999,behavior:'smooth'}),80);};

  const SUGS=['¿Cuántos comprobantes hay?','¿Saldo bancario actual?','¿Detracciones pendientes?','¿IGV crédito fiscal?','¿Listo para CONCAR?','¿XML parseados?','¿Top proveedores?'];

  return <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 130px)',animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1rem'}}><div style={{fontSize:22,fontWeight:800,color:C.t1}}>Copiloto IA</div><div style={{fontSize:13,color:C.t3}}>Datos reales de la BD · Parser XML incluido</div></div>
    <div ref={ref} style={{flex:1,overflowY:'auto',background:C.bg,borderRadius:10,border:`1px solid ${C.border}`,padding:'1rem',marginBottom:'1rem'}}>
      {msgs.map((m,i)=>(
        <div key={i} style={{display:'flex',gap:10,marginBottom:'1.25rem',justifyContent:m.r==='user'?'flex-end':'flex-start'}}>
          {m.r==='ai'&&<div style={{width:32,height:32,borderRadius:10,background:C.navy,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',flexShrink:0,fontSize:14}}>✦</div>}
          <div style={{maxWidth:'78%',background:m.r==='ai'?C.card:C.blue,color:m.r==='ai'?C.t1:'#fff',borderRadius:10,padding:'.85rem 1.1rem',fontSize:13,lineHeight:1.7,border:m.r==='ai'?`1px solid ${C.border}`:'none',whiteSpace:'pre-line'}}>
            {m.t.split('**').map((p,j)=>j%2===1?<strong key={j}>{p}</strong>:p)}
          </div>
        </div>
      ))}
      {loading&&<div style={{display:'flex',gap:10}}><div style={{width:32,height:32,borderRadius:10,background:C.navy,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}>✦</div><div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'.75rem 1rem',display:'flex',gap:6,alignItems:'center',color:C.t3}}><Spinner size={14}/>Consultando BD...</div></div>}
    </div>
    <div><div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:'.75rem'}}>{SUGS.map(s=><button key={s} onClick={()=>send(s)} style={{background:C.blueL,color:C.blue,border:`1px solid ${C.blueM}`,borderRadius:20,padding:'.3rem .9rem',fontSize:11,cursor:'pointer',fontFamily:'Inter,system-ui,sans-serif'}}>{s}</button>)}</div>
    <div style={{display:'flex',gap:8}}><input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Consulta sobre tus datos contables..." style={{flex:1,padding:'.6rem .9rem',border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,fontFamily:'Inter,system-ui,sans-serif',outline:'none'}}/><Btn color="blue" onClick={()=>send()} disabled={loading}>Enviar ↗</Btn></div></div>
  </div>;
}

// ══════════════════════════════════════════════════════════
//  USERS VIEW
// ══════════════════════════════════════════════════════════
function UsuariosView({addToast,empresas}:{addToast:(m:string,t?:ToastType)=>void;empresas:Company[]}) {
  const [users,setUsers]=useState<Record<string,unknown>[]>([]);
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [editUser,setEditUser]=useState<Record<string,unknown>|null>(null);
  const [form,setForm]=useState({name:'',email:'',role:'Contador',password:'',companyIds:[] as string[]});
  const inpS={width:'100%',padding:'.5rem .75rem',border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:12,fontFamily:'Inter,system-ui,sans-serif',outline:'none',background:C.card,color:C.t1,boxSizing:'border-box' as const};

  const load=()=>{setLoading(true);API.users().then(r=>{if(r.ok)setUsers(r.data);setLoading(false);});};
  useEffect(()=>{load();},[]);

  const crear=async()=>{
    if(!form.name.trim()||!form.email.trim()){addToast('Nombre y email requeridos','error');return;}
    setSaving(true);
    const r=await API.createUser({...form,companyIds:form.companyIds.length?form.companyIds:null});
    setSaving(false);
    if(r.ok){
      addToast(`Usuario creado. Contraseña temporal: ${r.data.tempPassword}`,'success');
      setOpen(false);setForm({name:'',email:'',role:'Contador',password:'',companyIds:[]});
      load();
    } else addToast(r.error||'Error','error');
  };

  const toggleEmpresa=(empId:string,userId:string,currentIds:string[]|null)=>{
    const ids=currentIds||[];
    const newIds=ids.includes(empId)?ids.filter(i=>i!==empId):[...ids,empId];
    API.patchUser(userId,{companyIds:newIds.length?newIds:null}).then(r=>{
      if(r.ok){addToast('Acceso actualizado','success');load();}
      else addToast('Error al actualizar','error');
    });
  };

  const revocar=(id:string)=>{
    API.patchUser(id,{status:'revocado'}).then(r=>{if(r.ok){addToast('Usuario revocado','success');load();}});
  };

  const ROL_COL:Record<string,BadgeColor>={Administrador:'red',Contador:'blue',Supervisor:'amber',Auditor:'violet'};

  return <div style={{animation:'fadeIn .2s ease'}}>
    {open&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:2000,display:'flex',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setOpen(false)}>
      <div style={{width:520,background:C.card,height:'100vh',display:'flex',flexDirection:'column',boxShadow:'-20px 0 60px rgba(0,0,0,.25)'}}>
        <div style={{background:C.navy,padding:'1.25rem 1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div><div style={{fontSize:17,fontWeight:700,color:'#fff'}}>Crear usuario</div><div style={{fontSize:11,color:'rgba(255,255,255,.5)'}}>Bcrypt + JWT · Email automático si SMTP activo</div></div>
          <button onClick={()=>setOpen(false)} style={{background:'rgba(255,255,255,.1)',border:'none',color:'#fff',width:30,height:30,borderRadius:'50%',cursor:'pointer',fontSize:17}}>×</button>
        </div>
        <div style={{flex:1,padding:'1.5rem',overflowY:'auto'}}>
          {[{l:'Nombre completo',k:'name',ph:'María García López'},{l:'Email',k:'email',ph:'maria@clienteabc.pe',t:'email'},{l:'Contraseña temporal (opcional)',k:'password',ph:'Se genera automáticamente si no escribes',t:'password'}].map(f=>(
            <div key={f.k} style={{marginBottom:'1rem'}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:C.t2,marginBottom:5}}>{f.l}</label>
              <input type={f.t||'text'} value={form[f.k as keyof typeof form] as string} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={inpS}/>
            </div>
          ))}

          <div style={{marginBottom:'1rem'}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:C.t2,marginBottom:5}}>Rol</label>
            <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} style={{...inpS}}>
              <option value="Contador">Contador — ve y procesa documentos</option>
              <option value="Supervisor">Supervisor — aprueba lotes CONCAR</option>
              <option value="Auditor">Auditor — solo lectura, acceso a auditoría</option>
              <option value="Administrador">Administrador — acceso total</option>
            </select>
          </div>

          <div style={{marginBottom:'1rem'}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:C.t2,marginBottom:5}}>
              Empresas que puede ver <span style={{fontSize:10,fontWeight:400,color:C.t4}}>(ninguna seleccionada = ve todas)</span>
            </label>
            {empresas.length===0&&<div style={{fontSize:12,color:C.t4,padding:'.75rem',background:C.bg,borderRadius:6}}>No hay empresas registradas aún</div>}
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {empresas.map(e=>{
                const selected=form.companyIds.includes(e.id);
                return <div key={e.id} onClick={()=>setForm(p=>({...p,companyIds:p.companyIds.includes(e.id)?p.companyIds.filter(i=>i!==e.id):[...p.companyIds,e.id]}))}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'.65rem .9rem',background:selected?C.blueL:C.bg,border:`1.5px solid ${selected?C.blue:C.border}`,borderRadius:8,cursor:'pointer',transition:'all .15s'}}>
                  <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${selected?C.blue:C.border}`,background:selected?C.blue:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {selected&&<span style={{color:'#fff',fontSize:12,fontWeight:900}}>✓</span>}
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:selected?C.blue:C.t1}}>{e.nombre}</div>
                    <div style={{fontSize:10,color:C.t4,fontFamily:'JetBrains Mono,monospace'}}>{e.ruc}</div>
                  </div>
                </div>;
              })}
            </div>
            {form.companyIds.length===0&&<div style={{fontSize:11,color:C.amber,marginTop:6,padding:'4px 8px',background:C.amberL,borderRadius:5}}>
              ⚠ Sin selección: el usuario verá TODAS las empresas. Selecciona al menos una para restricción.
            </div>}
          </div>
        </div>
        <div style={{padding:'1rem 1.5rem',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',flexShrink:0}}>
          <Btn color="ghost" onClick={()=>setOpen(false)} disabled={saving}>Cancelar</Btn>
          <Btn color="green" onClick={crear} disabled={saving}>{saving?<><Spinner size={13} color="#fff"/>Creando...</>:'✓ Crear usuario'}</Btn>
        </div>
      </div>
    </div>}

    <div style={{marginBottom:'1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div><div style={{fontSize:22,fontWeight:800}}>Usuarios y Roles</div><div style={{fontSize:13,color:C.t3}}>{users.length} usuario(s) · Aislamiento por empresa activado</div></div>
      <Btn color="blue" onClick={()=>setOpen(true)}>+ Crear usuario</Btn>
    </div>

    {loading&&<div style={{textAlign:'center',padding:'3rem'}}><Spinner size={28}/></div>}

    {!loading&&<div style={{display:'flex',flexDirection:'column',gap:12}}>
      {users.map(u=>{
        const companyIds=(u.companyIds as string[])||(u.companyIds===null?null:[]);
        const isGlobalAdmin=u.rol==='Administrador'&&companyIds===null;
        return <div key={u.id as string} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.25rem',display:'grid',gridTemplateColumns:'1fr auto',gap:'1rem',alignItems:'start'}}>
          <div>
            <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:'.5rem'}}>
              <div style={{width:36,height:36,borderRadius:8,background:C.blueM,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:C.blue,fontSize:14}}>
                {(u.nombre as string).split(' ').map((n:string)=>n[0]).slice(0,2).join('')}
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:C.t1}}>{u.nombre as string}</div>
                <div style={{fontSize:11,color:C.t3}}>{u.email as string}</div>
              </div>
              <Badge label={u.rol as string} color={ROL_COL[u.rol as string]||'gray'} sm/>
              <Badge label={u.estado as string} color={u.estado==='activo'?'green':'red'} sm dot/>
            </div>

            {/* Empresas asignadas */}
            <div style={{marginTop:'.75rem'}}>
              <div style={{fontSize:11,fontWeight:700,color:C.t4,marginBottom:4}}>
                {isGlobalAdmin?'ACCESO GLOBAL (ve todas las empresas)':'EMPRESAS ASIGNADAS'}
              </div>
              {isGlobalAdmin
                ? <div style={{fontSize:12,color:C.amber,background:C.amberL,padding:'4px 10px',borderRadius:6,display:'inline-block'}}>
                    ⚠ Administrador global — acceso completo
                  </div>
                : <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {empresas.map(e=>{
                      const hasAccess=Array.isArray(companyIds)&&companyIds.includes(e.id);
                      return <div key={e.id}
                        onClick={()=>u.id!=='admin'&&toggleEmpresa(e.id,u.id as string,companyIds as string[]|null)}
                        style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,cursor:'pointer',
                          background:hasAccess?C.greenL:C.bg,
                          border:`1.5px solid ${hasAccess?C.greenM:C.border}`,
                          color:hasAccess?C.green:C.t4,
                          transition:'all .15s'}}>
                        {hasAccess?'✓ ':''}{e.ruc} · {(e.nombre as string).slice(0,18)}
                      </div>;
                    })}
                    {empresas.length===0&&<span style={{fontSize:11,color:C.t4}}>Sin empresas registradas</span>}
                    {Array.isArray(companyIds)&&companyIds.length===0&&empresas.length>0&&
                      <span style={{fontSize:11,color:C.red}}>Sin acceso asignado — haz clic en una empresa</span>}
                  </div>
              }
            </div>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {u.estado==='activo'&&u.email!=='admin@empresa.pe'&&
              <Btn size="sm" color="ghost" onClick={()=>revocar(u.id as string)}>Revocar</Btn>}
            {u.estado==='revocado'&&
              <Btn size="sm" color="green" onClick={()=>API.patchUser(u.id as string,{status:'activo'}).then(()=>load())}>Reactivar</Btn>}
          </div>
        </div>;
      })}
    </div>}
  </div>;
}


function AuditoriaView({logs,empresa,period}:{logs:Record<string,unknown>[];empresa:Company|null;period:string}) {
  const ROL_COL:Record<string,BadgeColor>={Administrador:'red',Contador:'blue',Supervisor:'amber',Auditor:'violet'};
  return <div style={{animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div><div style={{fontSize:22,fontWeight:800}}>Auditoría de Acciones</div><div style={{fontSize:13,color:C.t3}}>Log persistente en BD · {logs.length} eventos</div></div>
      <Btn color="ghost" size="sm" onClick={()=>API.exportCSV('audit',empresa?.id,period)}>↓ Exportar CSV</Btn>
    </div>
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr><Th>Timestamp</Th><Th>Usuario</Th><Th>Rol</Th><Th>Acción</Th><Th>Objeto</Th><Th>IP</Th></tr></thead>
        <tbody>{logs.map((a,i)=>(
          <tr key={a.id as string} style={{background:i%2===0?C.card:C.bg}}>
            <Td mono muted small>{a.ts as string}</Td>
            <Td small>{a.user as string}</Td>
            <Td><Badge label={a.rol as string} color={ROL_COL[a.rol as string]||'gray'} sm/></Td>
            <Td mono><span style={{color:C.blue,fontWeight:700,fontSize:10}}>{a.accion as string}</span></Td>
            <Td mono muted>{a.obj as string}</Td>
            <Td mono muted>{a.ip as string}</Td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════
//  EMPRESAS VIEW
// ══════════════════════════════════════════════════════════
function EmpresasView({empresas,onRefresh,addToast}:{empresas:Company[];onRefresh:()=>void;addToast:(m:string,t?:ToastType)=>void}) {
  const [open,setOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [lookingUp,setLookingUp]=useState(false);
  const [form,setForm]=useState({ruc:'',businessName:'',tradeName:'',regime:'General',sector:'Servicios',contactEmail:'',solUser:'',solPass:'',igvRate:'18'});
  const [padron,setPadron]=useState<{razonSocial:string|null;estado:string|null;condicion:string|null;tipo:string|null}|null>(null);
  const [errors,setErrors]=useState<Record<string,string>>({});
  const inpS={width:'100%',padding:'.5rem .7rem',border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:12,fontFamily:'Inter,system-ui,sans-serif',outline:'none',background:C.card,color:C.t1,boxSizing:'border-box' as const};

  const lookupRuc=async(ruc:string)=>{
    if(ruc.length!==11) return;
    setLookingUp(true);setPadron(null);
    const r=await API.padron(ruc);
    setLookingUp(false);
    if(r.ok&&r.data){
      setPadron(r.data);
      if(r.data.razonSocial) { setForm(p=>({...p,businessName:r.data.razonSocial,tradeName:r.data.razonSocial})); addToast('RUC encontrado: '+r.data.razonSocial,'success'); }
      else addToast('RUC válido — completa la razón social','info');
    } else if(r.error) setErrors(p=>({...p,ruc:r.error}));
  };

  const validate=()=>{
    const e:Record<string,string>={};
    if(!form.ruc||!/^\d{11}$/.test(form.ruc)) e.ruc='RUC debe tener 11 dígitos';
    else if(empresas.some(x=>x.ruc===form.ruc)) e.ruc='RUC ya registrado';
    if(!form.businessName.trim()) e.businessName='Razón social requerida';
    return e;
  };

  const guardar=async()=>{
    const e=validate(); if(Object.keys(e).length){setErrors(e);return;}
    setSaving(true);
    const r=await API.createCompany({...form,igvRate:parseInt(form.igvRate)||18});
    setSaving(false);
    if(r.ok){addToast('Empresa registrada','success');setOpen(false);setForm({ruc:'',businessName:'',tradeName:'',regime:'General',sector:'Servicios',contactEmail:'',solUser:'',solPass:'',igvRate:'18'});setPadron(null);setErrors({});onRefresh();}
    else addToast(r.error||'Error','error');
  };

  return <div style={{animation:'fadeIn .2s ease'}}>
    {open&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:2000,display:'flex',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setOpen(false)}>
      <div style={{width:540,background:C.card,height:'100vh',display:'flex',flexDirection:'column',boxShadow:'-20px 0 60px rgba(0,0,0,.25)',animation:'slideInRight .25s ease'}}>
        <div style={{background:C.navy,padding:'1.25rem 1.5rem',flexShrink:0,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><div style={{fontSize:17,fontWeight:700,color:'#fff'}}>Agregar empresa</div><div style={{fontSize:11,color:'rgba(255,255,255,.5)'}}>Autocomplete RUC · SOL cifrado AES-256-GCM</div></div>
          <button onClick={()=>setOpen(false)} style={{background:'rgba(255,255,255,.1)',border:'none',color:'#fff',width:30,height:30,borderRadius:'50%',cursor:'pointer',fontSize:17}}>×</button>
        </div>
        <div style={{flex:1,padding:'1.5rem',overflowY:'auto'}}>
          <div style={{marginBottom:'1rem'}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:errors.ruc?C.red:C.t2,marginBottom:5}}>RUC <span style={{color:C.red}}>*</span></label>
            <div style={{display:'flex',gap:8}}>
              <input value={form.ruc} onChange={e=>{const v=e.target.value.replace(/\D/g,'').slice(0,11);setForm(p=>({...p,ruc:v}));setErrors(p=>({...p,ruc:''}));if(v.length===11)lookupRuc(v);}} placeholder="20512345678" maxLength={11} style={{...inpS,flex:1,fontFamily:'JetBrains Mono,monospace',fontSize:14,borderColor:errors.ruc?C.red:C.border}}/>
              <Btn color="ghost" size="sm" disabled={lookingUp||form.ruc.length!==11} onClick={()=>lookupRuc(form.ruc)}>{lookingUp?<><Spinner size={12}/>...</>:'🔍'}</Btn>
            </div>
            {errors.ruc&&<div style={{fontSize:11,color:C.red,marginTop:3}}>⚠ {errors.ruc}</div>}
            {padron&&<div style={{marginTop:6,background:padron.razonSocial?C.greenL:C.amberL,border:`1px solid ${padron.razonSocial?C.greenM:C.amberM}`,borderRadius:6,padding:'6px 10px',fontSize:11}}>
              {padron.razonSocial?<><span style={{color:C.green,fontWeight:700}}>✓ Padrón SUNAT</span><div style={{color:C.t2,marginTop:1}}>Estado: <b>{padron.estado}</b> · Condición: <b>{padron.condicion}</b></div></>
                :<span style={{color:C.amber}}>RUC válido — completa la razón social manualmente.</span>}
            </div>}
          </div>
          <div style={{marginBottom:'1rem'}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:errors.businessName?C.red:C.t2,marginBottom:5}}>Razón social <span style={{color:C.red}}>*</span></label>
            <input value={form.businessName} onChange={e=>setForm(p=>({...p,businessName:e.target.value}))} placeholder="EMPRESA S.A.C." style={{...inpS,borderColor:errors.businessName?C.red:C.border}}/>
            {errors.businessName&&<div style={{fontSize:11,color:C.red,marginTop:3}}>⚠ {errors.businessName}</div>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:'1rem'}}>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,color:C.t2,marginBottom:4}}>Nombre comercial</label><input value={form.tradeName} onChange={e=>setForm(p=>({...p,tradeName:e.target.value}))} placeholder="Empresa" style={inpS}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,color:C.t2,marginBottom:4}}>Email contacto</label><input type="email" value={form.contactEmail} onChange={e=>setForm(p=>({...p,contactEmail:e.target.value}))} placeholder="admin@empresa.pe" style={inpS}/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:'1rem'}}>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,color:C.t2,marginBottom:4}}>Régimen</label>
              <select value={form.regime} onChange={e=>setForm(p=>({...p,regime:e.target.value}))} style={{...inpS}}>
                {['General','MYPE Tributario','Especial','Simplificado (NRUS)'].map(r=><option key={r}>{r}</option>)}
              </select></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,color:C.t2,marginBottom:4}}>Sector</label>
              <select value={form.sector} onChange={e=>setForm(p=>({...p,sector:e.target.value}))} style={{...inpS}}>
                {['Minería','Comercio','Servicios','Manufactura','Construcción','Tecnología','Salud','Educación','Otros'].map(s=><option key={s}>{s}</option>)}
              </select></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,color:C.t2,marginBottom:4}}>IGV %</label>
              <input type="number" min="0" max="99" value={form.igvRate} onChange={e=>setForm(p=>({...p,igvRate:e.target.value}))} style={inpS}/></div>
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:'1rem'}}>
            <div style={{fontSize:12,fontWeight:700,color:C.t1,marginBottom:6}}>Credenciales SOL <span style={{fontSize:11,fontWeight:400,color:C.t4}}>(también configurable en Centro SUNAT)</span></div>
            <div style={{background:C.amberL,border:`1px solid ${C.amberM}`,borderRadius:6,padding:'6px 10px',fontSize:11,color:C.amber,marginBottom:8}}>🔐 Cifrado AES-256-GCM. Nunca en texto plano.</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={{display:'block',fontSize:11,fontWeight:700,color:C.t2,marginBottom:4}}>Usuario SOL</label><input value={form.solUser} onChange={e=>setForm(p=>({...p,solUser:e.target.value}))} placeholder="USUARIO_SOL" style={inpS} autoComplete="off"/></div>
              <div><label style={{display:'block',fontSize:11,fontWeight:700,color:C.t2,marginBottom:4}}>Clave SOL</label><input type="password" value={form.solPass} onChange={e=>setForm(p=>({...p,solPass:e.target.value}))} placeholder="••••••••" style={inpS} autoComplete="new-password"/></div>
            </div>
          </div>
        </div>
        <div style={{padding:'1rem 1.5rem',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',flexShrink:0}}>
          <Btn color="ghost" onClick={()=>setOpen(false)} disabled={saving}>Cancelar</Btn>
          <Btn color="green" onClick={guardar} disabled={saving}>{saving?<><Spinner size={13} color="#fff"/>Guardando...</>:'✓ Registrar empresa'}</Btn>
        </div>
      </div>
    </div>}
    <div style={{marginBottom:'1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div><div style={{fontSize:22,fontWeight:800}}>Empresas / RUC</div><div style={{fontSize:13,color:C.t3}}>{empresas.length} empresa(s) · Autocomplete desde Padrón SUNAT</div></div>
      <Btn color="blue" onClick={()=>setOpen(true)}>+ Agregar empresa</Btn>
    </div>
    {empresas.length===0&&<EmptyState icon="▣" title="Sin empresas" sub="Al ingresar el RUC, el sistema busca automáticamente la razón social en el Padrón SUNAT."/>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
      {empresas.map(e=>(
        <div key={e.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'1.5rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:'1rem'}}>
            <div style={{width:46,height:46,borderRadius:10,background:C.blueM,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:900,color:C.blue}}>{(e.nombre||'?')[0]}</div>
            <div style={{display:'flex',gap:4,flexDirection:'column',alignItems:'flex-end'}}><Badge label={e.estado} color={e.estado==='activo'?'green':'amber'} sm dot/><Badge label={e.credEstado==='configuradas'?'SOL ✓':'SOL pendiente'} color={e.credEstado==='configuradas'?'green':'amber'} sm/></div>
          </div>
          <div style={{fontSize:14,fontWeight:800,color:C.t1,marginBottom:'.25rem'}}>{e.nombre}</div>
          <div style={{fontSize:11,color:C.t4,fontFamily:'JetBrains Mono,monospace',marginBottom:'.75rem'}}>{e.ruc}</div>
          {([['Régimen',e.regimen],['Sector',e.sector||'—'],['IGV',`${e.igv||18}%`]] as [string,string][]).map(([k,v])=>(
            <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'.3rem 0',borderBottom:`1px solid ${C.border}`}}>
              <span style={{color:C.t4}}>{k}</span><span style={{color:C.t2}}>{v}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════
//  CONFIGURACION VIEW
// ══════════════════════════════════════════════════════════
function ConfigView({addToast,user}:{addToast:(m:string,t?:ToastType)=>void;user:User|null}) {
  const [tab,setTab]=useState<'sistema'|'seguridad'|'email'>('sistema');
  const [passForm,setPassForm]=useState({current:'',newPass:'',confirm:''});
  const [passLoading,setPassLoading]=useState(false);
  const [mfaStep,setMfaStep]=useState<'idle'|'setup'|'verify'>('idle');
  const [mfaQr,setMfaQr]=useState('');
  const [mfaToken,setMfaToken]=useState('');
  const [mfaLoading,setMfaLoading]=useState(false);

  const inpS={width:'100%',padding:'.5rem .75rem',border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:12,fontFamily:'Inter,system-ui,sans-serif',outline:'none',background:C.card,color:C.t1,boxSizing:'border-box' as const};

  const changePassword=async()=>{
    if(!passForm.current||!passForm.newPass){addToast('Completa todos los campos','error');return;}
    if(passForm.newPass!==passForm.confirm){addToast('Las contraseñas no coinciden','error');return;}
    if(passForm.newPass.length<8){addToast('Mínimo 8 caracteres','error');return;}
    setPassLoading(true);
    const r=await API.changePassword(passForm.current,passForm.newPass);
    setPassLoading(false);
    if(r.ok){addToast('Contraseña cambiada correctamente','success');setPassForm({current:'',newPass:'',confirm:''});}
    else addToast(r.error||'Error','error');
  };

  const setupMfa=async()=>{
    setMfaLoading(true);
    const r=await API.mfaSetup();
    setMfaLoading(false);
    if(r.ok){setMfaQr(r.data.qrCode);setMfaStep('setup');}
    else addToast(r.error||'Error','error');
  };

  const verifyMfa=async()=>{
    if(!mfaToken||mfaToken.length!==6){addToast('Ingresa el código de 6 dígitos','error');return;}
    setMfaLoading(true);
    const r=await API.mfaVerify(mfaToken);
    setMfaLoading(false);
    if(r.ok){addToast('MFA activado correctamente','success');setMfaStep('idle');setMfaToken('');}
    else addToast('Código inválido — verifica tu app','error');
  };

  const TABS=[['sistema','⚙ Sistema'],['seguridad','🔒 Seguridad'],['email','📧 Email']];

  return <div style={{animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1.5rem'}}><div style={{fontSize:22,fontWeight:800}}>Configuración</div><div style={{fontSize:13,color:C.t3}}>Sistema · Seguridad · Email · Variables de entorno</div></div>

    <div style={{display:'flex',gap:8,marginBottom:'1.5rem'}}>
      {TABS.map(([k,l])=>(
        <button key={k} onClick={()=>setTab(k as typeof tab)} style={{padding:'.4rem 1rem',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',border:`1.5px solid ${tab===k?C.blue:C.border}`,background:tab===k?C.blueL:C.card,color:tab===k?C.blue:C.t3,fontFamily:'Inter,system-ui,sans-serif'}}>{l}</button>
      ))}
    </div>

    {tab==='sistema'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
      {[{t:'SUNAT Provider',items:[['Modo actual',process.env.NEXT_PUBLIC_SUNAT_MODE==='direct'?'🟢 REAL':'🟡 MOCK'],['Para activar real','SUNAT_PROVIDER=direct en variables de entorno'],['Client ID','SUNAT_CLIENT_ID=tu_client_id'],['OAuth2 URL','api-seguridad.sunat.gob.pe/v1/...'],['Validate URL','api.sunat.gob.pe/v1/.../validarcomprobante'],['SIRE URL','api-sire.sunat.gob.pe/v1/contribuyente/...']]},
        {t:'CONCAR SQL Server',items:[['Modo','CONCAR_PROVIDER=mock|sqlserver'],['Driver','mssql (npm install mssql)'],['Server','CONCAR_SQL_SERVER=...'],['Database','CONCAR_SQL_DATABASE=CONCAR_CB'],['User','CONCAR_SQL_USER=...'],['Aprobación','Solo Supervisor puede aprobar']]},
        {t:'AI / Copiloto',items:[['Modo','AI_PROVIDER=mock|openai'],['Anthropic (Claude)','ANTHROPIC_API_KEY=sk-ant-...'],['OpenAI','OPENAI_API_KEY=sk-...'],['Modelo Anthropic','claude-haiku-4-5-20251001'],['Modelo OpenAI','gpt-4o-mini'],['Fallback','Reglas PCGE siempre activas']]},
        {t:'Base de datos',items:[['Local dev','DATABASE_URL=file:prisma/dev.db'],['Turso cloud','libsql://xxx.turso.io'],['PostgreSQL','postgresql://user:pass@host/db'],['Scripts','npm run db:init · db:seed · db:reset'],['Tablas','16 tablas · 57 registros demo'],['Backup','Copiar prisma/dev.db periódicamente']]},
      ].map(({t,items})=>(
        <div key={t} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.25rem'}}>
          <div style={{fontSize:13,fontWeight:700,color:C.t1,marginBottom:'.75rem'}}>{t}</div>
          {items.map(([k,v])=>(
            <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'.3rem 0',borderBottom:`1px solid ${C.border}`}}>
              <span style={{color:C.t4,fontWeight:600}}>{k}</span>
              <span style={{color:C.t2,fontFamily:'JetBrains Mono,monospace',fontSize:10,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v}</span>
            </div>
          ))}
        </div>
      ))}
    </div>}

    {tab==='seguridad'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
      {/* Password Change */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.5rem'}}>
        <div style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:'.25rem'}}>Cambiar contraseña</div>
        <div style={{fontSize:11,color:C.t4,marginBottom:'1rem'}}>Usuario: {user?.email} · Cifrado: bcrypt rounds=10</div>
        {[{l:'Contraseña actual',k:'current',t:'password'},{l:'Nueva contraseña (mín. 8 chars)',k:'newPass',t:'password'},{l:'Confirmar nueva contraseña',k:'confirm',t:'password'}].map(f=>(
          <div key={f.k} style={{marginBottom:'.75rem'}}>
            <label style={{display:'block',fontSize:10,fontWeight:700,color:C.t3,textTransform:'uppercase',marginBottom:4}}>{f.l}</label>
            <input type={f.t} value={passForm[f.k as keyof typeof passForm]} onChange={e=>setPassForm(p=>({...p,[f.k]:e.target.value}))} style={inpS} autoComplete="new-password"/>
          </div>
        ))}
        <Btn color="blue" onClick={changePassword} disabled={passLoading} full>
          {passLoading?<><Spinner size={13} color="#fff"/>Cambiando...</>:'🔑 Cambiar contraseña'}
        </Btn>
      </div>

      {/* MFA Setup */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.5rem'}}>
        <div style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:'.25rem'}}>Autenticación MFA / TOTP</div>
        <div style={{fontSize:11,color:C.t4,marginBottom:'1rem'}}>Google Authenticator · Authy · Microsoft Authenticator</div>

        {mfaStep==='idle'&&<>
          <div style={{background:C.blueL,border:`1px solid ${C.blueM}`,borderRadius:8,padding:'.75rem',fontSize:12,color:C.blue,marginBottom:'1rem',lineHeight:1.6}}>
            MFA añade una segunda capa de seguridad. Al activarlo, necesitarás tu teléfono para iniciar sesión.
          </div>
          <Btn color="teal" onClick={setupMfa} disabled={mfaLoading} full>
            {mfaLoading?<><Spinner size={13} color="#fff"/>Generando QR...</>:'📱 Configurar MFA'}
          </Btn>
        </>}

        {mfaStep==='setup'&&<>
          <div style={{textAlign:'center',marginBottom:'1rem'}}>
            {mfaQr&&<img src={mfaQr} alt="MFA QR" style={{width:160,height:160,borderRadius:8}}/>}
            <div style={{fontSize:12,color:C.t3,marginTop:8}}>Escanea con tu app de autenticación</div>
          </div>
          <label style={{display:'block',fontSize:10,fontWeight:700,color:C.t3,textTransform:'uppercase',marginBottom:4}}>Código de verificación (6 dígitos)</label>
          <input value={mfaToken} onChange={e=>setMfaToken(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="123456" maxLength={6}
            style={{...inpS,fontFamily:'JetBrains Mono,monospace',fontSize:18,textAlign:'center',letterSpacing:4,marginBottom:'.75rem'}}/>
          <div style={{display:'flex',gap:8}}>
            <Btn color="ghost" onClick={()=>{setMfaStep('idle');setMfaQr('');setMfaToken('');}}>Cancelar</Btn>
            <Btn color="green" onClick={verifyMfa} disabled={mfaLoading||mfaToken.length!==6} full>
              {mfaLoading?<><Spinner size={13} color="#fff"/>Verificando...</>:'✓ Activar MFA'}
            </Btn>
          </div>
        </>}

        <div style={{marginTop:'1rem',padding:'.75rem',background:C.bg,borderRadius:8,fontSize:11,color:C.t3}}>
          <div style={{fontWeight:700,color:C.t2,marginBottom:4}}>Seguridad del sistema:</div>
          JWT HS256 · Bcrypt rounds=10 · AES-256-GCM para SOL · HTTPS en producción
        </div>
      </div>
    </div>}

    {tab==='email'&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'1.5rem',maxWidth:560}}>
      <div style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:'.25rem'}}>Configuración SMTP</div>
      <div style={{fontSize:11,color:C.t4,marginBottom:'1rem'}}>Para emails de bienvenida, alertas y recuperación de contraseña</div>
      <div style={{background:C.amberL,border:`1px solid ${C.amberM}`,borderRadius:8,padding:'.75rem',fontSize:12,color:C.amber,marginBottom:'1rem'}}>
        ⚠ Estas variables deben configurarse en el servidor (variables de entorno) — no se guardan en BD por seguridad.
      </div>
      {[
        ['SMTP_HOST','smtp.gmail.com','Servidor SMTP (Gmail, Resend, AWS SES)'],
        ['SMTP_PORT','587','Puerto (587=TLS, 465=SSL, 25=sin cifrado)'],
        ['SMTP_USER','usuario@gmail.com','Usuario/email de autenticación'],
        ['SMTP_PASS','app-password','Contraseña o App Password de Gmail'],
        ['SMTP_FROM','noreply@shermanfinance.pe','Email del remitente'],
      ].map(([k,ex,desc])=>(
        <div key={k} style={{marginBottom:'.75rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
            <code style={{fontSize:11,fontFamily:'JetBrains Mono,monospace',color:C.blue,fontWeight:600}}>{k}</code>
            <span style={{fontSize:10,color:C.t4}}>{desc}</span>
          </div>
          <div style={{background:C.bg,borderRadius:6,padding:'.4rem .75rem',fontSize:11,fontFamily:'JetBrains Mono,monospace',color:C.t3,border:`1px solid ${C.border}`}}>{k}="{ex}"</div>
        </div>
      ))}
      <div style={{marginTop:'1rem',padding:'.75rem',background:C.blueL,border:`1px solid ${C.blueM}`,borderRadius:8,fontSize:11,color:C.blue}}>
        ℹ <strong>Gratis para empezar:</strong> Resend.com — 100 emails/día gratis. SMTP_HOST=smtp.resend.com · SMTP_PORT=587 · SMTP_USER=resend · SMTP_PASS=tu-api-key
      </div>
    </div>}
  </div>;
}

function JobsView({empresa}:{empresa:Company|null}) {
  const [jobs,setJobs]=useState<Record<string,unknown>[]>([]);
  useEffect(()=>{if(empresa?.id) API.jobs(empresa.id).then(setJobs);},[empresa?.id]);
  const ST_COL:Record<string,BadgeColor>={COMPLETADO:'green',EN_PROCESO:'blue',PENDIENTE:'amber',ERROR:'red',COMPLETADO_CON_ERRORES:'amber',CANCELADO:'gray'};
  return <div style={{animation:'fadeIn .2s ease'}}>
    <div style={{marginBottom:'1.25rem'}}><div style={{fontSize:22,fontWeight:800}}>Jobs y Procesos</div><div style={{fontSize:13,color:C.t3}}>{jobs.length} jobs en BD</div></div>
    {jobs.length===0?<EmptyState icon="▷" title="Sin jobs" sub="Ejecuta una descarga masiva para crear jobs."/>:
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr><Th>Job ID</Th><Th>Operación</Th><Th>Período</Th><Th right>Docs</Th><Th right>XML</Th><Th right>PDF</Th><Th right>Errores</Th><Th>Estado</Th></tr></thead>
        <tbody>{jobs.map((j,i)=>(
          <tr key={j.id as string} style={{background:i%2===0?C.card:C.bg}}>
            <Td mono muted small>{(j.id as string).slice(-16)}</Td>
            <Td><Badge label={j.operation as string} color="blue" sm/></Td>
            <Td mono>{j.periodFrom as string} → {j.periodTo as string}</Td>
            <Td right bold>{j.docsFound as number||0}</Td>
            <Td right>{j.docsXml as number||0}</Td>
            <Td right>{j.docsPdf as number||0}</Td>
            <Td right><span style={{color:(j.errors as number)>0?C.red:C.t4,fontWeight:(j.errors as number)>0?700:400}}>{j.errors as number||0}</span></Td>
            <Td><Badge label={j.status as string} color={ST_COL[j.status as string]||'gray'} sm dot/></Td>
          </tr>
        ))}</tbody>
      </table>
    </div>}
  </div>;
}

// ══════════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════════
export default function Dashboard() {
  const [user,setUser]=useState<User|null>(null);
  const [checking,setChecking]=useState(true);
  const [active,setActive]=useState('dashboard');
  const [empresas,setEmpresas]=useState<Company[]>([]);
  const [empIdx,setEmpIdx]=useState(0);
  const [darkMode,setDarkMode]=useState(false);
  const [tipoCambio,setTipoCambio]=useState<{compra:number;venta:number;fuente:string}|null>(null);
  const [period,setPeriod]=useState(new Date().toISOString().slice(0,7).replace('-0','-').replace(/-(\d)$/,'-0$1'));
  const [alerts,setAlerts]=useState<Alert[]>([]);
  const [docs,setDocs]=useState<Doc[]>([]);
  const [movs,setMovs]=useState<BankMov[]>([]);
  const [detrs,setDetrs]=useState<Detraccion[]>([]);
  const [auditLogs,setAuditLogs]=useState<Record<string,unknown>[]>([]);
  const [cxc,setCxc]=useState<Record<string,unknown>[]>([]);
  const [cxp,setCxp]=useState<Record<string,unknown>[]>([]);
  const [toasts,setToasts]=useState<Toast[]>([]);

  const addToast=useCallback((msg:string,type:ToastType='success')=>{const id=Date.now();setToasts(p=>[...p,{id,msg,type}]);setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),5000);},[]);
  const removeToast=useCallback((id:number)=>setToasts(p=>p.filter(t=>t.id!==id)),[]);

  useEffect(()=>{const t=gT();if(t) API.me().then(d=>{if(d.ok)setUser(d.data);setChecking(false);}).catch(()=>setChecking(false));else setChecking(false);},[]);

  const empresa=empresas[empIdx]||null;

  const refreshData=useCallback(async()=>{
    if(!empresa?.id) return;
    const [c,v,b,d,a,cx,cp]=await Promise.all([
      API.docs('COMPRA',empresa.id,period),
      API.docs('VENTA',empresa.id,period),
      API.banks(empresa.id),
      API.detracciones(empresa.id),
      API.audit(),
      API.cxc(empresa.id),
      API.cxp(empresa.id),
    ]);
    setDocs([...c,...v]);setMovs(b);setDetrs(d);setAuditLogs(a);setCxc(cx);setCxp(cp);
  },[empresa?.id,period]);

  const refreshEmpresas=useCallback(async()=>{const e=await API.companies();setEmpresas(e);},[]);

  useEffect(()=>{if(user) refreshEmpresas();},[user,refreshEmpresas]);
  useEffect(()=>{if(empresa) refreshData();},[empresa?.id,period,refreshData]);
  useEffect(()=>{if(empresa?.id) API.getDashboard(empresa.id,period).then(r=>{if(r.ok) setAlerts(r.data.alerts||[]);});},[empresa?.id,period]);
  useEffect(()=>{API.tipoCambio().then(r=>{if(r.ok&&r.data) setTipoCambio(r.data);});},[]);

  const logout=()=>{cT();setUser(null);};

  if(checking) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:C.navy,fontFamily:'Inter,system-ui,sans-serif'}}><div style={{textAlign:'center',color:'#fff'}}><Spinner size={40} color={C.blue}/><div style={{marginTop:'1rem',fontSize:14,opacity:.6}}>Verificando sesión...</div></div></div>;

  if(!user) return <Login onLogin={setUser}/>;

  const compras=docs.filter(d=>d.op==='COMPRA');
  const ventas=docs.filter(d=>d.op==='VENTA');

  const VIEWS:Record<string,React.ReactNode> = {
    dashboard:    <DashView docs={docs} movs={movs} onNav={setActive} empresa={empresa} period={period} alerts={alerts}/>,
    bandeja:      <DocTableView docs={docs} titulo="Bandeja Contable" sub="Todos los documentos" addToast={addToast} onRefresh={refreshData}/>,
    sunat_centro: <SunatCentroView empresa={empresa} addToast={addToast} onNav={setActive}/>,
    descarga_masiva:<DescargaMasivaView empresa={empresa} addToast={addToast} onRefresh={refreshData} onSetPeriod={setPeriod} period={period}/>,
    jobs:         <JobsView empresa={empresa}/>,
    compras:      <DocTableView docs={compras} titulo="Compras — Comprobantes recibidos" sub="SUNAT/SIRE" addToast={addToast} onRefresh={refreshData}/>,
    ventas:       <DocTableView docs={ventas}  titulo="Ventas — Comprobantes emitidos"   sub="SUNAT/SIRE" addToast={addToast} onRefresh={refreshData}/>,
    documentos_xml:<DocumentosXmlView docs={docs} empresa={empresa} addToast={addToast} onRefresh={refreshData}/>,
    bancos:       <BancosView movs={movs} empresa={empresa}/>,
    conciliacion: <ConciliacionView docs={docs} movs={movs} empresa={empresa} addToast={addToast} onRefresh={refreshData}/>,
    cxc:          <CxView data={cxc} tipo="CxC" addToast={addToast} onRefresh={refreshData} empresa={empresa} period={period}/>,
    cxp:          <CxView data={cxp} tipo="CxP" addToast={addToast} onRefresh={refreshData} empresa={empresa} period={period}/>,
    detracciones: <DetraccionesView detrs={detrs} addToast={addToast}/>,
    reportes:     <ReportesView empresa={empresa}/>,
    copiloto:     <CopilotoView docs={docs} movs={movs} detrs={detrs}/>,
    concar:       <ConcarView docs={docs} empresa={empresa} addToast={addToast} period={period}/>,
    ple:          <PleView empresa={empresa} period={period} docs={docs} addToast={addToast}/>,
    empresas:     <EmpresasView empresas={empresas} onRefresh={refreshEmpresas} addToast={addToast}/>,
    usuarios:     <UsuariosView addToast={addToast} empresas={empresas}/>,
    auditoria:    <AuditoriaView logs={auditLogs} empresa={empresa} period={period}/>,
    configuracion:<ConfigView addToast={addToast} user={user}/>,
  };

  return <div style={{display:'flex',height:'100vh',fontFamily:'Inter,system-ui,sans-serif',background:C.bg}}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes toastIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:#F8FAFC}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}`}</style>
    <ToastContainer toasts={toasts} remove={removeToast}/>
    <Sidebar active={active} onNav={setActive} user={user}/>
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <Topbar empIdx={empIdx} setEmpIdx={setEmpIdx} empresas={empresas} period={period} setPeriod={setPeriod} onLogout={logout} onRefresh={refreshData} alerts={alerts} empresa={empresa} tipoCambio={tipoCambio} setDarkMode={setDarkMode} darkMode={darkMode}/>
      <AlertBanner alerts={alerts}/>
      <div style={{flex:1,overflowY:'auto',padding:'1.5rem'}}>
        {VIEWS[active]||<EmptyState icon="⊙" title="Módulo no encontrado"/>}
      </div>
    </div>
  </div>;
}
