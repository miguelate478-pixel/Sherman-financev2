"use client";
import { useState, useEffect, useRef } from "react";

const ACCENT = "#22D3EE";
const GOLD   = "#F59E0B";
const DARK   = "#030712";
const DARK2  = "#0A0F1E";
const CARD   = "#0D1526";
const BORDER = "rgba(255,255,255,.07)";
const TEXT   = "#E2E8F0";
const MUTED  = "#64748B";

const plans = [
  { name:"Starter", price:"S/ 490", per:"mes", ruc:"1 empresa", features:["SUNAT/SIRE mock","Parser XML UBL 2.1","Clasificación IA","CxC · CxP · Detracciones","Exportación CSV","Soporte por email"], cta:"Empezar gratis 30 días", highlight:false },
  { name:"Business", price:"S/ 990", per:"mes", ruc:"3 empresas", features:["SUNAT/SIRE real","Descarga masiva automática","CONCAR SQL exportación","Conciliación bancaria","Multi-usuario + roles","Soporte prioritario"], cta:"Más vendido", highlight:true },
  { name:"Enterprise", price:"S/ 1,990", per:"mes", ruc:"Ilimitado", features:["Todo Business incluido","Estudios contables (n empresas)","IA clasificación avanzada","Hosting incluido","SLA 99.9%","Onboarding y capacitación"], cta:"Contactar ventas", highlight:false },
];

const stats = [
  { n:"98%", label:"Documentos SUNAT aceptados automáticamente" },
  { n:"40h", label:"Ahorro promedio mensual por empresa" },
  { n:"< 2s", label:"Tiempo de validación Consulta Integrada CPE" },
  { n:"ISO", label:"Cifrado AES-256-GCM para credenciales SOL" },
];

const features = [
  { icon:"⟳", title:"SUNAT/SIRE Automático", desc:"Descarga masiva de XML/PDF/CDR por período. Parser UBL 2.1 real. Propuesta RVIE/RCE con polling automático." },
  { icon:"◈", title:"Parser XML UBL 2.1", desc:"Extrae cabecera y líneas de cada comprobante. Identifica tipo, moneda, IGV, totales y conceptos." },
  { icon:"⊕", title:"Clasificación IA PCGE", desc:"Asigna cuenta PCGE, centro de costo y categoría automáticamente. Confianza por línea. Revisión humana para outliers." },
  { icon:"⊞", title:"CONCAR SQL Real", desc:"Genera asientos CM_COMPRO + CM_DETCOM compatibles con CONCAR CB. Flujo de aprobación Supervisor obligatorio." },
  { icon:"⇌", title:"Conciliación Bancaria", desc:"Auto-match por monto y razón social. Crossing manual. Detecta detracciones, ITF y movimientos sin comprobante." },
  { icon:"⚡", title:"Alertas en Tiempo Real", desc:"Detracciones vencidas, CxP próximas, documentos observados en SUNAT. Notificaciones por email automáticas." },
  { icon:"◑", title:"Tipo de Cambio SBS", desc:"Conversión USD/EUR a PEN con tipo de cambio del día de la SBS. Visible en el topbar." },
  { icon:"⊙", title:"Auditoría Completa", desc:"Cada acción registrada: quién, cuándo, desde qué IP. Exportable. Compatible con revisión de auditor." },
];

const testimonials = [
  { name:"CPC María Ruiz", role:"Gerente de Contabilidad", co:"Estudio Ruiz & Asociados", text:"Antes tardábamos 3 días en procesar un mes completo de comprobantes. Con Sherman lo hacemos en 20 minutos. El parser XML es exacto y la clasificación IA ya supera el 90% de confianza." },
  { name:"CPC Juan López", role:"Supervisor Contable", co:"Minera Los Andes SAC", text:"La integración CONCAR es lo que esperábamos hace años. El flujo de aprobación nos da el control que necesitamos. El auditor ahora tiene el log completo de cada asiento." },
  { name:"CPC Ana Flores", role:"Contadora Senior", co:"Grupo Comercial Beta", text:"Las alertas de detracciones vencidas me salvaron de una multa. El sistema detectó que teníamos 3 pendientes y nos avisó con 5 días de anticipación." },
];

