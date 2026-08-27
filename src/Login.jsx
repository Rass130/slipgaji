import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { CircleDollarSign, Mail, Lock, Loader2 } from "lucide-react";

const T = {
  bg: "#FAF9F5",
  surface: "#FFFFFF",
  border: "#E7E4DC",
  ink: "#1F241F",
  inkSoft: "#6B6F67",
  navy: "#24384D",
  navySoft: "#EAEEF1",
  deduct: "#AE3B32",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 12px 12px 38px",
  fontSize: 14.5,
  fontFamily: "'IBM Plex Sans', sans-serif",
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  background: "#fff",
  color: T.ink,
  outline: "none",
};

function errorMessage(code) {
  const map = {
    "auth/invalid-email": "Format email tidak valid.",
    "auth/user-not-found": "Akun tidak ditemukan. Coba daftar dulu.",
    "auth/wrong-password": "Password salah.",
    "auth/invalid-credential": "Email atau password salah.",
    "auth/email-already-in-use": "Email sudah terdaftar. Coba masuk saja.",
    "auth/weak-password": "Password minimal 6 karakter.",
    "auth/popup-closed-by-user": "Login Google dibatalkan.",
  };
  return map[code] || "Terjadi kesalahan, coba lagi.";
}

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEmailAuth(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(errorMessage(err.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(errorMessage(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'IBM Plex Sans', sans-serif",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: T.navy, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CircleDollarSign size={17} color="#fff" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.ink }}>Buku Gaji</div>
        </div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 24 }}>
          {mode === "login" ? "Masuk ke akun perusahaan kamu" : "Buat akun baru untuk perusahaan kamu"}
        </div>

        <form onSubmit={handleEmailAuth}>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Mail size={16} color={T.inkSoft} style={{ position: "absolute", left: 12, top: 14 }} />
            <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ position: "relative", marginBottom: 6 }}>
            <Lock size={16} color={T.inkSoft} style={{ position: "absolute", left: 12, top: 14 }} />
            <input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          </div>

          {error && <div style={{ fontSize: 12.5, color: T.deduct, margin: "8px 0" }}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", marginTop: 12, padding: "12px 0", borderRadius: 8, border: "none",
              background: T.navy, color: "#fff", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1,
            }}
          >
            {loading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
            {mode === "login" ? "Masuk" : "Daftar Akun"}
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
          <div style={{ flex: 1, height: 1, background: T.border }} />
          <span style={{ fontSize: 11.5, color: T.inkSoft }}>ATAU</span>
          <div style={{ flex: 1, height: 1, background: T.border }} />
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: "100%", padding: "11px 0", borderRadius: 8, border: `1px solid ${T.border}`,
            background: "#fff", color: T.ink, fontWeight: 600, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35.4 26.9 36.3 24 36.3c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C9.6 39.6 16.3 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.6 5.6C40.9 36.4 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z" />
          </svg>
          Masuk dengan Google
        </button>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12.5, color: T.inkSoft }}>
          {mode === "login" ? (
            <>Belum punya akun? <button onClick={() => { setMode("register"); setError(""); }} style={{ background: "none", border: "none", color: T.navy, fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}>Daftar</button></>
          ) : (
            <>Sudah punya akun? <button onClick={() => { setMode("login"); setError(""); }} style={{ background: "none", border: "none", color: T.navy, fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}>Masuk</button></>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
          }
