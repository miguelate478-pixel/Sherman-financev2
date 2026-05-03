"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    if (!token) { setValidating(false); setError("Token inválido o expirado"); return; }
    fetch(`/api/auth/reset-password?token=${token}`)
      .then(r => r.json())
      .then(d => { setTokenValid(d.ok); if (!d.ok) setError("Token inválido o expirado"); })
      .catch(() => setError("Error de conexión"))
      .finally(() => setValidating(false));
  }, [token]);

  const submit = async () => {
    if (newPass.length < 8) { setError("Mínimo 8 caracteres"); return; }
    if (newPass !== confirm) { setError("Las contraseñas no coinciden"); return; }
    setLoading(true); setError("");
    const r = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: newPass }),
    });
    const d = await r.json();
    setLoading(false);
    if (d.ok) setDone(true);
    else setError(d.error || "Error al cambiar contraseña");
  };

  const inp = {
    width:"100%", padding:".65rem .85rem",
    background:"rgba(255,255,255,.06)", border:`1.5px solid ${error ? "#F87171" : "rgba(255,255,255,.12)"}`,
    borderRadius:"8px", fontSize:"14px", color:"#fff", fontFamily:"inherit", outline:"none", boxSizing:"border-box" as const,
  };

  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#0F172A",fontFamily:"Inter,system-ui,sans-serif"}}>
      <div style={{background:"#1E293B",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,width:400,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
        <div style={{background:"#0F172A",padding:"1.5rem 2rem",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:8,background:"#22D3EE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:"#030712"}}>S</div>
          <div><div style={{fontWeight:700,color:"#fff",fontSize:15}}>Sherman Finance</div><div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>Nueva contraseña</div></div>
        </div>
        <div style={{padding:"2rem"}}>
          {validating && <div style={{textAlign:"center",color:"rgba(255,255,255,.5)",fontSize:14}}>Verificando token...</div>}
          {!validating && !tokenValid && (
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:"1rem"}}>⚠</div>
              <div style={{color:"#F87171",fontSize:14,marginBottom:"1.5rem"}}>{error}</div>
              <a href="/forgot-password" style={{color:"#22D3EE",fontSize:13,textDecoration:"none"}}>Solicitar nuevo enlace →</a>
            </div>
          )}
          {!validating && tokenValid && !done && (
            <>
              <div style={{color:"rgba(255,255,255,.6)",fontSize:13,marginBottom:"1.5rem",lineHeight:1.6}}>
                Ingresa tu nueva contraseña. Mínimo 8 caracteres.
              </div>
              {([{l:"Nueva contraseña",v:newPass,set:setNewPass},{l:"Confirmar contraseña",v:confirm,set:setConfirm}] as {l:string;v:string;set:(v:string)=>void}[]).map(f=>(
                <div key={f.l} style={{marginBottom:"1rem"}}>
                  <label style={{display:"block",fontSize:11,fontWeight:700,color:"rgba(255,255,255,.5)",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>{f.l}</label>
                  <input type="password" value={f.v} onChange={e=>f.set(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={inp} autoComplete="new-password"/>
                </div>
              ))}
              {error && <div style={{color:"#F87171",fontSize:12,marginBottom:"1rem"}}>⚠ {error}</div>}
              <button onClick={submit} disabled={loading} style={{width:"100%",padding:".7rem",background:"#22D3EE",border:"none",borderRadius:8,fontSize:14,fontWeight:700,color:"#030712",cursor:"pointer",opacity:loading?.7:1}}>
                {loading ? "Cambiando..." : "Establecer nueva contraseña →"}
              </button>
            </>
          )}
          {done && (
            <div style={{textAlign:"center",padding:"1rem 0"}}>
              <div style={{fontSize:48,marginBottom:"1rem"}}>✓</div>
              <div style={{fontSize:16,fontWeight:700,color:"#fff",marginBottom:".5rem"}}>Contraseña actualizada</div>
              <div style={{color:"rgba(255,255,255,.5)",fontSize:13,marginBottom:"1.5rem"}}>Tu contraseña fue cambiada correctamente.</div>
              <a href="/dashboard" style={{display:"inline-block",background:"#22D3EE",color:"#030712",padding:".65rem 1.5rem",borderRadius:8,textDecoration:"none",fontWeight:700,fontSize:14}}>Iniciar sesión →</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  return <Suspense fallback={<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#0F172A",color:"#fff"}}>Cargando...</div>}><ResetForm/></Suspense>;
}
