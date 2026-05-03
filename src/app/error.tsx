"use client";
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Inter,system-ui,sans-serif',background:'#F8FAFC'}}>
      <div style={{fontSize:64,marginBottom:'1rem'}}>⚠</div>
      <div style={{fontSize:22,fontWeight:800,color:'#111827',marginBottom:'.5rem'}}>Algo salió mal</div>
      <div style={{fontSize:14,color:'#6B7280',marginBottom:'2rem',maxWidth:400,textAlign:'center'}}>{error.message || 'Error inesperado en el sistema'}</div>
      <button onClick={reset} style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:8,padding:'.6rem 1.5rem',fontSize:14,fontWeight:600,cursor:'pointer'}}>Reintentar</button>
    </div>
  );
}
