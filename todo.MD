# TODO — Weblog Pembelajaran Interaktif DDK (Build Plan Umum)

> Ringkasan build dari `PLAN.md:1-851` **disinkronisasi** dengan `SKRIPSI PEND TEKNIK ELEKTRO RISMAULI NAPITUPULU 14 Mar.pdf` (Proposal Skripsi 2025). Todos ini jadi acuan 1-by-1 eksekusi.

## 0. Ringkasan Proyek — Sinkron PDF ✅
- **Judul PDF p0:** Pengaruh Penggunaan Media Webblog dan Motivasi Belajar Terhadap Hasil Dasar-Dasar Ketenagalistrikan Kelas X TITL di SMK Swasta TR 2 Sinar Husni Medan — identik `PLAN.md:8-9`
- **Peneliti PDF p0/i:** Rismauli Napitupulu NIM 5203131015, Jur PT Elektro FT UNIMED, Pembimbing Dr. Arif Rahman M.Pd NIP 196604121992031001, Guru Pamong Drs. H. Purwanto M.Pd.T, Kepsek Lambok Nainggolan S.Pd — identik `PLAN.md:11-15`
- **Desain PDF p33 Tabel 3:** Pretest-Posttest Control Group Design, Quasi Experiment Q1-X1-O1 vs Q2-X2-O2, X1=weblog, X2=tanpa weblog — identik `PLAN.md:17-22`
- **Sampel PDF p32-33:** Populasi seluruh X SMK TR2 Sinar Husni, semester ganjil 2024/2025 Kurikulum Merdeka DDK, 2 kelas ×30 =60, Random Sampling, Eksperimen PPT+Webblog, Kontrol PPT saja — identik `PLAN.md:24-26,28-31`
- **Waktu PDF p32:** Juni–Juli 2025 (2 bulan) di SMK Swasta TR2 Sinar Husni — identik `PLAN.md:28-29`
- **Data awal PDF p7 Tabel 1:** KKTP 75, Rata-rata 70.4, 30 siswa — identik `PLAN.md:34-36`
- **Hipotesis PDF p30-31:** Ha1 weblog→hasil, Ha2 motivasi→hasil, Ha3 bersama→hasil + H01-H03 — identik `PLAN.md:38-41`
- **Definisi Operasional PDF p33-34:** 1 weblog=blog interaktif materi/tugas/diskusi/evaluasi DDK dalam & luar kelas, 2 motivasi=dorongan dalam/lingkungan semangat partisipasi capai optimal, 3 hasil=penguasaan pengetahuan/keterampilan/sikap via tes/tugas/praktik — identik `PLAN.md:43-46` (wording PDF lebih lengkap, pakai itu untuk konten halaman bantuan)
- **⚠️ Nuansa PDF yang disesuaikan:**
  - PDF p42: instrumen tes **20 soal PG** — di app jadi **20 pretest + 20 posttest = 40 rows** (`questions`) untuk hindari bocor soal & isolasi perlakuan; skor tetap Nilai=(Skor/Total)×100 `PDF p35`
  - PDF p34-40: ada **uji validitas (product moment r_hitung>r_tabel db N-2 α0.05), reliabilitas Alpha Cronbach (Tabel3), tingkat kesukaran P=B/JS, daya pembeda D=BA/JA-BB/JB** — tidak diimplement di app, tapi jadi catatan validasi soal di `todo2.md` + manual guru
  - PDF p40-41: **9 langkah pengumpulan data** (tentukan 2 kelas, pretest homogen, sampel homogen, siswa tidak tahu disampel, perlakuan X1/X2, pertahankan kondisi sama PBL/PPT/guru/waktu, posttest+angket, analisis, kesimpulan) — masukkan ke flow guru
  - PDF p41-42: motivasi **4 indikator ×4 deskriptor** kategori a rendah/b cukup/c baik/d sangat baik — nama indikator di `PLAN.md:749-752` (Dorongan, Ketekunan, Minat, Lingkungan) adalah interpretasi, di seed pakai nama generik Indicator1-4 + tetap 16 item

