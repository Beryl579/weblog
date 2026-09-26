# Weblog DDK — Aplikasi Pembelajaran Dasar-Dasar Ketenagalistrikan

Web app pembelajaran interaktif untuk mata pelajaran **Dasar-Dasar Ketenagalistrikan (DDK)**
Kelas X TITL SMK Swasta TR 2 Sinar Husni Medan.

## Alur Aplikasi

```
Siswa akses web → login / daftar (tanpa kode akses, pilih kelas)
  → Dashboard siswa (SPA)
      Materi 1 → Kuis 1 (lulus ≥75) → Materi 2 → Kuis 2 → ... → Materi 4
      → Ujian Akhir (20 soal, terbuka setelah lulus kuis Materi 4)
  → Progres & nilai terpantau di Dashboard Guru (akses username+password guru)
```

## Bahasa Visual

Layout memakai pola sidebar gelap + hero + kartu statistik, tetapi metafora visualnya milik DDK,
bukan spreadsheet: widget progres berbentuk **Panel Distribusi** (busbar + MCB Q1–Q5;
lampu menyala = materi/ujian lulus) dan kartu **Lembar Ujian** bergaya plat nama peralatan.
Logo adalah petir dalam kotak hijau. Sengaja **tanpa** formula bar `fx`, tanpa kolom A/B,
tanpa font monospace tabel — itu ciri template kursus Excel dan tidak cocok untuk mapel kelistrikan.

Setiap halaman materi dibuka dengan gambar **banner lebar** di atas kartu (bukan gambar kecil
di samping teks), dan **kuis/ujian tampil sebagai halaman penuh** (`#/kuis/kuis1` … `#/kuis/ujian`)
berisi soal, navigasi nomor soal, pembahasan, dan halaman hasil + review jawaban — bukan popup.

## Halaman (3 saja — sisanya SPA di dalam Dashboard)

| URL | Isi |
|-----|-----|
| `/?page=login` | Login & Daftar siswa (tab ganda) |
| `/?page=dashboard` | SPA siswa: dashboard, 4 materi (banner + blok kaya + glosarium), kuis & ujian akhir sebagai halaman penuh |
| `/?page=guru` | SPA guru: gate login guru + rekap progres/nilai siswa |

## Akun Demo (lokal & GAS)

| Role | Username | Password |
|------|----------|----------|
| Siswa | `2024001` | `siswa123` |
| Guru | `GURU001` | `guru123` |
| Admin | `ADMIN001` | `admin123` |

Siswa baru cukup klik tab **Daftar Siswa**: isi NIS, nama, pilih kelas (X TITL 1/2), password. **Tanpa kode akses.**

## Materi

4 materi **hardcoded** di `Views/DashboardSiswa.html` (tanpa backend), dengan gambar dari
**Wikimedia Commons** (Special:FilePath, bebas pakai sesuai lisensi masing-masing):

1. **Proses Perencanaan Instalasi** — gambar: *Basement Electrical Plan* (blueprint, public domain)
2. **Pembuatan Panel** — gambar: *Operator panel with pushbuttons* oleh Elmschrat (CC BY-SA 3.0)
3. **Pemeliharaan, Perbaikan & Perawatan** — gambar: *Electrician replaces a fuse in a switch panel* (US Navy, public domain)
4. **Pengelolaan SDM** — gambar: *Mobile Training Team teach members of the Djiboutian Navy* (US Navy, public domain)

Setiap materi disusun lengkap: **pengertian → dasar teori → komponen → langkah kerja →
contoh kasus → rangkuman → glosarium istilah** (mis. ME/MEP, truss, ATS, RAB, KHA), disajikan
sebagai paragraf, daftar, tabel komponen, kotak definisi/contoh, dan kotak rumus.

Setiap materi diakhiri **kuis 12 soal**; nilai ≥ 75 membuka materi berikutnya.
Ujian akhir 20 soal mencakup semua materi.

### Sumber Materi (sesuai dokumen penelitian)

Keempat materi di atas **bukan pilihan bebas** — semuanya diambil dari proposal skripsi
*“Pengaruh Penggunaan Media Webblog dan Motivasi Belajar terhadap Hasil Belajar
Dasar-Dasar Ketenagalistrikan Kelas X TITL di SMK Swasta TR 2 Sinar Husni Medan”*
(Rismauli Napitupulu, NIM 5203131015, UNIMED 2025):

| # | Materi di web | Lokasi di proposal |
|---|---------------|--------------------|
| 1 | Proses Perencanaan Instalasi | Bab II, sub 2.1.6 poin 1 (hlm. 24–26) |
| 2 | Pembuatan Panel | Bab II, sub 2.1.6 poin 2 (hlm. 26–27) |
| 3 | Pemeliharaan, Perbaikan & Perawatan | Bab II, sub 2.1.6 poin 3 (hlm. 27) |
| 4 | Pengelolaan SDM | Bab II, sub 2.1.6 poin 4 (hlm. 27–28) |

Penilaian mengacu Bab III: instrumen tes pilihan ganda aspek C1–C4, nilai =
(jumlah benar / jumlah soal) × 100. Media weblog didefinisikan (Bab III 3.4) berisi
materi, tugas, diskusi, dan evaluasi.

## Menjalankan Secara Lokal (untuk development/demo)

```bash
cd local
node server.js
# buka http://localhost:3000
```

- Data disimpan di `local/db.json` (sheet `progress` otomatis dibuat).
- Backend REST di `/api/<fungsi>`; frontend memakai polyfill `google.script.run`.

