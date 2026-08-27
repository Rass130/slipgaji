import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login.jsx";
import PayrollApp from "./PayrollApp.jsx";
import { Loader2 } from "lucide-react";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = belum dicek, null = belum login

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  if (user === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif", color: "#6B6F67" }}>
        <Loader2 size={20} style={{ marginRight: 8, animation: "spin 1s linear infinite" }} />
        Memuat...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return <Login />;

  return <PayrollApp uid={user.uid} userEmail={user.email} onLogout={() => signOut(auth)} />;
}