function Counter({ target, suffix="" }: { target: string; suffix?: string }) {
  const [v, setV] = useState("0");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setV(target); obs.disconnect(); }
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <div ref={ref} style={{fontSize:52,fontWeight:900,color:ACCENT,lineHeight:1,letterSpacing:-2}}>{v}{suffix}</div>;
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number|null>(null);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const faqs = [
    ["¿Necesito credenciales SUNAT para empezar?", "No. El sistema funciona en modo mock con datos simulados. Cuando tengas tus credenciales SOL + Client ID/Secret de SUNAT, activas el modo real con un cambio en el .env."],
    ["¿Funciona con cualquier empresa peruana?", "Sí. Solo necesitas el RUC. El sistema consulta el Padrón SUNAT automáticamente para autocompleter la razón social. Compatible con Régimen General, MYPE Tributario, Especial y NRUS."],
    ["¿CONCAR funciona con mi versión?", "Compatible con CONCAR CB versiones 2020 en adelante. El export genera SQL estándar para CM_COMPRO y CM_DETCOM. También puedes exportar CSV para import manual."],
    ["¿Los datos de mis clientes están seguros?", "Las credenciales SOL se cifran con AES-256-GCM antes de guardar. Nunca en texto plano. JWT firmado con HS256. Toda acción queda en log de auditoría."],
    ["¿Puedo probar antes de pagar?", "Sí. 30 días gratis sin tarjeta. El plan Starter arranca en S/ 490/mes después del trial. Cancelas cuando quieras."],
    ["¿Incluye soporte para SIRE?", "Sí. RVIE (Registro de Ventas e Ingresos) y RCE (Registro de Compras Electrónico). Solicitud de propuesta, polling de ticket, y descarga del ZIP con los comprobantes."],
  ];

  return (
    <div style={{background:DARK,color:TEXT,fontFamily:"'DM Sans',system-ui,sans-serif",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#030712}::-webkit-scrollbar-thumb{background:#22D3EE;border-radius:2px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .hero-text{animation:fadeUp .8s ease forwards}
        .card-hover:hover{transform:translateY(-4px);border-color:rgba(34,211,238,.3)!important;transition:all .3s}
        .btn-primary:hover{background:rgba(34,211,238,.15)!important;transform:translateY(-1px)}
        .btn-primary:active{transform:none}
        .glow{box-shadow:0 0 40px rgba(34,211,238,.15)}
        .grid-bg{background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:40px 40px}
      `}</style>

      {/* NAV */}
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"1rem 2rem",display:"flex",justifyContent:"space-between",alignItems:"center",background:scrolled?"rgba(3,7,18,.9)":"transparent",backdropFilter:scrolled?"blur(12px)":"none",borderBottom:scrolled?`1px solid ${BORDER}`:"none",transition:"all .3s"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:ACCENT,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:DARK}}>S</div>
          <span style={{fontSize:15,fontWeight:700,color:"#fff"}}>Sherman Finance</span>
          <span style={{fontSize:11,color:ACCENT,border:`1px solid ${ACCENT}`,borderRadius:4,padding:"1px 6px",fontFamily:"DM Mono,monospace",fontWeight:500}}>AI v2</span>
        </div>
        <div style={{display:"flex",gap:"2rem",alignItems:"center"}}>
          {[["#features","Funciones"],["#pricing","Precios"],["#testimonials","Clientes"],["#faq","FAQ"]].map(([h,l])=>(
            <a key={h} href={h} style={{color:MUTED,fontSize:14,fontWeight:500,textDecoration:"none",transition:"color .2s"}} onMouseEnter={e=>(e.currentTarget.style.color="#fff")} onMouseLeave={e=>(e.currentTarget.style.color=MUTED)}>{l}</a>
          ))}
          <a href="/dashboard" style={{background:ACCENT,color:DARK,padding:".5rem 1.2rem",borderRadius:8,fontSize:14,fontWeight:700,textDecoration:"none"}}>Iniciar sesión →</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="grid-bg" style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"8rem 2rem 6rem",position:"relative",overflow:"hidden"}}>
        {/* Glow orbs */}
        <div style={{position:"absolute",top:"20%",left:"10%",width:400,height:400,background:"radial-gradient(circle,rgba(34,211,238,.12),transparent 70%)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:"20%",right:"10%",width:300,height:300,background:"radial-gradient(circle,rgba(245,158,11,.08),transparent 70%)",pointerEvents:"none"}}/>

        <div style={{maxWidth:900,position:"relative"}}>
          <div className="hero-text" style={{marginBottom:"1.5rem"}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(34,211,238,.08)",border:`1px solid rgba(34,211,238,.2)`,borderRadius:20,padding:".4rem 1rem",fontSize:12,fontWeight:600,color:ACCENT,fontFamily:"DM Mono,monospace",letterSpacing:1}}>
              ⟳ SUNAT · SIRE · CONCAR · PARSER UBL 2.1
            </span>
          </div>
          <h1 className="hero-text" style={{fontSize:"clamp(2.5rem,6vw,5rem)",fontWeight:900,color:"#fff",lineHeight:1.05,letterSpacing:-3,animationDelay:".1s"}}>
            Contabilidad peruana<br/>
            <span style={{color:ACCENT}}>automatizada</span> con IA
          </h1>
          <p className="hero-text" style={{fontSize:"clamp(1rem,2vw,1.3rem)",color:MUTED,margin:"1.5rem auto",maxWidth:620,lineHeight:1.7,animationDelay:".2s"}}>
            Descarga masiva SUNAT/SIRE · Parser XML UBL 2.1 · Clasificación PCGE con IA · CONCAR SQL · Conciliación bancaria. Todo en un sistema.
          </p>
          <div className="hero-text" style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",animationDelay:".3s"}}>
            <a href="/dashboard" className="btn-primary" style={{background:ACCENT,color:DARK,padding:".85rem 2rem",borderRadius:10,fontSize:16,fontWeight:700,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:8,transition:"all .2s"}}>
              Probar 30 días gratis <span style={{fontSize:18}}>→</span>
            </a>
            <a href="#features" className="btn-primary" style={{border:`1px solid ${BORDER}`,color:TEXT,padding:".85rem 2rem",borderRadius:10,fontSize:15,fontWeight:600,textDecoration:"none",transition:"all .2s"}}>
              Ver funciones
            </a>
          </div>
          <p style={{color:MUTED,fontSize:12,marginTop:"1rem",fontFamily:"DM Mono,monospace"}}>Sin tarjeta · Sin compromiso · Cancela cuando quieras</p>

          {/* Dashboard preview */}
          <div className="glow" style={{marginTop:"4rem",borderRadius:16,overflow:"hidden",border:`1px solid ${BORDER}`,background:CARD,padding:"1.5rem"}}>
            <div style={{display:"flex",gap:6,marginBottom:"1rem"}}>
              {["#FF5F57","#FEBC2E","#28C840"].map(c=><div key={c} style={{width:10,height:10,borderRadius:"50%",background:c}}/>)}
            </div>
            {/* Mini dashboard mockup */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:12}}>
              {[["Compras","S/ 32,060",ACCENT],["Ventas","S/ 92,040","#A78BFA"],["IGV Créd.","S/ 5,274",GOLD],["Saldo","S/ 273,004","#34D399"],["CONCAR","5 listos","#34D399"],["Observados","1","#F87171"]].map(([l,v,c])=>(
                <div key={l} style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:".75rem .5rem",textAlign:"center"}}>
                  <div style={{fontSize:9,color:MUTED,marginBottom:4,fontFamily:"DM Mono,monospace"}}>{l}</div>
                  <div style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[["F001-001234","REP. ALFA SAC","S/ 11,800","ACEPTADO"],["FV01-002341","GRUPO ANDINO SA","S/ 23,600","APROBADO"],["E001-000012","ALQUILERES CORP.","S/ 10,000","LISTO"]].map(([id,rs,total,st])=>(
                <div key={id} style={{background:"rgba(255,255,255,.03)",borderRadius:6,padding:".6rem .75rem",fontSize:10}}>
                  <div style={{fontFamily:"DM Mono,monospace",color:ACCENT,marginBottom:3}}>{id}</div>
                  <div style={{color:TEXT,fontWeight:600,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rs}</div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:MUTED}}>{total}</span>
                    <span style={{color:st==="ACEPTADO"?"#34D399":st==="APROBADO"?"#60A5FA":"#F59E0B",fontSize:9,fontWeight:700}}>{st}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{padding:"4rem 2rem",background:"rgba(34,211,238,.04)",borderTop:`1px solid ${BORDER}`,borderBottom:`1px solid ${BORDER}`}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"2rem",textAlign:"center"}}>
          {stats.map(({n,label})=>(
            <div key={n}>
              <Counter target={n}/>
              <p style={{color:MUTED,fontSize:13,marginTop:".5rem",lineHeight:1.5}}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{padding:"6rem 2rem",maxWidth:1200,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"4rem"}}>
          <div style={{fontSize:12,color:ACCENT,fontFamily:"DM Mono,monospace",letterSpacing:2,marginBottom:".75rem"}}>FUNCIONALIDADES</div>
          <h2 style={{fontSize:"clamp(1.8rem,4vw,3rem)",fontWeight:800,color:"#fff",letterSpacing:-1.5}}>Todo lo que necesita<br/>un contador peruano</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
          {features.map(({icon,title,desc})=>(
            <div key={title} className="card-hover" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:"1.5rem",cursor:"default",transition:"all .3s"}}>
              <div style={{fontSize:28,marginBottom:"1rem",color:ACCENT}}>{icon}</div>
              <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:".5rem"}}>{title}</div>
              <div style={{fontSize:12,color:MUTED,lineHeight:1.7}}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* WORKFLOW */}
      <section style={{padding:"6rem 2rem",background:DARK2,borderTop:`1px solid ${BORDER}`,borderBottom:`1px solid ${BORDER}`}}>
        <div style={{maxWidth:900,margin:"0 auto",textAlign:"center"}}>
          <div style={{fontSize:12,color:GOLD,fontFamily:"DM Mono,monospace",letterSpacing:2,marginBottom:".75rem"}}>FLUJO DE TRABAJO</div>
          <h2 style={{fontSize:"clamp(1.8rem,4vw,2.8rem)",fontWeight:800,color:"#fff",letterSpacing:-1.5,marginBottom:"3rem"}}>De SUNAT a CONCAR<br/>en minutos</h2>
          <div style={{display:"flex",gap:0,alignItems:"stretch",position:"relative"}}>
            <div style={{position:"absolute",top:"50%",left:"10%",right:"10%",height:2,background:`linear-gradient(90deg,${ACCENT},${GOLD})`,transform:"translateY(-50%)",zIndex:0}}/>
            {[
              {n:"01",t:"Credenciales SOL",d:"Ingresas usuario SOL + clave. Se cifran AES-256-GCM. Nunca en texto plano."},
              {n:"02",t:"Descarga masiva",d:"Seleccionas período y empresa. Sistema solicita propuesta RVIE/RCE a SIRE."},
              {n:"03",t:"Parser + IA",d:"Cada XML parseado. Cuenta PCGE asignada automáticamente con confianza."},
              {n:"04",t:"Revisión",d:"El contador valida líneas marcadas para revisión. Aprueba en un clic."},
              {n:"05",t:"Export CONCAR",d:"Supervisor aprueba el lote. SQL INSERT listo para CM_COMPRO + CM_DETCOM."},
            ].map(({n,t,d})=>(
              <div key={n} style={{flex:1,textAlign:"center",padding:"0 .75rem",position:"relative",zIndex:1}}>
                <div style={{width:44,height:44,borderRadius:"50%",background:DARK,border:`2px solid ${ACCENT}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 1rem",fontSize:13,fontWeight:700,color:ACCENT,fontFamily:"DM Mono,monospace"}}>{n}</div>
                <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:".4rem"}}>{t}</div>
                <div style={{fontSize:11,color:MUTED,lineHeight:1.6}}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{padding:"6rem 2rem",maxWidth:1100,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"4rem"}}>
          <div style={{fontSize:12,color:ACCENT,fontFamily:"DM Mono,monospace",letterSpacing:2,marginBottom:".75rem"}}>PRECIOS</div>
          <h2 style={{fontSize:"clamp(1.8rem,4vw,3rem)",fontWeight:800,color:"#fff",letterSpacing:-1.5}}>Simple. Sin sorpresas.</h2>
          <p style={{color:MUTED,marginTop:".75rem",fontSize:15}}>30 días gratis. Incluye IVA. Cancela cuando quieras.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
          {plans.map(({name,price,per,ruc,features:fs,cta,highlight})=>(
            <div key={name} className="card-hover" style={{background:highlight?`linear-gradient(135deg,${CARD},rgba(34,211,238,.08))`:`${CARD}`,border:`1.5px solid ${highlight?ACCENT:BORDER}`,borderRadius:16,padding:"2rem",position:"relative",overflow:"hidden"}}>
              {highlight&&<div style={{position:"absolute",top:16,right:16,background:ACCENT,color:DARK,fontSize:10,fontWeight:800,padding:"3px 10px",borderRadius:20,letterSpacing:.5}}>MÁS VENDIDO</div>}
              <div style={{fontSize:13,color:highlight?ACCENT:MUTED,fontWeight:600,marginBottom:".5rem"}}>{name}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:".25rem"}}>
                <span style={{fontSize:40,fontWeight:900,color:"#fff",letterSpacing:-2}}>{price}</span>
                <span style={{color:MUTED,fontSize:13}}>/{per}</span>
              </div>
              <div style={{fontSize:12,color:MUTED,marginBottom:"1.5rem",fontFamily:"DM Mono,monospace"}}>{ruc}</div>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:"2rem"}}>
                {fs.map(f=>(
                  <div key={f} style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:13,color:TEXT}}>
                    <span style={{color:highlight?ACCENT:"#34D399",flexShrink:0,marginTop:1}}>✓</span>{f}
                  </div>
                ))}
              </div>
              <a href="/dashboard" style={{display:"block",textAlign:"center",padding:".75rem",borderRadius:10,fontSize:14,fontWeight:700,textDecoration:"none",background:highlight?ACCENT:"transparent",color:highlight?DARK:TEXT,border:`1.5px solid ${highlight?ACCENT:BORDER}`,transition:"all .2s"}}>
                {cta}
              </a>
            </div>
          ))}
        </div>
        <div style={{textAlign:"center",marginTop:"2rem"}}>
          <p style={{color:MUTED,fontSize:13}}>¿Necesitas implementación personalizada? <a href="mailto:ventas@shermanfinance.pe" style={{color:ACCENT,textDecoration:"none"}}>Escríbenos →</a></p>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" style={{padding:"6rem 2rem",background:DARK2,borderTop:`1px solid ${BORDER}`}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:"4rem"}}>
            <div style={{fontSize:12,color:ACCENT,fontFamily:"DM Mono,monospace",letterSpacing:2,marginBottom:".75rem"}}>TESTIMONIOS</div>
            <h2 style={{fontSize:"clamp(1.8rem,4vw,3rem)",fontWeight:800,color:"#fff",letterSpacing:-1.5}}>Lo que dicen los contadores</h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
            {testimonials.map(({name,role,co,text})=>(
              <div key={name} className="card-hover" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:"1.75rem"}}>
                <div style={{fontSize:36,color:ACCENT,lineHeight:1,marginBottom:"1rem"}}>"</div>
                <p style={{color:TEXT,fontSize:14,lineHeight:1.8,marginBottom:"1.5rem"}}>{text}</p>
                <div style={{borderTop:`1px solid ${BORDER}`,paddingTop:"1rem"}}>
                  <div style={{fontWeight:700,color:"#fff",fontSize:13}}>{name}</div>
                  <div style={{color:MUTED,fontSize:12}}>{role} · {co}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{padding:"6rem 2rem",maxWidth:800,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"4rem"}}>
          <div style={{fontSize:12,color:ACCENT,fontFamily:"DM Mono,monospace",letterSpacing:2,marginBottom:".75rem"}}>FAQ</div>
          <h2 style={{fontSize:"clamp(1.8rem,4vw,3rem)",fontWeight:800,color:"#fff",letterSpacing:-1.5}}>Preguntas frecuentes</h2>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {faqs.map(([q,a],i)=>(
            <div key={i} style={{background:CARD,border:`1px solid ${activeFaq===i?`rgba(34,211,238,.3)`:BORDER}`,borderRadius:10,overflow:"hidden",transition:"border-color .2s",cursor:"pointer"}} onClick={()=>setActiveFaq(activeFaq===i?null:i)}>
              <div style={{padding:"1.1rem 1.25rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontWeight:600,fontSize:14,color:activeFaq===i?ACCENT:TEXT}}>{q}</span>
                <span style={{color:ACCENT,fontSize:18,transition:"transform .2s",transform:activeFaq===i?"rotate(45deg)":"none"}}>+</span>
              </div>
              {activeFaq===i&&<div style={{padding:"0 1.25rem 1.1rem",fontSize:13,color:MUTED,lineHeight:1.8,borderTop:`1px solid ${BORDER}`}}><br/>{a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{padding:"6rem 2rem",textAlign:"center",background:`linear-gradient(135deg,${DARK2},rgba(34,211,238,.06),${DARK})`,borderTop:`1px solid ${BORDER}`}}>
        <div style={{maxWidth:600,margin:"0 auto"}}>
          <h2 style={{fontSize:"clamp(2rem,5vw,3.5rem)",fontWeight:900,color:"#fff",letterSpacing:-2,marginBottom:"1rem",lineHeight:1.1}}>¿Listo para<br/><span style={{color:ACCENT}}>automatizar</span> tu contabilidad?</h2>
          <p style={{color:MUTED,fontSize:15,marginBottom:"2rem",lineHeight:1.6}}>30 días gratis. Sin tarjeta. Sin burocracia.</p>
          <a href="/dashboard" style={{display:"inline-flex",alignItems:"center",gap:10,background:ACCENT,color:DARK,padding:"1rem 2.5rem",borderRadius:12,fontSize:17,fontWeight:800,textDecoration:"none",boxShadow:`0 0 40px rgba(34,211,238,.3)`}}>
            Empezar ahora gratis <span style={{fontSize:20}}>→</span>
          </a>
          <p style={{color:MUTED,fontSize:12,marginTop:"1.25rem",fontFamily:"DM Mono,monospace"}}>ventas@shermanfinance.pe · Lima, Perú</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{background:DARK,borderTop:`1px solid ${BORDER}`,padding:"2rem",textAlign:"center"}}>
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:12,marginBottom:"1rem"}}>
          <div style={{width:28,height:28,borderRadius:6,background:ACCENT,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:DARK}}>S</div>
          <span style={{fontWeight:700,color:"#fff"}}>Sherman Finance Control AI</span>
          <span style={{fontSize:11,color:ACCENT,border:`1px solid ${ACCENT}`,borderRadius:4,padding:"1px 6px",fontFamily:"DM Mono,monospace"}}>v2.0</span>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:"2rem",marginBottom:"1rem"}}>
          {[["SUNAT","https://www.sunat.gob.pe"],["SIRE","https://sire.sunat.gob.pe"],["CONCAR","#"],["SOL","https://www.gob.pe/sunat"]].map(([l,h])=>(
            <a key={l} href={h} style={{color:MUTED,fontSize:12,textDecoration:"none",fontFamily:"DM Mono,monospace"}}>{l}</a>
          ))}
        </div>
        <p style={{color:MUTED,fontSize:11}}>© 2026 Sherman Finance · RUC: — · Lima, Perú · Hecho con IA en Perú 🇵🇪</p>
      </footer>
    </div>
  );
}