## Deploy ke Google Apps Script (GAS Web App)

Ini jalur deploy yang benar untuk aplikasi ini. Hasilnya berupa URL publik
`https://script.google.com/macros/s/…/exec` yang bisa dibuka siswa tanpa akun Google.

> **Kenapa bukan GitHub Pages?** GitHub Pages hanya menyajikan berkas statis dan tidak bisa
> menjalankan program. Logika aplikasi ini ada di berkas `.gs` (butuh runtime Apps Script)
> dan di `local/server.js` (butuh Node.js), jadi Pages tidak akan pernah bisa menjalankannya.

### Sebelum mulai — satu hal yang mudah salah

Apps Script hanya mengenal **dua** tipe berkas: *script* (`.gs`) dan *HTML* (`.html`).
Tidak ada tipe berkas CSS. Karena itu design system disimpan sebagai
**`Styles/Main.html`** (isinya tetap CSS murni) dan dipanggil dengan
`<?!= include('Styles/Main') ?>` di dalam tag `<style>`. Jangan menggantinya menjadi
`Styles/Main.css` — di GAS berkas itu tidak akan ditemukan dan seluruh halaman jadi tanpa gaya.

### Cara A — pakai `clasp` (disarankan)

Butuh Node.js.

```bash
npm install -g @google/clasp
clasp login
```

Dari **root repo ini**:

```bash
# buat proyek Apps Script baru (web app) — sekali saja
clasp create --type webapp --title "Weblog DDK" --rootDir Weblog-DDK

# …atau, kalau proyek Apps Script-nya sudah ada:
cp .clasp.json.example .clasp.json   # lalu isi scriptId dari URL editor
clasp clone <SCRIPT_ID> --rootDir Weblog-DDK
```

`.clasp.json` berisi `scriptId` milik akun Anda, jadi sengaja **tidak** ikut ke Git
(sudah ada di `.gitignore`); contohnya tersedia sebagai `.clasp.json.example`.

```bash
clasp push   # unggah semua .gs + .html ke Apps Script
clasp open   # buka editor Apps Script
```

### Cara B — manual lewat editor Apps Script

1. Buka <https://script.google.com> → **New project**.
2. Untuk setiap berkas `.gs` di `Weblog-DDK/`: **File → New → Script**, beri nama persis sama
   (`Code`, `DbService`, `AuthService`, `ProgressService`, `Setup`, `Utils`, …).
3. Untuk setiap berkas `.html` di `Weblog-DDK/Views`, `Components`, dan `Styles`:
   **File → New → HTML**, dan tulis namanya **beserta folder**, misal
   `Views/Login`, `Views/DashboardSiswa`, `Components/Toast`, `Styles/Main`.
   (Nama folder ditulis sebagai bagian dari nama berkas — Apps Script otomatis menampilkannya bertingkat.)
4. Aktifkan **Project Settings → centang _Show `appsscript.json` manifest file_**, lalu ganti
   isinya dengan `Weblog-DDK/appsscript.json`.

### Langkah terakhir (sama untuk kedua cara)

5. Di editor, pilih fungsi **`setupDatabase`** → **Run** → izinkan akses saat diminta.
   Fungsi ini membuat 14 sheet + mengisi akun demo. Kalau script-nya belum terikat ke
   Spreadsheet mana pun, `setupDatabase()` akan **membuat spreadsheet baru otomatis**
   (`DB_Weblog_DDK_SMK_TR2`) dan menyimpan ID-nya di Script Properties — jadi tidak wajib
   membuat Spreadsheet dulu.
6. **Deploy → New deployment → Web app** → *Execute as:* **Me** → *Who has access:* **Anyone**.
7. Buka URL `…/exec`-nya. Login pakai akun demo di tabel atas, lalu bagikan ke siswa.

Setiap kali kode diubah: `clasp push`, lalu **Deploy → Manage deployments → Edit (✏️) → Version: New version → Deploy**
supaya URL yang sama memakai kode terbaru.

## Backend (API)

| Fungsi | Isi |
|--------|-----|
| `login` / `register` / `logout` | Auth siswa & guru (SHA-256 + session 2 jam) |
| `getStudentProgress` | Progres kuis/ujian siswa dari sheet `progress` |
| `submitMateriQuiz` | Simpan nilai kuis (best score + attempts), validasi **gating server-side** |
| `getGuruOverview` | Rekap semua siswa: materi selesai, nilai kuis 1-4, ujian, rata-rata |

Gating: kuis N hanya dinilai jika kuis N-1 lulus; ujian akhir hanya dinilai jika kuis 4 lulus.
Tanpa backend (dummy mode), progres tersimpan di localStorage browser.

## Struktur

```
Weblog-DDK/
├── Code.gs               ← Router 3 halaman + client API
├── AuthService.gs        ← Register (tanpa kode akses) + Login + Session
├── ProgressService.gs    ← Progres kuis gating + rekap guru  [BARU]
├── DbService.gs, Utils.gs, Setup.gs, ... (service lain, legacy siap pakai)
├── Views/
│   ├── Login.html          ← Tab Masuk / Daftar Siswa
│   ├── DashboardSiswa.html ← SPA siswa (materi + kuis + ujian)
│   └── DashboardGuru.html  ← SPA guru (login gate + rekap)
├── Components/Toast.html
└── Styles/Main.html       ← Design system (CSS murni; ekstensi .html karena batasan GAS)
```
