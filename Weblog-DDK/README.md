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

## Deploy ke Google Apps Script

1. Buat Google Spreadsheet baru, buka **Extensions → Apps Script**.
2. Copy semua file `.gs` dari folder `Weblog-DDK/` ke editor (Code.gs, DbService.gs, AuthService.gs, ProgressService.gs, dll).
3. Copy file `.html` dari `Views/`, `Components/`, `Styles/` dengan nama file persis sama.
4. Jalankan fungsi **`setupDatabase()`** sekali (buat 14 sheet + seed akun demo).
5. **Deploy → New deployment → Web app** → Execute as: *Me* → Access: *Anyone*.
6. Bagikan URL web app ke siswa. Selesai.

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
└── Styles/Main.css        ← Design system hijau (sidebar gelap + konten terang)
```
