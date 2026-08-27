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
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, marginBottom: 8, paddingLeft: 6 }}>GAJI PER KARYAWAN</div>
          <ResponsiveContainer width="100%" height={Math.max(140, rows.length * 34)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={T.border} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: T.inkSoft, fontFamily: "IBM Plex Sans" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => rupiah(v)} contentStyle={{ fontSize: 12, fontFamily: "IBM Plex Sans", borderRadius: 8, border: `1px solid ${T.border}` }} />
              <Bar dataKey="gaji" fill={T.navy} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, marginBottom: 10 }}>RINGKASAN POTONGAN BULAN INI</div>
        {rows.length === 0 && <EmptyNote text="Belum ada karyawan." />}
        {rows.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12.5 }}>
            <span>{r.nama}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: r.totalPotongan > 0 ? T.deduct : T.inkSoft }}>{rupiah(r.totalPotongan)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg, span }) {
  return (
    <div style={{ gridColumn: span ? "1 / -1" : "auto", background: bg, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 0.2 }}>{label.toUpperCase()}</span>
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, fontWeight: 600, color: T.ink }}>{value}</div>
    </div>
  );
}

/* ---------------------------------------------------------
   KARYAWAN
--------------------------------------------------------- */
function Karyawan({ employees, persistEmployees }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankEmp());

  function blankEmp() {
    return { id: uid(), nama: "", gajiPokok: 0, uangMingguan: 0, rateLemburPerJam: 0, potonganAlpaPerHari: 0, potonganSetengahHari: 0, potonganTelatMode: "menit", potonganTelatRate: 0 };
  }
  function openNew() { setForm(blankEmp()); setEditing(null); setShowForm(true); }
  function openEdit(emp) { setForm({ ...blankEmp(), ...emp }); setEditing(emp.id); setShowForm(true); }

  async function save() {
    if (!form.nama.trim()) return;
    const next = editing ? employees.map((e) => (e.id === editing ? form : e)) : [...employees, form];
    await persistEmployees(next);
    setShowForm(false);
  }
  async function remove(id) { await persistEmployees(employees.filter((e) => e.id !== id)); }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft }}>DAFTAR KARYAWAN ({employees.length})</div>
        <Button onClick={openNew}><Plus size={14} /> Tambah</Button>
      </div>

      {employees.length === 0 && <EmptyNote text="Belum ada karyawan. Tambahkan dulu." />}

      {employees.map((e) => (
        <div key={e.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{e.nama}</div>
            <div style={{ fontSize: 11.5, color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
              Pokok {rupiah(e.gajiPokok)} · Telat {rupiah(e.potonganTelatRate || 0)}/{e.potonganTelatMode === "jam" ? "jam" : "menit"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => openEdit(e)} style={iconBtnStyle}><Pencil size={14} color={T.inkSoft} /></button>
            <button onClick={() => remove(e.id)} style={iconBtnStyle}><Trash2 size={14} color={T.deduct} /></button>
          </div>
        </div>
      ))}

      {showForm && (
        <Modal title={editing ? "Edit Karyawan" : "Tambah Karyawan"} onClose={() => setShowForm(false)}>
          <Field label="Nama Karyawan">
            <input style={inputStyle} value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="cth. Budi Santoso" />
          </Field>
          <Field label="Gaji Pokok / bulan" hint="Juga dipakai sebagai basis default potongan alpa (÷26 hari)">
            <MoneyInput value={form.gajiPokok} onChange={(v) => setForm({ ...form, gajiPokok: v })} />
          </Field>
          <Field label="Uang Mingguan (per minggu)" hint="Dikali otomatis dengan jumlah hari Sabtu di bulan berjalan">
            <MoneyInput value={form.uangMingguan} onChange={(v) => setForm({ ...form, uangMingguan: v })} />
          </Field>

          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.amber, margin: "16px 0 8px" }}>SETTING LEMBURAN</div>
          <Field label="Rate Lembur / jam" hint="Dikali langsung dengan jam lembur yang diinput di tab Absensi">
            <MoneyInput value={form.rateLemburPerJam} onChange={(v) => setForm({ ...form, rateLemburPerJam: v })} />
          </Field>

          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.deduct, margin: "16px 0 8px" }}>SETTING POTONGAN</div>
          <Field label="Potongan Alpa / hari" hint={`Default kalau dikosongkan: ${rupiah(Math.round((form.gajiPokok || 0) / HARI_KERJA_STANDAR))} (gaji pokok ÷ 26)`}>
            <MoneyInput value={form.potonganAlpaPerHari} onChange={(v) => setForm({ ...form, potonganAlpaPerHari: v })} />
          </Field>
          <Field label="Potongan Izin Pulang Setengah Hari" hint="Default kalau dikosongkan: setengah dari potongan alpa harian">
            <MoneyInput value={form.potonganSetengahHari} onChange={(v) => setForm({ ...form, potonganSetengahHari: v })} />
          </Field>
          <Field label="Hitung Potongan Telat Per">
            <div style={{ display: "flex", gap: 6 }}>
              {[{ id: "menit", label: "Per Menit" }, { id: "jam", label: "Per Jam" }].map((opt) => (
                <button key={opt.id} onClick={() => setForm({ ...form, potonganTelatMode: opt.id })} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${form.potonganTelatMode === opt.id ? T.navy : T.border}`, background: form.potonganTelatMode === opt.id ? T.navy : "#fff", color: form.potonganTelatMode === opt.id ? "#fff" : T.ink }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label={`Potongan Telat / ${form.potonganTelatMode === "jam" ? "jam" : "menit"}`} hint="Dihitung otomatis dari selisih Jam Masuk terhadap Jam Masuk Maksimal di Pengaturan">
            <MoneyInput value={form.potonganTelatRate} onChange={(v) => setForm({ ...form, potonganTelatRate: v })} />
          </Field>

          <Button onClick={save} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
            <Check size={15} /> Simpan
          </Button>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   ABSENSI — tab Absen / Lembur terpisah, telat otomatis dari jam masuk
--------------------------------------------------------- */
const STATUS_OPTS = [
  { id: "Hadir", color: T.income },
  { id: "Izin", color: T.navy },
  { id: "Alpa", color: T.deduct },
];

function Absensi({ employees, year, month, pKey, attendance, persistAttendance, settings, rows }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(() => {
    const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth();
    return isCurrentMonth ? todayStr : `${pKey}-01`;
  });
  const [activeEmp, setActiveEmp] = useState(null);
  const dim = daysInMonth(year, month);
  const recToday = attendance[pKey] || {};

  function currentTimeStr() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  function openLog(emp) {
    const existing = (recToday[emp.id] || {})[date];
    setActiveEmp({
      emp,
      innerTab: "absen",
      editingAbsen: !(existing && existing.status === "Hadir"), // kalau sudah hadir, langsung tampilkan mode ringkas
      status: existing?.status || "Hadir",
      jamMasuk: existing?.jamMasuk || currentTimeStr(),
      pulangCepat: existing?.pulangCepat || false,
      jamPulang: existing?.jamPulang || currentTimeStr(),
      lembur: existing?.lembur || 0,
      keterangan: existing?.keterangan || "",
    });
  }
  async function saveRecord(patch) {
    const next = { ...attendance };
    if (!next[pKey]) next[pKey] = {};
    if (!next[pKey][activeEmp.emp.id]) next[pKey][activeEmp.emp.id] = {};
    const prev = next[pKey][activeEmp.emp.id][date] || {};
    next[pKey][activeEmp.emp.id][date] = { ...prev, ...patch };
    await persistAttendance(next);
    return next[pKey][activeEmp.emp.id][date];
  }
  async function saveAbsen() {
    const saved = await saveRecord({
      status: activeEmp.status,
      jamMasuk: activeEmp.jamMasuk,
      pulangCepat: activeEmp.status === "Hadir" ? activeEmp.pulangCepat : false,
      jamPulang: activeEmp.jamPulang,
      keterangan: activeEmp.status === "Izin" ? activeEmp.keterangan : "",
    });
    setActiveEmp({ ...activeEmp, editingAbsen: !(saved.status === "Hadir") });
  }
  async function saveLembur() {
    await saveRecord({ lembur: Number(activeEmp.lembur || 0) });
    setActiveEmp(null);
  }
  async function tandaiSetengahHari() {
    await saveRecord({ pulangCepat: true, jamPulang: activeEmp.jamPulang });
    setActiveEmp({ ...activeEmp, pulangCepat: true });
  }
  async function batalkanSetengahHari() {
    await saveRecord({ pulangCepat: false });
    setActiveEmp({ ...activeEmp, pulangCepat: false });
  }
  async function clearLog() {
    const next = { ...attendance };
    if (next[pKey]?.[activeEmp.emp.id]) { delete next[pKey][activeEmp.emp.id][date]; await persistAttendance(next); }
    setActiveEmp(null);
  }

  function describeLog(log) {
    if (!log) return null;
    if (log.status === "Hadir" && log.pulangCepat) return { text: `Setengah Hari · ${log.jamMasuk}–${log.jamPulang}`, color: T.amber };
    if (log.status === "Hadir") {
      const telat = lateMinutes(log.jamMasuk, settings.jamMasukMaksimal);
      return { text: `Hadir · ${log.jamMasuk}${telat > 0 ? ` · telat ${telat}mnt` : ""}${log.lembur ? ` · +${log.lembur}j lembur` : ""}`, color: telat > 0 ? T.amber : T.income };
    }
    if (log.status === "Izin") return { text: `Izin${log.keterangan ? ` · ${log.keterangan}` : ""}`, color: T.navy };
    return { text: "Alpa", color: T.deduct };
  }

  const livePreviewTelat = activeEmp && activeEmp.status === "Hadir" ? lateMinutes(activeEmp.jamMasuk, settings.jamMasukMaksimal) : 0;
  const existingRecord = activeEmp ? (recToday[activeEmp.emp.id] || {})[date] : null;
  const empRow = activeEmp ? rows.find((r) => r.id === activeEmp.emp.id) : null;

  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, marginBottom: 10 }}>PILIH TANGGAL</div>
      <input type="date" value={date} min={`${pKey}-01`} max={`${pKey}-${String(dim).padStart(2, "0")}`} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, marginBottom: 8 }}>KETUK NAMA UNTUK INPUT ABSEN</div>
      {employees.length === 0 && <EmptyNote text="Tambahkan karyawan dulu di tab Karyawan." />}

      {employees.map((e) => {
        const log = (recToday[e.id] || {})[date];
        const desc = describeLog(log);
        return (
          <button key={e.id} onClick={() => openLog(e)} style={{ width: "100%", textAlign: "left", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `4px solid ${desc ? desc.color : T.border}` }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: T.ink }}>{e.nama}</span>
            {desc ? (
              <span style={{ fontSize: 11.5, fontFamily: "'IBM Plex Mono', monospace", color: desc.color, textAlign: "right" }}>{desc.text}</span>
            ) : (
              <span style={{ fontSize: 12, color: T.inkSoft }}>belum diisi</span>
            )}
          </button>
        );
      })}

      {activeEmp && (
        <Modal title={activeEmp.emp.nama} onClose={() => setActiveEmp(null)}>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12, fontFamily: "'IBM Plex Mono', monospace" }}>{date}</div>

          {/* Segmented: Input Absen / Input Lembur */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            <button onClick={() => setActiveEmp({ ...activeEmp, innerTab: "absen" })} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${activeEmp.innerTab === "absen" ? T.navy : T.border}`, background: activeEmp.innerTab === "absen" ? T.navy : "#fff", color: activeEmp.innerTab === "absen" ? "#fff" : T.ink }}>
              Input Absen
            </button>
            <button onClick={() => setActiveEmp({ ...activeEmp, innerTab: "lembur" })} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${activeEmp.innerTab === "lembur" ? T.navy : T.border}`, background: activeEmp.innerTab === "lembur" ? T.navy : "#fff", color: activeEmp.innerTab === "lembur" ? "#fff" : T.ink }}>
              Input Lembur
            </button>
          </div>

          {activeEmp.innerTab === "absen" && (
            <>
              {!activeEmp.editingAbsen ? (
                /* Sudah absen Hadir hari ini -> tampilkan ringkas + tombol izin pulang setengah hari */
                <div>
                  <div style={{ background: T.incomeSoft, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.income, marginBottom: 2 }}>SUDAH ABSEN MASUK</div>
                    <div style={{ fontSize: 13, color: T.ink }}>Jam Masuk {activeEmp.jamMasuk}</div>
                    {lateMinutes(activeEmp.jamMasuk, settings.jamMasukMaksimal) > 0 && (
                      <div style={{ fontSize: 12, color: T.deduct, marginTop: 2 }}>Telat {lateMinutes(activeEmp.jamMasuk, settings.jamMasukMaksimal)} menit dari batas {settings.jamMasukMaksimal}</div>
                    )}
                  </div>

                  {!activeEmp.pulangCepat ? (
                    <Button onClick={tandaiSetengahHari} variant="amber" style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}>
                      <LogOut size={15} /> Izin Pulang Setengah Hari
                    </Button>
                  ) : (
                    <div style={{ border: `1.5px solid ${T.amber}`, background: T.amberSoft, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.amber }}>SETENGAH HARI AKTIF</span>
                        <button onClick={batalkanSetengahHari} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: T.amber, fontSize: 11.5, fontWeight: 600 }}><Undo2 size={12} /> Batalkan</button>
                      </div>
                      <Field label="Jam Pulang">
                        <input type="time" style={inputStyle} value={activeEmp.jamPulang} onChange={async (e) => { const jp = e.target.value; setActiveEmp({ ...activeEmp, jamPulang: jp }); await saveRecord({ jamPulang: jp }); }} />
                      </Field>
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 4 }}>
                    Kalau tidak ditandai, otomatis dihitung kerja penuh sehari.
                  </div>
                  <button onClick={() => setActiveEmp({ ...activeEmp, editingAbsen: true })} style={{ background: "none", border: "none", color: T.inkSoft, fontSize: 12, textDecoration: "underline", cursor: "pointer", padding: "6px 0" }}>
                    Ubah data absen
                  </button>
                </div>
              ) : (
                /* Form input absen biasa */
                <div>
                  <Field label="Status Kehadiran">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {STATUS_OPTS.map((s) => (
                        <button key={s.id} onClick={() => setActiveEmp({ ...activeEmp, status: s.id })} style={{ padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${activeEmp.status === s.id ? s.color : T.border}`, background: activeEmp.status === s.id ? s.color : "#fff", color: activeEmp.status === s.id ? "#fff" : T.ink }}>
                          {s.id}
                        </button>
                      ))}
                    </div>
                  </Field>

                  {activeEmp.status === "Hadir" && (
                    <>
                      <Field label="Jam Masuk">
                        <input type="time" style={inputStyle} value={activeEmp.jamMasuk} onChange={(e) => setActiveEmp({ ...activeEmp, jamMasuk: e.target.value })} />
                      </Field>
                      {livePreviewTelat > 0 && (
                        <div style={{ fontSize: 12, color: T.deduct, marginTop: -8, marginBottom: 14 }}>
                          Telat {livePreviewTelat} menit dari batas {settings.jamMasukMaksimal} (potongan otomatis dihitung)
                        </div>
                      )}
                    </>
                  )}
                  {activeEmp.status === "Izin" && (
                    <Field label="Keterangan Izin">
                      <input style={inputStyle} value={activeEmp.keterangan} onChange={(e) => setActiveEmp({ ...activeEmp, keterangan: e.target.value })} placeholder="cth. sakit, acara keluarga, dll" />
                    </Field>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <Button onClick={saveAbsen} style={{ flex: 1, justifyContent: "center" }}><Check size={15} /> Simpan Absen</Button>
                    {existingRecord && <Button onClick={clearLog} variant="ghost" style={{ justifyContent: "center" }}>Hapus</Button>}
                  </div>
                </div>
              )}
            </>
          )}

          {activeEmp.innerTab === "lembur" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Flame size={14} color={T.navy} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.navy }}>INPUT LEMBUR (terpisah dari absen)</span>
              </div>
              <Field label="Jam Lembur" hint={`Rate karyawan ini: ${rupiah(empRow?.rateLemburPerJam || 0)}/jam`}>
                <input type="number" min={0} step={0.5} style={inputStyle} value={activeEmp.lembur || ""} onChange={(e) => setActiveEmp({ ...activeEmp, lembur: e.target.value === "" ? 0 : Number(e.target.value) })} placeholder="0" />
              </Field>
              <Button onClick={saveLembur} style={{ width: "100%", justifyContent: "center" }}><Check size={15} /> Simpan Lembur</Button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   KASBON
