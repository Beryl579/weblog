# Weblog Pembelajaran Interaktif DDK

Media pembelajaran berbasis web untuk mata pelajaran **Dasar-Dasar Ketenagalistrikan (DDK)**
kelas X TITL — SMK Swasta TR 2 Sinar Husni Medan.

Aplikasi ini dibangun dengan **Google Apps Script + HTML Service + Google Sheets** (tanpa
framework, tanpa npm), dengan tambahan server Node kecil untuk pengembangan di komputer lokal.

## Tiga cara menjalankan

| Cara | Untuk apa | Catatan |
|------|-----------|---------|
| **A. Apps Script Web App** | **versi resmi yang dipakai siswa** | Backend asli: Sheets sebagai database. Dapat URL publik `script.google.com/macros/s/…/exec`. Panduan: [`Weblog-DDK/README.md`](Weblog-DDK/README.md#deploy-ke-google-apps-script-gas-web-app) |
| **B. GitHub Pages (statis)** | demo & pratinjau cepat lewat link `…github.io` | Tanpa server. Login & progres jalan di browser pengunjung (localStorage), tidak terhubung ke data asli |
| **C. Server lokal** | pengembangan sehari-hari | `cd local && node server.js` → <http://localhost:3000> |

### Akun demo (berlaku di ketiga cara)

| Role | Username | Password |
|------|----------|----------|
| Siswa | `2024001` | `siswa123` |
| Guru | `GURU001` | `guru123` |
| Admin | `ADMIN001` | `admin123` |

## Tentang versi statis (GitHub Pages)

GitHub Pages hanya menyajikan berkas statis — ia **tidak bisa** menjalankan berkas `.gs`
(butuh runtime Apps Script) maupun `local/server.js` (butuh Node). Karena itu versi Pages
adalah hasil *build* yang dibuat dari view GAS yang sama:

```
local/build-static.js   ← generator
        ↓
index.html  dashboard/index.html  guru/index.html  ddk-demo.js
```

`ddk-demo.js` adalah backend tiruan berbasis `localStorage`. Aturan gating kuis tidak ditulis
ulang di sana: ia memakai ulang `local/progress_api.js`, sehingga aturannya tetap sama dengan
server lokal dan Apps Script. Datanya hanya ada di browser masing-masing pengunjung.

Regenerasi setelah mengubah `Weblog-DDK/Views/`:

```bash
node local/build-static.js
```

> ⚠️ Berkas `index.html`, `dashboard/`, `guru/`, dan `ddk-demo.js` di root adalah **hasil build** —
> jangan diedit langsung, perubahannya akan tertimpa. Ubah sumbernya di `Weblog-DDK/Views/`.

Setelan Pages: **Settings → Pages → Source: Deploy from a branch → `main` → `/ (root)`**.

## Struktur repo

```
├── index.html, dashboard/, guru/   ← hasil build versi statis (GitHub Pages)
├── ddk-demo.js                     ← backend tiruan untuk versi statis
├── Weblog-DDK/                     ← proyek Google Apps Script (sumber utama)
│   ├── *.gs                        ← router, auth, progres, setup Sheet
│   ├── Views/                      ← Login, DashboardSiswa, DashboardGuru
│   ├── Components/                 ← Toast
│   └── Styles/Main.html            ← design system (CSS murni, ekstensi .html karena batasan GAS)
├── local/                          ← server Node untuk pengembangan
│   ├── server.js                   ← server lokal + polyfill google.script.run
│   ├── progress_api.js             ← logika progres & gating (dipakai bersama)
│   ├── build-static.js             ← generator versi statis
│   └── static_backend.js           ← backend tiruan (localStorage)
├── PLAN.md                         ← spesifikasi awal proyek
└── todo.MD, todo2.md               ← catatan rencana
```

## Keamanan & data

- `local/db.json` (data siswa + hash password + progres) **tidak ikut ke Git** — lihat `.gitignore`.
  Server lokal membuatnya otomatis saat pertama dijalankan.
- Dokumen proposal skripsi juga tidak diikutkan.
- Versi statis tidak menyimpan apa pun di server; seluruh data ada di `localStorage` pengunjung.
