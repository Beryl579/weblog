# Local Run — Weblog DDK

Replikasi GAS + Sheets secara lokal (tanpa Google). Pakai `db.json` & `uploads/` sebagai ganti Sheets + Drive.

## Jalankan

```powershell
cd "D:\Weblog Media Pmebelajaran\local"
node server.js
```

Buka browser: **http://localhost:3000**

## Alur Baru

```
Siswa akses web → login / daftar (TANPA kode akses — pilih kelas langsung)
  → Dashboard siswa: Materi 1 → Kuis 1 (lulus ≥75) → Materi 2 → ... → Ujian Akhir
Guru akses /?page=guru → login guru → pantau progres & nilai tiap siswa
```

## Akun Demo

| Role | Username | Password |
|------|----------|----------|
| Siswa | `2024001` | `siswa123` |
| Guru | `GURU001` | `guru123` |
| Admin | `ADMIN001` | `admin123` |

Siswa baru: klik tab **Daftar Siswa** di halaman depan. Tanpa kode akses.

> Password di `db.json` disimpan sebagai hash SHA-256 + salt, tapi datanya tetap dianggap privat —
> makanya filenya masuk `.gitignore`.

## Halaman

| URL | Isi |
|-----|-----|
| `/?page=login` | Login + Daftar siswa (tab ganda) |
| `/?page=dashboard` | SPA siswa (materi hardcoded + kuis gating + ujian akhir) |
| `/?page=guru` | SPA guru (gate login + rekap siswa + ekspor CSV) |

## DB

- File: `db.json` — **tidak ikut di-commit** (lihat `.gitignore` di root repo), karena berisi data
  siswa & hash password. Kalau filenya belum ada, `server.js` membuat kerangka kosongnya lalu
  `seedIfEmpty()` mengisi akun demo + 4 materi. Jadi setelah `git clone` cukup jalankan
  `node server.js` sekali — tidak ada langkah setup tambahan.
- Mau mulai dari nol? Hapus `db.json` lalu restart server.
- Sheet `progress` [BARU]: menyimpan nilai kuis/ujian per siswa
  (`id, user_id, nis, quiz_key, best_score, score, total_questions, passed, attempts, updated_at`).
- `quiz_key`: `kuis1`…`kuis4`, `ujian`. Reset: hapus `db.json` lalu restart server.

## API Baru

POST JSON ke `http://localhost:3000/api/<nama>`:

- `/api/register` `{nis,nama,kelas,password,confirmPassword}` — tanpa kode akses
- `/api/login` `{nis,password}`
- `/api/getStudentProgress` `{userId|nis}`
- `/api/submitMateriQuiz` `{userId|nis, quizKey:'kuis1'..'kuis4'|'ujian', score, total}`
- `/api/getGuruOverview` `{}` — rekap semua siswa

## Catatan

- Gating divalidasi **server-side** (kuis N butuh kuis N-1 lulus; ujian butuh kuis 4 lulus).
- Materi & soal hardcoded di `Weblog-DDK/Views/DashboardSiswa.html` — tidak ambil dari backend.
- Gambar materi dari Wikimedia Commons (Special:FilePath).
- Session guru/siswa juga tersimpan via `localStorage.user` di browser (SPA gate).
- Backend GAS lengkap di folder `Weblog-DDK/` — lokal hanya subset yang dipakai 3 halaman SPA.