--------------------------------------------------------- */
function Kasbon({ employees, kasbonTx, persistKasbon, year, month, rows }) {
  const [activeEmp, setActiveEmp] = useState(null);
  const [form, setForm] = useState({ tanggal: new Date().toISOString().slice(0, 10), nominal: 0, catatan: "" });

  function openFor(emp) { setActiveEmp(emp); setForm({ tanggal: new Date().toISOString().slice(0, 10), nominal: 0, catatan: "" }); }

  async function addTx() {
    if (!form.nominal) return;
    const next = { ...kasbonTx };
    const list = next[activeEmp.id] ? [...next[activeEmp.id]] : [];
    list.unshift({ id: uid(), ...form });
    next[activeEmp.id] = list;
    await persistKasbon(next);
    setForm({ tanggal: new Date().toISOString().slice(0, 10), nominal: 0, catatan: "" });
  }
  async function removeTx(empId, txId) {
    const next = { ...kasbonTx };
    next[empId] = (next[empId] || []).filter((t) => t.id !== txId);
    await persistKasbon(next);
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, marginBottom: 10 }}>KETUK NAMA UNTUK CATAT KASBON</div>
      {employees.length === 0 && <EmptyNote text="Tambahkan karyawan dulu di tab Karyawan." />}

      {employees.map((e) => {
        const r = rows.find((x) => x.id === e.id);
        return (
          <button key={e.id} onClick={() => openFor(e)} style={{ width: "100%", textAlign: "left", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: T.ink }}>{e.nama}</span>
            <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: r?.kasbonBerjalan > 0 ? T.deduct : T.inkSoft, fontWeight: 600 }}>
              {rupiah(r?.kasbonBerjalan || 0)} berjalan
            </span>
          </button>
        );
      })}

      {activeEmp && (
        <Modal title={`Kasbon · ${activeEmp.nama}`} onClose={() => setActiveEmp(null)}>
          <Field label="Tanggal">
            <input type="date" style={inputStyle} value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
          </Field>
          <Field label="Nominal">
            <MoneyInput value={form.nominal} onChange={(v) => setForm({ ...form, nominal: v })} />
          </Field>
          <Field label="Catatan (opsional)">
            <input style={inputStyle} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} placeholder="cth. untuk beli obat" />
          </Field>
          <Button onClick={addTx} style={{ width: "100%", justifyContent: "center", marginBottom: 16 }}>
            <Plus size={15} /> Catat Kasbon
          </Button>

          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.inkSoft, marginBottom: 8 }}>RIWAYAT KASBON</div>
          {(kasbonTx[activeEmp.id] || []).length === 0 && <EmptyNote text="Belum ada catatan kasbon." />}
          {(kasbonTx[activeEmp.id] || []).map((tx) => {
            const inPeriod = isDateInPeriod(tx.tanggal, year, month);
            return (
              <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: T.deduct }}>{rupiah(tx.nominal)}</div>
                  <div style={{ fontSize: 11, color: T.inkSoft }}>{tx.tanggal}{tx.catatan ? ` · ${tx.catatan}` : ""}{inPeriod ? " · masuk potongan bulan ini" : ""}</div>
                </div>
                <button onClick={() => removeTx(activeEmp.id, tx.id)} style={iconBtnStyle}><Trash2 size={13} color={T.deduct} /></button>
              </div>
            );
          })}
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   GAJI
--------------------------------------------------------- */
function Gaji({ rows, pKey, monthLabel, payroll, persistPayroll }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);

  function openEdit(r) {
    setForm({
      gajiPokok: r.gajiPokok,
      uangMingguan: r.uangMingguan,
      jumlahMinggu: r.jumlahMinggu,
      lemburanManual: r.lemburan,
      rateLemburPerJam: r.rateLemburPerJam,
      potonganAlpaPerHari: r.potonganAlpaPerHari,
      potonganSetengahHari: r.potonganSetengahHariRate,
      potonganTelatMode: r.potonganTelatMode,
      potonganTelatRate: r.potonganTelatRate,
      kasbonManual: r.kasbon,
    });
    setEditing(r);
  }

  async function save() {
    const next = { ...payroll };
    if (!next[pKey]) next[pKey] = {};
    next[pKey][editing.id] = { ...form };
    await persistPayroll(next);
    setEditing(null);
  }

  function downloadSlip(r) {
    const data = [
      ["SLIP GAJI", ""],
      ["Nama", r.nama],
      ["Periode", monthLabel],
      ["", ""],
      ["PENDAPATAN", ""],
      ["Gaji Pokok", r.gajiPokok],
      [`Uang Mingguan (${rupiah(r.uangMingguan)} x ${r.jumlahMinggu} minggu)`, r.totalUangMingguan],
      [`Lemburan (${r.totalJamLembur} jam x ${rupiah(r.rateLemburPerJam)})`, r.lemburan],
      ["Gaji Bruto (Total Pendapatan)", r.gajiBruto],
      ["", ""],
      ["POTONGAN", ""],
      [`Potongan Alpa (${r.alpaHari} hari x ${rupiah(r.potonganAlpaPerHari)})`, r.potonganAlpa],
      [`Potongan Setengah Hari (${r.setengahHariCount}x)`, r.potonganSetengahHari],
      [`Potongan Telat (${r.telatUnitsTotal} ${r.potonganTelatMode === "jam" ? "jam" : "menit"} x ${rupiah(r.potonganTelatRate)})`, r.potonganTelat],
      ["Potongan Kasbon", r.kasbon],
      ["Total Potongan", r.totalPotongan],
      ["", ""],
      ["TOTAL GAJI DITERIMA (Netto)", r.totalGaji],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 36 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Slip Gaji");
    XLSX.writeFile(wb, `Slip-Gaji-${r.nama.replace(/\s+/g, "_")}-${pKey}.xlsx`);
  }

  function downloadAll() {
    const wb = XLSX.utils.book_new();
    const summary = [["Nama", "Gaji Pokok", "Uang Mingguan Total", "Jam Lembur", "Lemburan", "Gaji Bruto", "Alpa (hr)", "Pot. Alpa", "Setengah Hari", "Pot. Setengah Hari", "Telat", "Pot. Telat", "Pot. Kasbon", "Total Potongan", "Total Gaji"]];
    rows.forEach((r) => {
      summary.push([r.nama, r.gajiPokok, r.totalUangMingguan, r.totalJamLembur, r.lemburan, r.gajiBruto, r.alpaHari, r.potonganAlpa, r.setengahHariCount, r.potonganSetengahHari, r.telatUnitsTotal, r.potonganTelat, r.kasbon, r.totalPotongan, r.totalGaji]);
    });
    const ws = XLSX.utils.aoa_to_sheet(summary);
    ws["!cols"] = summary[0].map(() => ({ wch: 15 }));
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Gaji");
    XLSX.writeFile(wb, `Rekap-Gaji-${pKey}.xlsx`);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft }}>GAJI · {monthLabel.toUpperCase()}</div>
        {rows.length > 0 && <Button variant="subtle" onClick={downloadAll}><Download size={13} /> Semua</Button>}
      </div>

      {rows.length === 0 && <EmptyNote text="Belum ada karyawan." />}

      {rows.map((r) => (
        <div key={r.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{r.nama}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 15, color: T.navy }}>{rupiah(r.totalGaji)}</div>
          </div>

          <LedgerLine label="Gaji Pokok" value={r.gajiPokok} kind="income" />
          <LedgerLine label={`Uang Mingguan (${r.jumlahMinggu}x)`} value={r.totalUangMingguan} kind="income" />
          <LedgerLine label={`Lemburan (${r.totalJamLembur}j x ${rupiah(r.rateLemburPerJam)})`} value={r.lemburan} kind="income" />
          <LedgerLine label="Gaji Bruto (total)" value={r.gajiBruto} kind="income" bold />
          <LedgerLine label={`Potongan Alpa (${r.alpaHari}h)`} value={-r.potonganAlpa} kind="deduct" />
          {r.potonganSetengahHari > 0 && <LedgerLine label={`Potongan Setengah Hari (${r.setengahHariCount}x)`} value={-r.potonganSetengahHari} kind="deduct" />}
          {r.potonganTelat > 0 && <LedgerLine label={`Potongan Telat (${r.telatUnitsTotal}${r.potonganTelatMode === "jam" ? "j" : "mnt"})`} value={-r.potonganTelat} kind="deduct" />}
          <LedgerLine label="Potongan Kasbon" value={-r.kasbon} kind="deduct" />

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Button variant="ghost" onClick={() => openEdit(r)} style={{ flex: 1, justifyContent: "center" }}><Pencil size={13} /> Edit</Button>
            <Button variant="subtle" onClick={() => downloadSlip(r)} style={{ flex: 1, justifyContent: "center" }}><Download size={13} /> Unduh Slip</Button>
          </div>
        </div>
      ))}

      {editing && form && (
        <Modal title={`Edit Gaji · ${editing.nama}`} onClose={() => setEditing(null)}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.income, marginBottom: 8 }}>PENDAPATAN</div>
          <Field label="Gaji Pokok"><MoneyInput value={form.gajiPokok} onChange={(v) => setForm({ ...form, gajiPokok: v })} /></Field>
          <Field label="Uang Mingguan (per minggu)"><MoneyInput value={form.uangMingguan} onChange={(v) => setForm({ ...form, uangMingguan: v })} /></Field>
          <Field label="Jumlah Minggu Bulan Ini" hint="Otomatis dari jumlah hari Sabtu di bulan ini">
            <input type="number" min={1} max={6} style={inputStyle} value={form.jumlahMinggu} onChange={(e) => setForm({ ...form, jumlahMinggu: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Rate Lembur / jam"><MoneyInput value={form.rateLemburPerJam} onChange={(v) => setForm({ ...form, rateLemburPerJam: v })} /></Field>
          <Field label="Lemburan (total bulan ini)" hint={`Otomatis dari jam lembur di tab Absensi x rate: ${rupiah(editing.lemburanAuto)}`}>
            <MoneyInput value={form.lemburanManual} onChange={(v) => setForm({ ...form, lemburanManual: v })} />
          </Field>
          <div style={{ fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace", color: T.inkSoft, marginBottom: 14 }}>
            Gaji Bruto (otomatis) = {rupiah(form.gajiPokok + form.uangMingguan * form.jumlahMinggu + form.lemburanManual)}
          </div>

          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.deduct, margin: "14px 0 8px" }}>POTONGAN</div>
          <Field label="Potongan Alpa / hari"><MoneyInput value={form.potonganAlpaPerHari} onChange={(v) => setForm({ ...form, potonganAlpaPerHari: v })} /></Field>
          <Field label="Potongan Izin Setengah Hari" hint={`Kejadian bulan ini: ${editing.setengahHariCount}x`}>
            <MoneyInput value={form.potonganSetengahHari} onChange={(v) => setForm({ ...form, potonganSetengahHari: v })} />
          </Field>
          <Field label="Hitung Potongan Telat Per">
            <div style={{ display: "flex", gap: 6 }}>
              {[{ id: "menit", label: "Per Menit" }, { id: "jam", label: "Per Jam" }].map((opt) => (
                <button key={opt.id} onClick={() => setForm({ ...form, potonganTelatMode: opt.id })} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${form.potonganTelatMode === opt.id ? T.navy : T.border}`, background: form.potonganTelatMode === opt.id ? T.navy : "#fff", color: form.potonganTelatMode === opt.id ? "#fff" : T.ink }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label={`Potongan Telat / ${form.potonganTelatMode === "jam" ? "jam" : "menit"}`} hint={`Telat bulan ini: ${editing.telatMenitTotal} menit`}>
            <MoneyInput value={form.potonganTelatRate} onChange={(v) => setForm({ ...form, potonganTelatRate: v })} />
          </Field>
          <Field label="Potongan Kasbon" hint="Otomatis dari tab Kasbon bulan ini, bisa ditimpa manual">
            <MoneyInput value={form.kasbonManual} onChange={(v) => setForm({ ...form, kasbonManual: v })} />
          </Field>

          <Button onClick={save} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}><Check size={15} /> Simpan</Button>
        </Modal>
      )}
    </div>
  );
}

function LedgerLine({ label, value, kind, bold }) {
  const color = kind === "income" ? T.income : T.deduct;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0 4px 10px", borderLeft: `2px solid ${kind === "income" ? T.incomeSoft : T.deductSoft}`, marginBottom: 2 }}>
      <span style={{ fontSize: 12.5, color: bold ? T.ink : T.inkSoft, fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace", fontWeight: bold ? 700 : 500, color }}>
        {value < 0 ? "-" : ""}{rupiah(Math.abs(value))}
      </span>
    </div>
  );
}
