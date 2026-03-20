// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const T = {
  bg: "#f4f0e8", bgCard: "#ede9df", border: "#d0c8b8",
  text: "#1a1200", textFaint: "#aaa090", textMid: "#6a6050",
  accent: "#8a6a00", accentBg: "rgba(138,106,0,0.08)",
  btnBg: "#1a1200", btnText: "#f4f0e8", error: "#cc2222",
};
const font = { fontFamily: "'VT323', monospace" };
const mono = { fontFamily: "'DM Mono', monospace" };

export default function Login() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();

  const [mode,     setMode]     = useState("login");  // 'login' | 'signup'
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [err,      setErr]      = useState(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setErr(null);
    const fn = mode === "login" ? signInWithEmail : signUpWithEmail;
    const { error } = await fn(email, password);
    setLoading(false);
    if (error) setErr(error.message);
    else navigate("/app");
  }

  async function handleGoogle() {
    await signInWithGoogle();
    // Redirect handled by Supabase OAuth callback
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {/* Google font */}
      <link href="https://fonts.googleapis.com/css2?family=VT323&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ ...font, fontSize: 36, color: T.accent, letterSpacing: 2 }}>◈ TOP-ALERTS</div>
          <div style={{ ...mono, fontSize: 10, letterSpacing: "3px", color: T.textFaint, marginTop: 4 }}>INTELLIGENT PRICE ALERTS</div>
        </div>

        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: "32px 28px" }}>

          {/* Mode toggle */}
          <div style={{ display: "flex", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: 4, gap: 4, marginBottom: 24 }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: "9px 0", borderRadius: 7, border: "none",
                background: mode === m ? T.bgCard : "transparent",
                color: mode === m ? T.text : T.textFaint,
                cursor: "pointer", ...font, fontSize: 18,
              }}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Google OAuth */}
          <button onClick={handleGoogle} style={{
            width: "100%", padding: "12px 0", borderRadius: 9,
            border: `1px solid ${T.border}`, background: T.bg,
            cursor: "pointer", ...font, fontSize: 18, color: T.text,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            marginBottom: 20,
          }}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: T.border }} />
            <span style={{ ...mono, fontSize: 10, color: T.textFaint }}>OR</span>
            <div style={{ flex: 1, height: 1, background: T.border }} />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, display: "block", marginBottom: 6 }}>EMAIL</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                style={{ width: "100%", padding: "12px 14px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, ...font, fontSize: 18, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, display: "block", marginBottom: 6 }}>PASSWORD</label>
              <input
                type="password" required value={password} onChange={e => setPassword(e.target.value)}
                style={{ width: "100%", padding: "12px 14px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, ...font, fontSize: 18, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {err && (
              <div style={{ ...mono, fontSize: 11, color: T.error, background: "rgba(204,34,34,0.06)", border: "1px solid rgba(204,34,34,0.2)", borderRadius: 7, padding: "10px 14px", marginBottom: 16 }}>
                {err}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "13px 0", background: T.btnBg, border: "none",
              borderRadius: 9, cursor: loading ? "not-allowed" : "pointer",
              ...font, fontSize: 20, color: T.btnText, opacity: loading ? 0.6 : 1,
            }}>
              {loading ? "..." : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, ...mono, fontSize: 10, color: T.textFaint }}>
          No credit card required · Free plan always available
        </div>
      </div>
    </div>
  );
}
