import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users, LayoutDashboard, CalendarCheck, Wallet, Plus, X, Download,
  Trash2, Pencil, ChevronLeft, ChevronRight, Check, Clock, AlertCircle,
  TrendingUp, TrendingDown, Loader2, CircleDollarSign, Banknote, LogOut, Flame, Settings, Undo2, LogOut as LogOutAccount
} from "lucide-react";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

/* ---------------------------------------------------------
   TOKENS
--------------------------------------------------------- */
const T = {
  bg: "#FAF9F5",
  surface: "#FFFFFF",
  border: "#E7E4DC",
  ink: "#1F241F",
  inkSoft: "#6B6F67",
  income: "#2F6844",
  incomeSoft: "#E7F0E9",
  deduct: "#AE3B32",
  deductSoft: "#F5E7E5",
  navy: "#24384D",
  navySoft: "#EAEEF1",
  amber: "#B98226",
  amberSoft: "#F6EEDD",
};

const FONT_LINK_ID = "payroll-app-fonts";
function ensureFonts() {
  if (typeof document === "undefined") return;
  if (document.getElementById(FONT_LINK_ID)) return;
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap";
  document.head.appendChild(link);
}

const rupiah = (n) =>
  "Rp" +
  Math.round(Number(n) || 0)
    .toLocaleString("id-ID", { maximumFractionDigits: 0 });

const monthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function periodKey(y, m) { return `${y}-${String(m + 1).padStart(2, "0")}`; }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function defaultWeeksInMonth(y, m) {
  // Uang mingguan dibayar tiap hari Sabtu -> hitung jumlah Sabtu di bulan itu
  const dim = daysInMonth(y, m);
  let count = 0;
  for (let d = 1; d <= dim; d++) if (new Date(y, m, d).getDay() === 6) count++;
  return count;
}
function isDateInPeriod(dateStr, y, m) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  return d.getFullYear() === y && d.getMonth() === m;
}
function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function lateMinutes(jamMasukAktual, jamMasukMaksimal) {
  const a = timeToMinutes(jamMasukAktual);
  const b = timeToMinutes(jamMasukMaksimal);
  if (a == null || b == null) return 0;
  return Math.max(0, a - b);
}
// Konversi telat ke satuan potongan sesuai mode yang dipilih per karyawan
function telatUnits(minutes, mode) {
  if (minutes <= 0) return 0;
  return mode === "jam" ? Math.ceil(minutes / 60) : minutes;
}

const HARI_KERJA_STANDAR = 26; // basis default potongan alpa per hari
const uid = () => Math.random().toString(36).slice(2, 10);
const DEFAULT_SETTINGS = { jamMasukMaksimal: "08:30" };

/* ---------------------------------------------------------
   STORAGE HELPERS (Firestore, dipisah per akun/org lewat uid)
   Struktur: orgs/{uid}/data/{key}  ->  { value: <json> }
--------------------------------------------------------- */
async function loadJSON(uid, key, fallback) {
  try {
    const ref = doc(db, "orgs", uid, "data", key);
    const snap = await getDoc(ref);
    if (!snap.exists()) return fallback;
    return snap.data().value ?? fallback;
  } catch (e) { console.error("firestore read failed", e); return fallback; }
}
async function saveJSON(uid, key, value) {
  try {
    const ref = doc(db, "orgs", uid, "data", key);
    await setDoc(ref, { value });
    return true;
  } catch (e) { console.error("firestore write failed", e); return false; }
}

/* ---------------------------------------------------------
   SMALL UI PRIMITIVES
--------------------------------------------------------- */
function Field({ label, children, hint }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft, marginBottom: 6, letterSpacing: 0.2 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4 }}>{hint}</div>}
    </label>
  );
}

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 14.5,
  fontFamily: "'IBM Plex Sans', sans-serif", border: `1px solid ${T.border}`, borderRadius: 8,
  background: "#fff", color: T.ink, outline: "none",
};

function MoneyInput({ value, onChange, placeholder }) {
  return (
    <input
      type="number" inputMode="numeric"
      value={value === 0 || value ? value : ""}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      placeholder={placeholder || "0"}
      style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }}
    />
  );
}

