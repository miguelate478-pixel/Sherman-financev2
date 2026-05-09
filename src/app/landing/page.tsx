"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ── Colores ───────────────────────────────────────────────
const BLUE   = "#2563EB";
const BLUEL  = "#EFF6FF";
const NAVY   = "#0F172A";
const NAVY2  = "#1E293B";
const WHITE  = "#FFFFFF";
const GRAY   = "#6B7280";
const LGRAY  = "#F8FAFC";
const BORDER = "#E2E8F0";
const GREEN  = "#16A34A";
const AMBER  = "#D97706";

const fmtS = (n: number) => "S/ " + new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2 }).format(n);

export default function Landing() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Si ya está logueado, redirigir al dashboard
    const token = localStorage.getItem("sf_token_v2");
    if (token) router.push("/dashboard");
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, [router]);

  const FEATURES = [
    { icon: "📥", title: "Descarga Masiva SUNAT", desc: "Compras y ventas automáticas desde el SIRE. Múltiples períodos en un clic." },
    { icon: "🤖", title: "Clasificación IA", desc: "Cuenta PCGE asignada automáticamente con OpenAI. Confianza por línea." },
    { icon: "📊", title: "Dashboard Multi-Empresa", desc: "Todos tus clientes en una pantalla. Semáforo de alertas en tiempo real." },
    { icon: "📄", title: "Reportes para Clientes", desc: "PDF profesional con resumen ejecutivo, tablas y formato peruano con 1 clic." },
    { icon: "💰", title: "Módulo Financiero", desc: "CXC, CXP y Detracciones calculadas automáticamente desde los documentos." },
    { icon: "💾", title: "Exportar a CONCAR", desc: "Asientos contables CM_COMPRO + CM_DETCOM listos para importar." },
  ];

  const PLANS = [
    {
      name: "Básico", price: 99, highlight: false,
      empresas: "Hasta 3 empresas",
      features: ["Descarga masiva SIRE", "Dashboard básico", "CXC, CXP, Detracciones", "Soporte por email"],
    },
    {
      name: "Profesional", price: 199, highlight: true,
      empresas: "Hasta 10 empresas",
      features: ["Todo el Plan Básico", "Reportes PDF para clientes", "Clasificación IA (PCGE)", "CONCAR export", "Dashboard multi-empresa", "Alertas por email"],
    },
    {
      name: "Empresa", price: 399, highlight: false,
      empresas: "Empresas ilimitadas",
      features: ["Todo incluido", "Soporte prioritario WhatsApp", "Onboarding personalizado", "SLA 99.9%", "Multi-usuario + roles"],
    },
  ];

  const TESTIMONIOS = [
    { texto: "Ahorro 3 horas semanales en cada cliente. La descarga masiva y la clasificación IA son increíbles.", nombre: "CPC María Ruiz", cargo: "Gerente Contable · Lima" },
    { texto: "El reporte PDF para clientes es profesional y lo genero en segundos. Mis clientes están impresionados.", nombre: "CPC Juan López", cargo: "Contador Independiente · Arequipa" },
    { texto: "Las alertas de detracciones me salvaron de una multa. El sistema detectó 3 pendientes con 5 días de anticipación.", nombre: "CPC Ana Flores", cargo: "Supervisora Contable · Trujillo" },
  ];

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: NAVY, background: WHITE, overflowX: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        .fade-up { animation: fadeUp .6s ease forwards; }
        .card-hover:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(37,99,235,.12); transition: all .25s; }
        a { text-decoration: none; }
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr 1fr !important; }
          .plans-grid { grid-template-columns: 1fr !important; }
          .testi-grid { grid-template-columns: 1fr !important; }
          .nav-links { display: none !important; }
          .hero-title { font-size: 2.2rem !important; }
        }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: scrolled ? "rgba(255,255,255,.95)" : "transparent", backdropFilter: scrolled ? "blur(12px)" : "none", borderBottom: scrolled ? `1px solid ${BORDER}` : "none", padding: "1rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all .3s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: WHITE }}>S</div>
          <span style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>Sherman Finance</span>
          <span style={{ fontSize: 10, color: BLUE, border: `1px solid ${BLUE}`, borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>AI</span>
        </div>
        <div className="nav-links" style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
          {[["#funcionalidades", "Funciones"], ["#precios", "Precios"], ["#testimonios", "Clientes"]].map(([h, l]) => (
            <a key={h} href={h} style={{ color: GRAY, fontSize: 14, fontWeight: 500, transition: "color .2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = NAVY)}
              onMouseLeave={e => (e.currentTarget.style.color = GRAY)}>{l}</a>
          ))}
          <a href="/solicitar-demo" style={{ background: BLUEL, color: BLUE, padding: ".45rem 1rem", borderRadius: 8, fontSize: 13, fontWeight: 700, border: `1px solid #BFDBFE` }}>Solicitar Demo</a>
          <a href="/dashboard" style={{ background: BLUE, color: WHITE, padding: ".45rem 1.2rem", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Iniciar Sesión →</a>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────── */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", background: `linear-gradient(135deg, ${NAVY} 0%, #1E3A8A 50%, ${NAVY2} 100%)`, padding: "8rem 2rem 6rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "15%", right: "5%", width: 500, height: 500, background: "radial-gradient(circle, rgba(37,99,235,.25), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "10%", left: "5%", width: 300, height: 300, background: "radial-gradient(circle, rgba(16,163,74,.15), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }} className="hero-grid">
          <div className="fade-up">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,.2)", border: "1px solid rgba(37,99,235,.4)", borderRadius: 20, padding: ".35rem .9rem", fontSize: 11, fontWeight: 700, color: "#93C5FD", marginBottom: "1.5rem", letterSpacing: .5 }}>
              🇵🇪 HECHO EN PERÚ · SUNAT · SIRE · CONCAR
            </div>
            <h1 className="hero-title" style={{ fontSize: "3.2rem", fontWeight: 900, color: WHITE, lineHeight: 1.1, letterSpacing: -1.5, marginBottom: "1.25rem" }}>
              Automatiza la contabilidad de tus clientes con <span style={{ color: "#60A5FA" }}>SUNAT</span>
            </h1>
            <p style={{ fontSize: "1.1rem", color: "#94A3B8", lineHeight: 1.7, marginBottom: "2rem" }}>
              Descarga masiva SIRE, clasificación IA, reportes profesionales y más. Todo en un sistema diseñado para contadores peruanos.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href="/solicitar-demo" style={{ background: BLUE, color: WHITE, padding: ".85rem 2rem", borderRadius: 10, fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 4px 20px rgba(37,99,235,.4)" }}>
                🚀 Solicitar Demo Gratis
              </a>
              <a href="/dashboard" style={{ background: "rgba(255,255,255,.1)", color: WHITE, padding: ".85rem 1.75rem", borderRadius: 10, fontSize: 15, fontWeight: 600, border: "1px solid rgba(255,255,255,.2)" }}>
                Iniciar Sesión
              </a>
            </div>
            <p style={{ color: "#475569", fontSize: 12, marginTop: "1rem" }}>Sin tarjeta · Sin compromiso · Respuesta en 24h</p>
          </div>

          {/* Mini dashboard preview */}
          <div style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, padding: "1.5rem", backdropFilter: "blur(10px)" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: "1rem" }}>
              {["#FF5F57", "#FEBC2E", "#28C840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              <span style={{ fontSize: 11, color: "#475569", marginLeft: 8 }}>Sherman Finance — Dashboard</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[["Compras", "S/ 32,060", "#60A5FA"], ["Ventas", "S/ 92,040", "#A78BFA"], ["IGV Neto", "S/ 10,764", "#34D399"]].map(([l, v, c]) => (
                <div key={l} style={{ background: "rgba(255,255,255,.06)", borderRadius: 8, padding: ".75rem", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#64748B", marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            {[["F001-001234", "REPUESTOS ALFA SAC", "S/ 11,800", "ACEPTADO", GREEN],
              ["FV01-002341", "GRUPO ANDINO SA", "S/ 23,600", "ACEPTADO", GREEN],
              ["E001-000012", "ALQUILERES CORP.", "S/ 10,000", "OBSERVADO", AMBER]].map(([id, rs, total, st, c]) => (
              <div key={id as string} style={{ background: "rgba(255,255,255,.04)", borderRadius: 6, padding: ".6rem .75rem", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, color: "#60A5FA", fontFamily: "monospace" }}>{id as string}</div>
                  <div style={{ fontSize: 11, color: WHITE, fontWeight: 600 }}>{(rs as string).substring(0, 22)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: WHITE }}>{total as string}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: c as string }}>{st as string}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ─────────────────────────────── */}
      <section id="funcionalidades" style={{ padding: "6rem 2rem", background: LGRAY }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <div style={{ fontSize: 11, color: BLUE, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: ".75rem" }}>FUNCIONALIDADES</div>
            <h2 style={{ fontSize: "2.5rem", fontWeight: 900, color: NAVY, letterSpacing: -1 }}>Todo lo que necesita un contador peruano</h2>
          </div>
          <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="card-hover" style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "1.5rem", transition: "all .25s" }}>
                <div style={{ fontSize: 32, marginBottom: "1rem" }}>{icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: ".5rem" }}>{title}</div>
                <div style={{ fontSize: 13, color: GRAY, lineHeight: 1.7 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRECIOS ─────────────────────────────────────── */}
      <section id="precios" style={{ padding: "6rem 2rem", background: WHITE }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <div style={{ fontSize: 11, color: BLUE, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: ".75rem" }}>PRECIOS</div>
            <h2 style={{ fontSize: "2.5rem", fontWeight: 900, color: NAVY, letterSpacing: -1 }}>Simple. Sin sorpresas.</h2>
            <p style={{ color: GRAY, marginTop: ".75rem", fontSize: 15 }}>Precios en soles. Incluye IGV. Cancela cuando quieras.</p>
          </div>
          <div className="plans-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {PLANS.map(({ name, price, highlight, empresas, features }) => (
              <div key={name} style={{ background: highlight ? NAVY : WHITE, border: `2px solid ${highlight ? BLUE : BORDER}`, borderRadius: 16, padding: "2rem", position: "relative", transition: "all .25s" }}>
                {highlight && (
                  <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: BLUE, color: WHITE, fontSize: 11, fontWeight: 800, padding: "4px 16px", borderRadius: 20, whiteSpace: "nowrap" }}>
                    ⭐ RECOMENDADO
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, color: highlight ? "#94A3B8" : GRAY, marginBottom: ".5rem" }}>{name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: ".25rem" }}>
                  <span style={{ fontSize: 42, fontWeight: 900, color: highlight ? WHITE : NAVY, letterSpacing: -2 }}>S/ {price}</span>
                  <span style={{ color: highlight ? "#64748B" : GRAY, fontSize: 13 }}>/mes</span>
                </div>
                <div style={{ fontSize: 12, color: highlight ? "#60A5FA" : BLUE, fontWeight: 600, marginBottom: "1.5rem" }}>{empresas}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "2rem" }}>
                  {features.map(f => (
                    <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: highlight ? "#E2E8F0" : NAVY }}>
                      <span style={{ color: highlight ? "#34D399" : GREEN, flexShrink: 0 }}>✓</span>{f}
                    </div>
                  ))}
                </div>
                <a href="/solicitar-demo" style={{ display: "block", textAlign: "center", padding: ".8rem", borderRadius: 10, fontSize: 14, fontWeight: 700, background: highlight ? BLUE : BLUEL, color: highlight ? WHITE : BLUE, border: `1.5px solid ${highlight ? BLUE : "#BFDBFE"}` }}>
                  Solicitar Demo →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ─────────────────────────────────── */}
      <section id="testimonios" style={{ padding: "6rem 2rem", background: LGRAY }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <div style={{ fontSize: 11, color: BLUE, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: ".75rem" }}>TESTIMONIOS</div>
            <h2 style={{ fontSize: "2.5rem", fontWeight: 900, color: NAVY, letterSpacing: -1 }}>Lo que dicen los contadores</h2>
          </div>
          <div className="testi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {TESTIMONIOS.map(({ texto, nombre, cargo }) => (
              <div key={nombre} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "1.75rem" }}>
                <div style={{ fontSize: 40, color: BLUE, lineHeight: 1, marginBottom: "1rem", opacity: .3 }}>"</div>
                <p style={{ color: NAVY, fontSize: 14, lineHeight: 1.8, marginBottom: "1.5rem" }}>{texto}</p>
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "1rem" }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{nombre}</div>
                  <div style={{ color: GRAY, fontSize: 12 }}>{cargo}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────── */}
      <section style={{ padding: "6rem 2rem", background: NAVY, textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontSize: "2.8rem", fontWeight: 900, color: WHITE, letterSpacing: -1.5, marginBottom: "1rem", lineHeight: 1.1 }}>
            ¿Listo para <span style={{ color: "#60A5FA" }}>automatizar</span> tu contabilidad?
          </h2>
          <p style={{ color: "#64748B", fontSize: 15, marginBottom: "2rem" }}>Respuesta en menos de 24 horas. Sin compromiso.</p>
          <a href="/solicitar-demo" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: BLUE, color: WHITE, padding: "1rem 2.5rem", borderRadius: 12, fontSize: 17, fontWeight: 800, boxShadow: "0 4px 24px rgba(37,99,235,.4)" }}>
            🚀 Solicitar Demo Gratis
          </a>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer style={{ background: "#020617", borderTop: `1px solid rgba(255,255,255,.06)`, padding: "2.5rem 2rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: WHITE }}>S</div>
            <span style={{ fontWeight: 700, color: WHITE, fontSize: 14 }}>Sherman Finance</span>
          </div>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            <span style={{ color: "#475569", fontSize: 13 }}>📧 contacto@shermanfinance.pe</span>
            <span style={{ color: "#475569", fontSize: 13 }}>💬 +51 999 999 999</span>
            <span style={{ color: "#475569", fontSize: 13 }}>Hecho en Perú 🇵🇪</span>
          </div>
          <p style={{ color: "#334155", fontSize: 12 }}>© 2026 Sherman Finance · Lima, Perú</p>
        </div>
      </footer>
    </div>
  );
}
