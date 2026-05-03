"use client";
import { useState } from "react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email.trim()) { setError("Ingresa tu email"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/auth/forgot-password", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email}) });
      const d = await r.json();
      if (d.ok) setSent(true);
      else setError(d.error || "Error al enviar");
    } catch { setError("Error de conexión"); }
    setLoading(false);
  };

  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#0F172A",fontFamily:"Inter,system-ui,sans-serif"}}>
      <div style={{background:"#1E293B",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,width:400,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
        <div style={{padding:"2rem",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1.5rem"}}>
            <div style={{width:36,height:36,borderRadius:8,background:"#22D3EE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:"#030712"}}>S</div>
            <div>
              <div style={{fontWeight:700,color:"#fff",fontSize:15}}>Sherman Finance</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>Recuperar contraseña</div>
            </div>
          </div>
          {sent ? (
            <div style={{textAlign:"center",padding:"1rem 0"}}>
              <div style={{fontSize:48,marginBottom:"1rem"}}>📧</div>
              <div style={{fontSize:16,fontWeight:700,color:"#fff",marginBottom:".5rem"}}>Email enviado</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.5)",lineHeight:1.6}}>Revisa tu bandeja de entrada en <strong style={{color:"#22D3EE"}}>{email}</strong>. El enlace expira en 1 hora.</div>
              <a href="/dashboard" style={{display:"inline-block",marginTop:"1.5rem",color:"#22D3EE",fontSize:13,textDecoration:"none"}}>← Volver al login</a>
            </div>
          ) : (
            <>
              <div style={{color:"rgba(255,255,255,.6)",fontSize:13,lineHeight:1.6,marginBottom:"1.5rem"}}>Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.</div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:"rgba(255,255,255,.5)",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="admin@empresa.pe" autoFocus
                style={{width:"100%",padding:".65rem .85rem",background:"rgba(255,255,255,.06)",border:`1.5px solid ${error?"#F87171":"rgba(255,255,255,.12)"}`,borderRadius:8,fontSize:14,color:"#fff",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
              {error && <div style={{color:"#F87171",fontSize:12,marginTop:6}}>⚠ {error}</div>}
              <button onClick={submit} disabled={loading}
                style={{width:"100%",marginTop:"1.25rem",padding:".7rem",background:"#22D3EE",border:"none",borderRadius:8,fontSize:14,fontWeight:700,color:"#030712",cursor:"pointer",opacity:loading?.7:1}}>
                {loading ? "Enviando..." : "Enviar enlace de recuperación →"}
              </button>
            </>
          )}
        </div>
        <div style={{padding:"1rem 2rem",textAlign:"center"}}>
          <a href="/dashboard" style={{color:"rgba(255,255,255,.4)",fontSize:12,textDecoration:"none"}}>← Volver al login</a>
        </div>
      </div>
    </div>
  );
}
