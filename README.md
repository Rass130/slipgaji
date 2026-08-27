# Buku Gaji — Setup & Deploy

Aplikasi payroll + absensi karyawan, sudah pakai login (email/password + Google) dan data
otomatis terpisah per akun (jadi satu akun = satu perusahaan/organisasi).

## 1. Buat project Firebase (gratis)

1. Buka https://console.firebase.google.com → **Add project** → ikuti langkahnya.
2. Di dashboard project, klik ikon **`</>`** (Web) untuk daftarkan aplikasi web → beri nama bebas.
3. Firebase akan menampilkan `firebaseConfig` (apiKey, authDomain, dst). **Copy semua isinya.**
4. Buka `src/firebase.js` di project ini, ganti bagian `firebaseConfig` dengan punya kamu.

## 2. Aktifkan Authentication

1. Di Firebase Console → menu **Build > Authentication** → tab **Sign-in method**.
2. Aktifkan provider **Email/Password**.
3. Aktifkan juga provider **Google** (isi nama support email saat diminta).

## 3. Aktifkan Firestore Database

1. Menu **Build > Firestore Database** → **Create database** → pilih mode **Production**.
2. Setelah aktif, buka tab **Rules**, ganti isinya dengan ini (supaya tiap akun cuma bisa
   akses data miliknya sendiri), lalu **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /orgs/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## 4. Jalankan di komputer

```bash
npm install
npm run dev
```

Buka link yang muncul di terminal (biasanya `http://localhost:5173`). Coba daftar akun baru,
lalu login — data yang kamu input akan otomatis tersimpan ke akun itu saja.

## 5. Deploy supaya online (pilih salah satu, paling gampang: Firebase Hosting)

### Opsi A — Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# pilih project Firebase yang sama, public directory: dist, single-page app: Yes
npm run build
firebase deploy
```
Selesai — kamu dapat link `https://nama-project.web.app` yang bisa diakses siapa saja,
dan tiap orang/perusahaan yang daftar akun baru otomatis dapat data terpisah sendiri.

### Opsi B — Vercel / Netlify
Upload folder project ini ke GitHub, lalu import repo-nya di vercel.com atau netlify.com.
Build command: `npm run build`, output folder: `dist`. Beres, tinggal deploy otomatis tiap
kamu update kode.

## Struktur data per akun

Setiap akun (uid dari Firebase Auth) punya "folder" sendiri di Firestore:
`orgs/{uid}/data/employees`, `orgs/{uid}/data/attendance-all`, dst. Jadi kalau ada 5 perusahaan
daftar, datanya otomatis kepisah rapi tanpa nyampur satu sama lain — tidak perlu setup manual.

## Catatan

- Paket gratis Firebase (Spark plan) sudah lebih dari cukup untuk puluhan perusahaan kecil
  memakai aplikasi ini sekaligus.
- Kalau nanti mau tambah fitur "satu perusahaan bisa login banyak orang/kasir", tinggal bilang
  ke Claude — strukturnya tinggal diubah supaya beberapa akun bisa mengakses `orgs/{orgId}`
  yang sama (bukan satu akun = satu org seperti sekarang).
  
