"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const BLUE   = "#2563EB";
const BLUEL  = "#EFF6FF";
const NAVY   = "#0F172A";
const WHITE  = "#FFFFFF";
const GRAY   = "#6B7280";
const LGRAY  = "#F8FAFC";
const BORDER = "#E2E8F0";
const GREEN  = "#16A34A";
const RED    = "#DC2626";

function Input({ label, name, value, onChange, placeholder, type = "text", required, prefix }: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; prefix?: string;
}) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 6 }}>
        {label} {required && <span style={{ color: RED }}>*</span>}
      </label>
      <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${BORDER}`, borderRadius: 8, overflow: "hidden", background: WHITE }}>
        {prefix && <span style={{ padding: ".55rem .75rem", background: LGRAY, color: GRAY, fontSize: 13, borderRight: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{prefix}</span>}
        <input
          type={type} name={name} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          style={{ flex: 1, padding: ".55rem .75rem", border: "none", outline: "none", fontSize: 14, fontFamily: "Inter, system-ui, sans-serif", background: "transparent" }}
        />
      </div>
    </div>
  );
}

function Select({ label, name, value, onChange, options, required }: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 6 }}>
        {label} {required && <span style={{ color: RED }}>*</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)} required={required}
        style={{ width: "100%", padding: ".55rem .75rem", border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 14, fontFamily: "Inter, system-ui, sans-serif", background: WHITE, color: value ? NAVY : GRAY, outline: "none" }}>
        <option value="">Seleccionar...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export default function SolicitarDemo() {
  const router = useRouter();
  const [form, setForm] = useState({
    nombre: "", email: "", whatsapp: "", estudio: "",
    ruc: "", numClientes: "", comoEncontro: "", mensaje: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (d.ok) setSuccess(true);
      else setError(d.error || "Error al enviar. Intenta de nuevo.");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div style={{ minHeight: "100vh", background: LGRAY, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ background: WHITE, borderRadius: 16, padding: "3rem", maxWidth: 480, width: "100%", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,.08)" }}>
          <div style={{ fontSize: 64, marginBottom: "1rem" }}>🚀</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: NAVY, marginBottom: ".75rem" }}>¡Solicitud enviada!</h2>
          <p style={{ fontSize: 15, color: GRAY, lineHeight: 1.7, marginBottom: "2rem" }}>
            Te contactaremos en menos de <strong style={{ color: NAVY }}>24 horas</strong> al WhatsApp que nos dejaste.
          </p>
          <div style={{ background: BLUEL, border: `1px solid #BFDBFE`, borderRadius: 10, padding: "1rem", marginBottom: "2rem", fontSize: 14, color: BLUE, fontWeight: 600 }}>
            📱 {form.whatsapp}
          </div>
          <button onClick={() => router.push("/")} style={{ background: BLUE, color: WHITE, border: "none", padding: ".75rem 2rem", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            ← Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: LGRAY, fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`* { box-sizing: border-box; } input:focus, select:focus, textarea:focus { border-color: ${BLUE} !important; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }`}</style>

      {/* Nav */}
      <nav style={{ background: WHITE, borderBottom: `1px solid ${BORDER}`, padding: "1rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: WHITE }}>S</div>
          <span style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>Sherman Finance</span>
        </a>
        <a href="/dashboard" style={{ fontSize: 13, color: BLUE, fontWeight: 600 }}>Ya tengo cuenta →</a>
      </nav>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "3rem 1.5rem" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontSize: 11, color: BLUE, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: ".75rem" }}>DEMO GRATUITA</div>
          <h1 style={{ fontSize: "2rem", fontWeight: 900, color: NAVY, letterSpacing: -1, marginBottom: ".75rem" }}>Solicita tu demo gratis</h1>
          <p style={{ fontSize: 15, color: GRAY, lineHeight: 1.6 }}>Completa el formulario y te contactamos en menos de 24 horas por WhatsApp.</p>
        </div>

        {/* Formulario */}
        <div style={{ background: WHITE, borderRadius: 16, padding: "2rem", boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: `1px solid ${BORDER}` }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <Input label="Nombre completo" name="nombre" value={form.nombre} onChange={set("nombre")} placeholder="CPC Juan Pérez" required />
              </div>
              <Input label="Email" name="email" value={form.email} onChange={set("email")} placeholder="juan@estudio.pe" type="email" required />
              <Input label="WhatsApp" name="whatsapp" value={form.whatsapp} onChange={set("whatsapp")} placeholder="987654321" prefix="+51" required />
              <div style={{ gridColumn: "1 / -1" }}>
                <Input label="Nombre del estudio o empresa" name="estudio" value={form.estudio} onChange={set("estudio")} placeholder="Estudio Contable Pérez & Asociados" required />
              </div>
              <Input label="RUC" name="ruc" value={form.ruc} onChange={set("ruc")} placeholder="20XXXXXXXXX (opcional)" />
              <Select label="Número de clientes que maneja" name="numClientes" value={form.numClientes} onChange={set("numClientes")}
                options={[{ value: "1-5", label: "1 a 5 clientes" }, { value: "6-15", label: "6 a 15 clientes" }, { value: "16-30", label: "16 a 30 clientes" }, { value: "mas-de-30", label: "Más de 30 clientes" }]} />
              <div style={{ gridColumn: "1 / -1" }}>
                <Select label="¿Cómo nos encontró?" name="comoEncontro" value={form.comoEncontro} onChange={set("comoEncontro")}
                  options={[{ value: "google", label: "Google" }, { value: "referido", label: "Referido de un colega" }, { value: "redes", label: "Redes sociales" }, { value: "otro", label: "Otro" }]} />
              </div>
              <div style={{ gridColumn: "1 / -1", marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Mensaje (opcional)</label>
                <textarea value={form.mensaje} onChange={e => set("mensaje")(e.target.value)} placeholder="Cuéntanos sobre tu estudio, qué necesitas, preguntas..."
                  rows={3} style={{ width: "100%", padding: ".6rem .75rem", border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 14, fontFamily: "Inter, system-ui, sans-serif", resize: "vertical", outline: "none" }} />
              </div>
            </div>

            {error && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: ".75rem 1rem", marginBottom: "1rem", fontSize: 13, color: RED }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ width: "100%", background: loading ? "#93C5FD" : BLUE, color: WHITE, border: "none", padding: ".9rem", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading ? "Enviando..." : "🚀 Solicitar Demo Gratis"}
            </button>

            <p style={{ fontSize: 11, color: GRAY, textAlign: "center", marginTop: "1rem" }}>
              Al enviar aceptas que te contactemos por WhatsApp. Sin spam.
            </p>
          </form>
        </div>

        {/* Beneficios */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: "2rem" }}>
          {[["✅", "Sin tarjeta", "de crédito"], ["⚡", "Respuesta", "en 24 horas"], ["🇵🇪", "Soporte", "en español"]].map(([icon, t1, t2]) => (
            <div key={t1} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "1rem", textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{t1}</div>
              <div style={{ fontSize: 11, color: GRAY }}>{t2}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