## 1. Tech Stack & Batasan (`PLAN.md:50-73`)
- [ ] Backend: GAS `doGet()`/`doPost()` router (`PLAN.md:54`)
- [ ] DB: 1 Spreadsheet `DB_Weblog_DDK_SMK_TR2` 13 sheet (`PLAN.md:55,94-239`)
- [ ] Storage: Google Drive (PDF/PPT/gambar/upload) (`PLAN.md:56`)
- [ ] Frontend: HTML Service `.html` + `<style>` + Vanilla JS (Alpine CDN opsional) (`PLAN.md:57,68-72`)
- [ ] Auth: Session + kode akses kelas via NIS (`PLAN.md:58`)
- [ ] Deploy: Web App → Execute as me (`PLAN.md:60`)
- [ ] **JANGAN:** React/Vue/Angular, MySQL/Firebase, VPS, webpack/npm (`PLAN.md:62-66`) — sesuai PDF p19: blog gratis wordpress/blogspot, tidak butuh hosting berat, manfaat blog murah/mudah `PDF p19`

## 2. Hard Constraints — WAJIB (`PLAN.md:76-92` + PDF p40-41 langkah 4 & 6)
- [ ] **Isolasi Perlakuan:** Kontrol tidak bisa akses weblog, registrasi wajib kode akses eksperimen (`PLAN.md:78-79`, `PDF p40 langkah 6: kondisi kedua kelompok tetap sama kecuali weblog`)
- [ ] **Anti-Cheat:** Pretest/Posttest 1× submit cek `test_attempts` (`PLAN.md:81`)
- [ ] **Kunci Tersembunyi:** `correct_answer` tidak dikirim ke client (`PLAN.md:83`)
- [ ] **Mobile-First 360px+** (`PLAN.md:85`, `PDF p5: siswa main smartphone` + `PDF p19: akses blog mudah/murah`)
- [ ] **No scope-creep:** tanpa gamifikasi/AI/video conference (`PLAN.md:87`)
- [ ] **Terkontrol:** Weblog tambahan, tidak ganti guru/PPT/PBL; siswa tidak tahu disampel (`PLAN.md:89`, `PDF p41 langkah 4 & 6`)
- [ ] **NIS unik 1× register** (`PLAN.md:91`)

## 3. Struktur Project GAS (`PLAN.md:244-275`)
```
Weblog-DDK/
├── Code.gs, DbService.gs, AuthService.gs, MaterialService.gs, QuizService.gs
├── MotivationService.gs, PblService.gs, CommentService.gs, GuruService.gs, Utils.gs
├── Views/ (Register, Login, DashboardSiswa, Materi, MateriDetail, Pbl, PblDetail, Quiz, Angket, Diskusi, Tugas, DashboardGuru)
├── Components/ (Navbar, Footer, Toast)
└── Styles/Main.css
```
- [ ] Buat struktur file sesuai di atas
- [ ] `Code.gs:include()` untuk include Components (`PLAN.md:501-503`)

## 4. Phase Build — Urutan Eksekusi (`PLAN.md:846-849`)
> Mulai: DbService → AuthService → Quiz → Motivation → Frontend → Guru → Seed → README — setelah sinkron PDF, urutan tetap, tapi seed materi/PBL wajib pakai wording PDF 2.1.6 & Tabel 2

### Phase 0 — Setup Spreadsheet & Seed (`PLAN.md:94-239`, `PLAN.md:722-760` + PDF p24-28, p22-23)
- [ ] Buat spreadsheet `DB_Weblog_DDK_SMK_TR2` + 13 sheet (kolom persis `PLAN.md:100-238`)
- [ ] Seed `class_config`: `X TITL 1` / `DDK2025-EKS` / TRUE / max 30 (`PLAN.md:723-728`, `PDF p32-33: 1 kelas eksperimen 30`)
- [ ] Seed `users`: 1 guru + 1 admin (siswa tidak di-seed) (`PLAN.md:730-734`)
- [ ] Seed `materials`: 4 topik **wording PDF p24-28**:
  - [ ] T1 Proses Perencanaan Instalasi (a Penawaran, b Survei & Penjelasan, c Perencanaan gambar+RAB, d Presentasi, e Pelaksanaan SPK+Pengawas Persiapan→Pelaksanaan→Tes/Commissioning, f Serah terima) `PDF p24-26`
  - [ ] T2 Pembuatan Panel (panel PLN→genset otomatis, survey peralatan dikendalikan, perhitungan kabel/proteksi, konsultasi cara kerja) `PDF p26-27`
  - [ ] T3 Pemeliharaan/Perbaikan/Perawatan (SOP, jadwal 3 bulan AC, cek harian, internal vs pihak ketiga) `PDF p27`
  - [ ] T4 Pengelolaan SDM (posisi lulusan TITL, alur perencanaan→gambar→survey→RAB→pemasangan→testing→commissioning→pemeliharaan→perawatan→perbaikan) `PDF p27-28`