function Button({ children, onClick, variant = "primary", style, disabled, type = "button" }) {
  const variants = {
    primary: { background: T.navy, color: "#fff", border: `1px solid ${T.navy}` },
    ghost: { background: "transparent", color: T.ink, border: `1px solid ${T.border}` },
    danger: { background: "transparent", color: T.deduct, border: `1px solid ${T.deductSoft}` },
    subtle: { background: T.navySoft, color: T.navy, border: `1px solid ${T.navySoft}` },
    amber: { background: T.amber, color: "#fff", border: `1px solid ${T.amber}` },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600,
      fontFamily: "'IBM Plex Sans', sans-serif", padding: "9px 14px", borderRadius: 8,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "opacity .15s",
      ...variants[variant], ...style,
    }}>
      {children}
    </button>
  );
}

function Modal({ title, onClose, children, width = 420 }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(31,36,31,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100, padding: 0 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, width: "100%", maxWidth: width, borderRadius: "16px 16px 0 0", padding: 20, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 -8px 30px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{title}</div>
          <button onClick={onClose} style={{ background: T.bg, border: "none", borderRadius: 999, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={16} color={T.inkSoft} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyNote({ text }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.inkSoft, fontSize: 13, padding: "10px 0" }}><AlertCircle size={14} /> {text}</div>;
}

const iconBtnStyle = {
  width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`,
  background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};

/* ---------------------------------------------------------
   MAIN APP
--------------------------------------------------------- */
export default function PayrollApp({ uid, userEmail, onLogout }) {
  useEffect(() => { ensureFonts(); }, []);

  const [ready, setReady] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [attendance, setAttendance] = useState({});   // { pKey: { empId: { "YYYY-MM-DD": {status, jamMasuk, pulangCepat, jamPulang, lembur, keterangan} } } }
  const [payroll, setPayroll] = useState({});         // { pKey: { empId: {...overrides} } }
  const [kasbonTx, setKasbonTx] = useState({});        // { empId: [ {id, tanggal, nominal, catatan} ] }
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);

  const pKey = periodKey(year, month);

  useEffect(() => {
    (async () => {
      const emp = await loadJSON(uid, "employees", []);
      const att = await loadJSON(uid, "attendance-all", {});
      const pay = await loadJSON(uid, "payroll-all", {});
      const kb = await loadJSON(uid, "kasbon-all", {});
      const st = await loadJSON(uid, "settings", DEFAULT_SETTINGS);
      setEmployees(emp); setAttendance(att); setPayroll(pay); setKasbonTx(kb); setSettings(st);
      setReady(true);
    })();
  }, [uid]);

  const persistEmployees = useCallback(async (next) => { setEmployees(next); await saveJSON(uid, "employees", next); }, [uid]);
  const persistAttendance = useCallback(async (next) => { setAttendance(next); await saveJSON(uid, "attendance-all", next); }, [uid]);
  const persistPayroll = useCallback(async (next) => { setPayroll(next); await saveJSON(uid, "payroll-all", next); }, [uid]);
  const persistKasbon = useCallback(async (next) => { setKasbonTx(next); await saveJSON(uid, "kasbon-all", next); }, [uid]);
  const persistSettings = useCallback(async (next) => { setSettings(next); await saveJSON(uid, "settings", next); }, [uid]);

  const attThisPeriod = attendance[pKey] || {};
  const payThisPeriod = payroll[pKey] || {};

  const kasbonForPeriod = useCallback(
    (empId) => (kasbonTx[empId] || []).filter((tx) => isDateInPeriod(tx.tanggal, year, month)).reduce((s, tx) => s + Number(tx.nominal || 0), 0),
    [kasbonTx, year, month]
  );

  const rows = useMemo(() => {
    return employees.map((e) => {
      const p = payThisPeriod[e.id] || {};
      const recs = Object.values(attThisPeriod[e.id] || {});

      const gajiPokok = p.gajiPokok ?? e.gajiPokok ?? 0;
      const uangMingguan = p.uangMingguan ?? e.uangMingguan ?? 0;
      const jumlahMinggu = p.jumlahMinggu ?? defaultWeeksInMonth(year, month);
      const totalUangMingguan = uangMingguan * jumlahMinggu;

      const rateLemburPerJam = p.rateLemburPerJam ?? e.rateLemburPerJam ?? 0;
      const totalJamLembur = recs.reduce((s, r) => s + Number(r.lembur || 0), 0);
      const lemburanAuto = Math.round(totalJamLembur * rateLemburPerJam);
      const lemburan = p.lemburanManual != null ? p.lemburanManual : lemburanAuto;

      const gajiBruto = gajiPokok + totalUangMingguan + lemburan; // total pendapatan kotor

      const alpaHari = recs.filter((r) => r.status === "Alpa").length;
      const potonganAlpaPerHari = p.potonganAlpaPerHari ?? e.potonganAlpaPerHari ?? Math.round(gajiPokok / HARI_KERJA_STANDAR);
      const potonganAlpa = Math.round(potonganAlpaPerHari * alpaHari);

      const setengahHariCount = recs.filter((r) => r.status === "Hadir" && r.pulangCepat).length;
      const potonganSetengahHariRate = p.potonganSetengahHari ?? e.potonganSetengahHari ?? Math.round(potonganAlpaPerHari / 2);
      const potonganSetengahHari = Math.round(setengahHariCount * potonganSetengahHariRate);

      const telatMenitTotal = recs.filter((r) => r.status === "Hadir").reduce((s, r) => s + lateMinutes(r.jamMasuk, settings.jamMasukMaksimal), 0);
      const potonganTelatMode = p.potonganTelatMode ?? e.potonganTelatMode ?? "menit";
      const potonganTelatRate = p.potonganTelatRate ?? e.potonganTelatRate ?? 0;
      const telatUnitsTotal = recs.filter((r) => r.status === "Hadir").reduce((s, r) => s + telatUnits(lateMinutes(r.jamMasuk, settings.jamMasukMaksimal), potonganTelatMode), 0);
      const potonganTelat = Math.round(telatUnitsTotal * potonganTelatRate);

      const izinHari = recs.filter((r) => r.status === "Izin").length;

      const kasbonAuto = kasbonForPeriod(e.id);
      const kasbon = p.kasbonManual != null ? p.kasbonManual : kasbonAuto;
      const kasbonBerjalan = (kasbonTx[e.id] || []).reduce((s, tx) => s + Number(tx.nominal || 0), 0);

      const totalPendapatan = gajiBruto;
      const totalPotongan = potonganAlpa + potonganSetengahHari + potonganTelat + kasbon;
      const totalGaji = totalPendapatan - totalPotongan;

      return {
        ...e,
        gajiPokok, uangMingguan, jumlahMinggu, totalUangMingguan,
        rateLemburPerJam, lemburan, lemburanAuto, totalJamLembur, gajiBruto,
        alpaHari, potonganAlpaPerHari, potonganAlpa,
        setengahHariCount, potonganSetengahHariRate, potonganSetengahHari,
        telatMenitTotal, potonganTelatMode, potonganTelatRate, telatUnitsTotal, potonganTelat,
        izinHari,
        kasbon, kasbonAuto, kasbonBerjalan,
        totalPendapatan, totalPotongan, totalGaji,
      };
    });
  }, [employees, payThisPeriod, attThisPeriod, kasbonForPeriod, kasbonTx, year, month, settings]);

  const totals = useMemo(() => rows.reduce((acc, r) => {
    acc.pendapatan += r.totalPendapatan; acc.potongan += r.totalPotongan; acc.gaji += r.totalGaji;
    return acc;
  }, { pendapatan: 0, potongan: 0, gaji: 0 }), [rows]);

  if (!ready) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: T.inkSoft, fontFamily: "'IBM Plex Sans', sans-serif" }}>
        <Loader2 size={18} style={{ marginRight: 8, animation: "spin 1s linear infinite" }} />
        Memuat data...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: T.bg, color: T.ink, minHeight: 500, maxWidth: 480, margin: "0 auto", borderRadius: 14, overflow: "hidden", border: `1px solid ${T.border}` }}>
      <div style={{ padding: "18px 18px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: T.navy, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CircleDollarSign size={15} color="#fff" />
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: -0.2 }}>Buku Gaji</div>
          </div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginLeft: 34 }}>{userEmail || "Payroll & absensi karyawan"}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowSettings(true)} style={iconBtnStyle} title="Pengaturan">
            <Settings size={16} color={T.inkSoft} />
          </button>
          <button onClick={onLogout} style={iconBtnStyle} title="Keluar">
            <LogOutAccount size={16} color={T.deduct} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => { const d = new Date(year, month - 1, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <ChevronLeft size={18} color={T.inkSoft} />
        </button>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13.5 }}>{monthNames[month]} {year}</div>
        <button onClick={() => { const d = new Date(year, month + 1, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <ChevronRight size={18} color={T.inkSoft} />
        </button>
      </div>

      <div style={{ padding: 18, minHeight: 380 }}>
        {tab === "dashboard" && <Dashboard rows={rows} totals={totals} attThisPeriod={attThisPeriod} employees={employees} />}
        {tab === "karyawan" && <Karyawan employees={employees} persistEmployees={persistEmployees} />}
        {tab === "absensi" && <Absensi employees={employees} year={year} month={month} pKey={pKey} attendance={attendance} persistAttendance={persistAttendance} settings={settings} rows={rows} />}
        {tab === "kasbon" && <Kasbon employees={employees} kasbonTx={kasbonTx} persistKasbon={persistKasbon} year={year} month={month} rows={rows} />}
        {tab === "gaji" && <Gaji rows={rows} pKey={pKey} monthLabel={`${monthNames[month]} ${year}`} payroll={payroll} persistPayroll={persistPayroll} />}
      </div>

      <div style={{ display: "flex", borderTop: `1px solid ${T.border}`, background: T.surface }}>
        {[
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "karyawan", label: "Karyawan", icon: Users },
          { id: "absensi", label: "Absensi", icon: CalendarCheck },
          { id: "kasbon", label: "Kasbon", icon: Banknote },
          { id: "gaji", label: "Gaji", icon: Wallet },
        ].map((t) => {
          const Icon = t.icon; const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0 9px", background: "none", border: "none", cursor: "pointer", color: active ? T.navy : T.inkSoft }}>
              <Icon size={17} strokeWidth={active ? 2.4 : 1.8} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {showSettings && (
        <Modal title="Pengaturan Perusahaan" onClose={() => setShowSettings(false)}>
          <Field label="Jam Masuk Maksimal" hint="Batas toleransi jam masuk. Masuk sebelum atau tepat jam ini dianggap tidak telat; lewat dari ini otomatis kena potongan telat.">
            <input type="time" style={inputStyle} value={settings.jamMasukMaksimal} onChange={(e) => setSettings({ ...settings, jamMasukMaksimal: e.target.value })} />
          </Field>
          <Button onClick={async () => { await persistSettings(settings); setShowSettings(false); }} style={{ width: "100%", justifyContent: "center" }}>
            <Check size={15} /> Simpan Pengaturan
          </Button>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   DASHBOARD
--------------------------------------------------------- */
function Dashboard({ rows, totals, attThisPeriod, employees }) {
  const chartData = rows.map((r) => ({ name: r.nama.split(" ")[0], gaji: r.totalGaji }));
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const hadirHariIni = employees.filter((e) => (attThisPeriod[e.id] || {})[todayStr]?.status === "Hadir").length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <StatCard icon={TrendingUp} label="Total Pendapatan" value={rupiah(totals.pendapatan)} color={T.income} bg={T.incomeSoft} />
        <StatCard icon={TrendingDown} label="Total Potongan" value={rupiah(totals.potongan)} color={T.deduct} bg={T.deductSoft} />
        <StatCard icon={Wallet} label="Total Gaji Dibayar" value={rupiah(totals.gaji)} color={T.navy} bg={T.navySoft} span />
        <StatCard icon={Users} label="Karyawan" value={String(employees.length)} color={T.amber} bg={T.amberSoft} />
        <StatCard icon={CalendarCheck} label="Hadir Hari Ini" value={`${hadirHariIni}/${employees.length}`} color={T.income} bg={T.incomeSoft} />
      </div>

      {rows.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 10px 6px", marginBottom: 14 }}>
          <div 
