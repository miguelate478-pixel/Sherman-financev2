import Link from 'next/link';
export default function NotFound() {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Inter,system-ui,sans-serif',background:'#0F172A',color:'#fff'}}>
      <div style={{fontSize:96,fontWeight:900,color:'#2563EB',lineHeight:1}}>404</div>
      <div style={{fontSize:22,fontWeight:700,marginBottom:'.5rem',marginTop:'1rem'}}>Página no encontrada</div>
      <div style={{fontSize:14,color:'rgba(255,255,255,.5)',marginBottom:'2rem'}}>Sherman Finance Control AI</div>
      <Link href="/dashboard" style={{background:'#2563EB',color:'#fff',borderRadius:8,padding:'.6rem 1.5rem',fontSize:14,fontWeight:600,textDecoration:'none'}}>← Ir al Dashboard</Link>
    </div>
  );
}