- [ ] Seed `questions`: 40 row (20 pretest+20 posttest, 5×C1/C2/C3/C4 per tes `PLAN.md:745`, kognitif `PDF p34-35: C1 mengingat C2 memahami C3 mengaplikasikan C4 menganalisis`), skor 1/0 Nilai=Jumlah/Total×100 `PDF p35`, correct_answer random
- [ ] Seed `motivation_indicators`: 16 row 4 indikator ×4 deskriptor `PDF p41`, kategori a rendah/b cukup/c baik/d sangat baik `PDF p41-42`, nama pakai Indicator 1-4 (atau Dorongan/Ketekunan/Minat/Lingkungan sebagai label `PLAN.md:750-752`)
- [ ] Seed `pbl_phases`: 5 fase **wording PDF Tabel 2 p22-23**: F1 Orientasi (jelaskan tujuan/logistik/motivasi pemecahan masalah), F2 Mengorganisasikan (definisi/organisasi tugas), F3 Membimbing penyelidikan individu/kelompok (kumpul info/eksperimen), F4 Menghubungkan & menyajikan hasil karya (laporan/model/berbagi tugas), F5 Menganalisis & mengevaluasi (refleksi/evaluasi) — catat PDF typo "kepada sekolah" → pakai "kepada masalah" sesuai Arends 2008
- [ ] Seed `tests`: 2 row pretest/posttest total_questions 20 `PDF p42`, is_open false/true
- [ ] Fungsi `setupDatabase()` idempoten

### Phase 1 — Auth: Register & Login (`PLAN.md:281-331` + PDF p40-41)
- [ ] **Register.html** form: NIS*, Nama*, Password 6char*, Konfirmasi*, Kode Akses* (`PLAN.md:285-290`)
- [ ] Logic `AuthService.register()` 8 langkah: validasi → cek NIS → cek access_code di `class_config` → cek is_eksperimen TRUE → cek kuota 30 → hash SHA-256 → simpan users role=siswa → log `register` → redirect login (`PLAN.md:292-306`)
- [ ] Rate limit 1 req/NIS/menit via CacheService + pesan umum setelah 3× gagal (`PLAN.md:311-313`)
- [ ] **Login.html** NIS+Password (`PLAN.md:314-319`)
- [ ] Logic `login()`: cari NIS → hash compare → session Cache 2 jam → log `login` → redirect by role (`PLAN.md:320-329`, `PLAN.md:528`, `PLAN.md:534`)
- [ ] `logout()` & `getCurrentUser()` & `requireAuth()` middleware (`PLAN.md:528-532`)

### Phase 2 — Dashboard Siswa (`PLAN.md:333-342`)
- [ ] Card progress: Materi X/4, Pretest nilai/belum, Posttest terkunci, Angket terkunci (`PLAN.md:333-338`)
- [ ] Quick actions + pengumuman + jadwal PBL 5 fase `PDF p22-23`
- [ ] Navbar 8 item: Beranda|Materi|PBL|Pretest|Posttest|Angket|Diskusi|Tugas (`PLAN.md:341`)

### Phase 3 — Materi 4 Topik (`PLAN.md:344-385` + PDF p24-28)
- [ ] Materi.html list + MateriDetail.html per topik (isi pakai wording PDF 2.1.6, bukan ringkas PLAN saja)
- [ ] Per halaman: tujuan, konsep+gambar, unduh PPT/PDF Drive, contoh, rangkuman, komentar, sidebar, "Tandai Selesai" (`PLAN.md:376-384`)

### Phase 4 — PBL 5 Fase (`PLAN.md:388-397` + PDF p22-23 Tabel 2)
- [ ] Pbl.html + PblDetail.html
- [ ] Tabel 3 kolom fitur: F1 studi kasus/pertanyaan pemantik/gambar masalah, F2 pembagian kelompok/LKPD, F3 sumber bacaan/diskusi, F4 upload laporan/galeri, F5 refleksi/kuis formatif/feedback

### Phase 5 — Quiz Pretest/Posttest (`PLAN.md:399-413` + PDF p34-35, p40-42)
- [ ] Quiz.html: 20 PG A-D, 1 soal/view, prev/next, progress 5/20, grid 1-20, timer opsional (`PLAN.md:400-405`)
- [ ] Instrumen: 20 soal PG C1-C4 `PDF p34-35`, validitas product moment, reliabilitas Cronbach — dokumentasi di README guru (tidak di kode)
- [ ] Submit scoring server-side: **Nilai=(Jumlah Benar/20)×100** `PDF p35 & p42`, Benar=1 Salah=0 `PDF p35`, simpan test_attempts+test_answers, tanpa kunci (`PLAN.md:406-410`)
- [ ] Gate: Posttest hanya jika pretest selesai & `tests.is_open=TRUE` + pertahankan kondisi sama `PDF p41 langkah 6` (`PLAN.md:412`)
- [ ] Homogenitas pretest `PDF p40 langkah 2-3` → dashboard guru tampilkan distribusi pretest untuk cek homogen awal

### Phase 6 — Angket Motivasi (`PLAN.md:415-433` + PDF p41-42)
- [ ] Angket.html: 16 item (4 indikator×4 deskriptor `PDF p41`), Likert 1-4 (1 STS-4 SS `PLAN.md:417-421`), kategori a rendah/b cukup/c baik/d sangat baik `PDF p41-42`, grouping per indikator
- [ ] Validasi 16 terisi, 1× submit, gate setelah posttest `PDF p41 langkah 7`, **Nilai=(Skor Diperoleh/Skor Total)×100** `PDF p41`, Skor Total max 64 (4×16) — tampilkan skor per indikator + total
- [ ] Hanya setelah posttest selesai (`PLAN.md:430`)

### Phase 7 — Diskusi & Tugas (`PLAN.md:435-448`)
- [ ] Diskusi.html: nested reply parent_id, moderasi is_approved, avatar inisial, guru hapus (`PLAN.md:435-441`)
- [ ] Tugas.html: list per fase PBL, upload Drive (PDF/DOC/JPG/PNG max 5MB), status belum/sudah/dinilai, guru nilai+feedback (`PLAN.md:443-448`)

### Phase 8 — Dashboard Guru & Ekspor (`PLAN.md:450-484` + PDF p42-45 analisis)
- [ ] DashboardGuru.html: ringkasan total siswa, % pretest/posttest/angket, rata nilai, tabel sortable/filter/search, pagination 10, charts CDN, toggle buka/tutup tes, CRUD materi/soal, moderasi, manajemen kode akses (`PLAN.md:452-459`)
- [ ] **Ekspor 3 CSV ID anonim S001…** (`PLAN.md:461-483`) — wajib anonim `PLAN.md:483`, field dirancang untuk **SPSS uji PDF p42-45**:
  - [ ] `hasil_belajar.csv`: id_siswa,kelas,pretest_score,pretest_value,posttest_score,posttest_value,n_gain=(post-pre)/(100-pre) — untuk uji-t pihak kanan `PDF p43-44` db n1+n2-2 α0.05, normalitas chi kuadrat JK6 `PDF p42-43`, homogenitas F `PDF p43`
  - [ ] `butir_soal.csv`: id_siswa,jenis_test,no_soal,kunci,jawaban_siswa,skor,level C1-C4 — untuk analisis validitas/reliabilitas/kesukaran/daya beda `PDF p35-40` + uji tiap butir
  - [ ] `motivasi.csv`: id_siswa,kelas,skor_ind1-4,total, nilai_motivasi=(total/64)*100 — untuk korelasi product moment r `PDF p44-45` Tabel6 & CD=r² `PDF p45-46`
- [ ] Tampilkan di guru: rata pretest eksperimen 49.58 vs kontrol 46.25 contoh `PDF p28` & rata motivasi 70.36% vs 61.6% `PDF p28-29` sebagai referensi interpretasi

### Phase 9 — UI/UX & Deploy (`PLAN.md:683-718` + PDF p18-19)
- [ ] Palet: #0F3460 Navy, #E94560 Accent, #16213E text, #1DB954 success, #E6A817 warning, #F8F9FA bg (`PLAN.md:685-692`)
- [ ] Font Segoe UI, H1 22px bold, H2 18px semibold, Body 14px (`PLAN.md:694-697`)
- [ ] Mobile-first 360px, minimalis, kontras tinggi, max 3 klik, toast 3 detik, loading state (`PLAN.md:699-706`) — sesuai PDF akses blog mudah/murah `PDF p19`
- [ ] Komponen: Navbar sticky hamburger, Card materi, Quiz 1-view, Likert horizontal, Thread nested, Progress hijau≥75% (`PLAN.md:708-717`)
- [ ] Deploy Web App + README (cara buat sheet, paste GAS, deploy Execute as me, share URL, guru bagikan DDK2025-EKS hanya ke eksperimen) (`PLAN.md:834-840`) + cara pembuatan blog `PDF p18-19` sebagai lampiran manual

## 5. Out of Scope — JANGAN Dibuat (`PLAN.md:762-775`)
Gamifikasi, AI chatbot, video conference, forum publik, pembayaran, native app, Google OAuth — PDF tidak sebutkan, fokus hanya weblog materi/tugas/diskusi/evaluasi `PDF p33-34`

## 6. Acceptance Criteria Checklist (`PLAN.md:778-822` + PDF)
- [ ] AC 1-7: Register/Login/kuota/session 2 jam
- [ ] AC 8-11: Isolasi kontrol, kunci hidden, hash, 1× submit
- [ ] AC 12-18: 4 materi wording PDF p24-28, download, komentar, pre/post 20 PG C1-C4 `PDF p34`, posttest gate, angket 16 item `PDF p41` gate posttest, upload tugas
- [ ] AC 19-20: Scoring PDF p35/p41 (Benar/20×100 & Diperoleh/Total×100)
- [ ] AC 21-25: Rekap guru, toggle, kelola kode, 3 CSV anonim untuk SPSS `PDF p42-45`
- [ ] AC 26-28: Responsif 360px, data persist, activity_logs lengkap (register, login, view_materi, submit_kuis, submit_angket `PLAN.md:238`)

## 7. Referensi PDF untuk Validasi Soal (tidak di kode app, tapi di README guru)
- [ ] Validitas product moment `PDF p35-36` r_xy = [NΣXY-(ΣX)(ΣY)]/√[(NΣX²-(ΣX)²)(NΣY²-(ΣY)²)], r_hitung>r_tabel db N-2 α0.05 valid
- [ ] Reliabilitas Alpha Cronbach `PDF p36-37` r11=K/(K-1)(1-Σs²/St²), Tabel3 0.800-1.000 sangat tinggi `PDF p38`
- [ ] Kesukaran P=B/JS `PDF p38`, P<0.2 sulit, 0.2-0.8 sedang, >0.8 mudah `PDF p39`
- [ ] Daya beda D=BA/JA-BB/JB `PDF p39`, -1 s/d +1, syarat 0.20-1.00, Tabel5 0.00-0.20 tidak baik s/d 0.71-1.00 sangat baik `PDF p40`
- [ ] Korelasi Tabel6 `PDF p45` 0.00 tidak berkorelasi s/d 0.81-1.00 sangat tinggi, CD=r² `PDF p45`

---
**Next:** Eksekusi Phase 0→1 satu per satu. Semua konten materi/PBL pakai wording PDF, bukan ringkas PLAN. Detail backend di `todo2.md`.
