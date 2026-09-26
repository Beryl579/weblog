```markdown
# PROMPT: Bangun Weblog Pembelajaran DDK dengan Google Apps Script

## KONTEKS PROYEK

Bangun web app "Weblog Pembelajaran Interaktif" menggunakan **Google Apps Script** sebagai backend, **Google Sheets** sebagai database, dan **Google Drive** sebagai file storage. Web app ini adalah MEDIA PERLAKUAN PENELITIAN (treatment tool) untuk kelas eksperimen dalam penelitian quasi-experiment.

**Judul Penelitian:**
"Pengaruh Penggunaan Media Webblog dan Motivasi Belajar Terhadap Hasil Dasar-Dasar Ketenagalistrikan Kelas X Teknik Instalasi Tenaga Listrik di SMK Swasta TR 2 Sinar Husni Medan"

**Peneliti:** Rismauli Napitupulu, NIM. 5203131015
**Institusi:** Jurusan Pendidikan Teknik Elektro, FT — UNIMED
**Dosen Pembimbing:** Dr. Arif Rahman., M.Pd. NIP. 196604121992031001
**Guru Pamong SMK:** Drs. H. Purwanto, M.Pd. T.
**Kepala Sekolah:** Lambok Nainggolan, S.Pd.

**Desain Penelitian:** Pretest-Posttest Control Group Design (Quasi Experiment)

| Kelas | Pretest | Perlakuan | Posttest |
|-------|---------|-----------|----------|
| Eksperimen | Q₁ | X₁ (PPT + Weblog) | O₁ |
| Kontrol | Q₂ | X₂ (PPT saja) | O₂ |

**Sampel:** 2 kelas × 30 siswa = 60 siswa (Random Sampling)
**Kelas Eksperimen:** Media PPT + Weblog (X₁)
**Kelas Kontrol:** Media PPT saja (X₂)
**Model Pembelajaran:** Problem Based Learning (PBL) — 5 Fase (Arends, 2008)
**Waktu Penelitian:** Juni – Juli 2025 (2 bulan)
**Sekolah:** SMK Swasta TR 2 Sinar Husni Medan
**Semester:** Ganjil 2024/2025
**Kurikulum:** Kurikulum Merdeka

**Data Awal (dari proposal):**
- KKTP = 75
- Rata-rata hasil belajar siswa = 70,4
- Jumlah siswa per kelas = 30

**Hipotesis:**
- Ha₁: Terdapat pengaruh penggunaan media webblog terhadap hasil belajar DDK
- Ha₂: Terdapat pengaruh motivasi belajar terhadap hasil belajar DDK
- Ha₃: Terdapat pengaruh media webblog dan motivasi belajar secara bersama-sama terhadap hasil belajar DDK

**Definisi Operasional (dari proposal):**
1. Penggunaan media weblog = pemanfaatan blog sebagai sarana pembelajaran interaktif yang berisi materi, tugas, diskusi, dan evaluasi pada mata pelajaran Dasar-Dasar Ketenagalistrikan
2. Motivasi belajar = dorongan dari dalam diri dan lingkungan yang menimbulkan semangat, keinginan, dan usaha siswa untuk berpartisipasi aktif dalam kegiatan belajar
3. Hasil belajar DDK = tingkat penguasaan pengetahuan, keterampilan, dan sikap siswa setelah mengikuti proses pembelajaran, ditunjukkan melalui nilai tes, tugas, dan praktik

---

## TECH STACK (WAJIB)

| Layer | Teknologi | Keterangan |
|-------|-----------|------------|
| Backend | Google Apps Script (GAS) | doGet() dan doPost() sebagai router |
| Database | Google Sheets | 1 spreadsheet, 13 sheet |
| File Storage | Google Drive | PDF, PPT, gambar, upload siswa |
| Frontend | HTML Service (GAS) | HTML + CSS + JS dalam file .html GAS |
| Auth | Session + kode akses kelas | Register & Login via NIS |
| Export | Google Sheets native | Download sebagai CSV/Excel langsung |
| Deploy | Web App (GAS) | Deploy → Web app → Execute as me |

JANGAN gunakan:
- Framework frontend berat (React, Vue, Angular)
- Database eksternal (MySQL, PostgreSQL, Firebase)
- Hosting terpisah (VPS, shared hosting)
- Library yang butuh build step (webpack, npm)

Gunakan HANYA:
- Google Apps Script (.gs)
- HTML Service (.html)
- CSS inline atau `<style>` tag
- Vanilla JavaScript (atau Alpine.js via CDN jika perlu)

---

## HARD CONSTRAINTS (WAJIB DIPATUHI)

1. **ISOLASI PERLAKUAN:** Siswa kelas kontrol TIDAK BOLEH memiliki akses ke weblog. Saat registrasi, siswa WAJIB memasukkan kode akses kelas yang hanya diberikan ke kelas eksperimen. Jika kode salah atau tidak ada, registrasi ditolak.

2. **ANTI-CHEAT KUIS:** Setiap siswa hanya boleh submit pretest/posttest SATU KALI. Cek di sheet test_attempts sebelum simpan. Jika sudah ada, tolak dan return error.

3. **KUNCI JAWABAN TERSEMBUNYI:** Kolom correct_answer di sheet questions TIDAK BOLEH dikirim ke client (browser siswa). Hanya digunakan di server untuk scoring.

4. **MOBILE-FIRST:** Siswa SMK mengakses via smartphone. Semua halaman responsif mulai dari 360px.

5. **TIDAK ADA FITUR DI LUAR SCOPE:** Jangan tambahkan gamifikasi berlebihan, AI chatbot, video conference, atau fitur yang menambah variabel bias di luar metodologi penelitian.

6. **KONDISI TERKONTROL:** Weblog adalah perlakuan TAMBAHAN. Model PBL dan media PPT tetap dijalankan di kelas. Weblog tidak menggantikan guru.

7. **REGISTRASI SEKALI:** Setiap NIS hanya bisa mendaftar SATU KALI. Jika NIS sudah terdaftar, tolak registrasi ulang.

---

## STRUKTUR GOOGLE SHEETS (DATABASE)

Buat 1 Google Spreadsheet dengan nama: **"DB_Weblog_DDK_SMK_TR2"**

Berisi 13 sheet berikut:

### Sheet 1: users
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| A: id | Number | Auto-increment |
| B: nis | Text | NIS siswa (UNIK) |
| C: nama | Text | Nama lengkap |
| D: kelas | Text | 'X TITL 1' atau 'X TITL 2' |
| E: role | Text | 'siswa' / 'guru' / 'admin' |
| F: is_eksperimen | Boolean | TRUE / FALSE |
| G: password_hash | Text | Hash password siswa |
| H: registered_at | DateTime | Timestamp registrasi |
| I: is_active | Boolean | TRUE jika akun aktif |

### Sheet 2: class_config
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| A: id | Number | |
| B: kelas | Text | Nama kelas (mis: 'X TITL 1') |
| C: access_code | Text | Kode akses kelas (rahasia) |
| D: is_eksperimen | Boolean | TRUE jika kelas eksperimen |
| E: max_students | Number | Batas jumlah siswa (30) |

### Sheet 3: materials
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| A: id | Number | |
| B: topik | Number | 1, 2, 3, atau 4 |
| C: judul | Text | |
| D: konten | Text | Body HTML materi |
| E: file_ppt_url | Text | Link Google Drive |
| F: file_pdf_url | Text | Link Google Drive |
| G: gambar_url | Text | Link Google Drive |
| H: published_at | DateTime | |
| I: is_active | Boolean | |

### Sheet 4: tests
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| A: id | Number | |
| B: type | Text | 'pretest' / 'posttest' |
| C: total_questions | Number | 20 |
| D: duration_min | Number | Opsional |
| E: is_open | Boolean | Guru yang buka/tutup |
| F: created_at | DateTime | |

### Sheet 5: questions
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| A: id | Number | |
| B: test_id | Number | FK → tests |
| C: question_text | Text | |
| D: option_a | Text | |
| E: option_b | Text | |
| F: option_c | Text | |
| G: option_d | Text | |
| H: correct_answer | Text | 'A'/'B'/'C'/'D' — JANGAN kirim ke client |
| I: cognitive_level | Text | 'C1'/'C2'/'C3'/'C4' |
| J: order_num | Number | |

### Sheet 6: test_attempts
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| A: id | Number | |
| B: user_id | Number | FK → users |
| C: test_id | Number | FK → tests |
| D: raw_score | Number | Jumlah benar |
| E: final_value | Number | (raw_score/20)*100 |
| F: started_at | DateTime | |
| G: submitted_at | DateTime | |

**Constraint:** Kombinasi (user_id, test_id) harus unik. Cek sebelum insert.

### Sheet 7: test_answers
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| A: id | Number | |
| B: attempt_id | Number | FK → test_attempts |
| C: question_id | Number | FK → questions |
| D: selected_answer | Text | Jawaban siswa |
| E: is_correct | Boolean | |
| F: score | Number | 1 atau 0 |

### Sheet 8: motivation_indicators
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| A: id | Number | |
| B: indicator_name | Text | Nama indikator |
| C: descriptor_num | Number | 1-4 |
| D: statement_text | Text | Teks pernyataan |
| E: order_num | Number | |

### Sheet 9: motivation_responses
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| A: id | Number | |
| B: user_id | Number | FK → users |
| C: indicator_id | Number | FK → motivation_indicators |
| D: response_value | Number | 1, 2, 3, atau 4 |
| E: submitted_at | DateTime | |

### Sheet 10: comments
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| A: id | Number | |
| B: user_id | Number | FK → users |
| C: material_id | Number | FK → materials |
| D: content | Text | |
| E: parent_id | Number | Untuk reply nested, kosong jika top-level |
| F: is_approved | Boolean | Moderasi guru |
| G: created_at | DateTime | |

### Sheet 11: pbl_phases
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| A: id | Number | |
| B: phase_num | Number | 1 s/d 5 |
| C: title | Text | |
| D: description | Text | |
| E: file_url | Text | Link Google Drive (LKPD) |

### Sheet 12: task_submissions
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| A: id | Number | |
| B: user_id | Number | FK → users |
| C: pbl_phase_id | Number | FK → pbl_phases |
| D: file_url | Text | Link Google Drive |
| E: score | Number | Nilai dari guru (opsional) |
| F: feedback | Text | Feedback guru (opsional) |
| G: submitted_at | DateTime | |

### Sheet 13: activity_logs
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| A: id | Number | |
| B: user_id | Number | |
| C: action | Text | 'register', 'login', 'view_materi', 'submit_kuis', dll |
| D: target_id | Number | |
| E: timestamp | DateTime | |

---

## STRUKTUR PROJECT GOOGLE APPS SCRIPT

```
📁 Weblog-DDK/
├── Code.gs                    ← Router utama, doGet(), doPost()
├── DbService.gs               ← CRUD helper untuk Google Sheets
├── AuthService.gs             ← Register, Login, session, validasi akses
├── MaterialService.gs         ← CRUD materi
├── QuizService.gs             ← Pretest/posttest logic + scoring
├── MotivationService.gs       ← Angket motivasi logic
├── PblService.gs              ← PBL phases + task submission
├── CommentService.gs          ← Diskusi/komentar
├── GuruService.gs             ← Dashboard guru + ekspor
├── Utils.gs                   ← Helper umum (generateId, hashPassword, formatValue)
├── Views/
│   ├── Register.html          ← Halaman registrasi siswa
│   ├── Login.html             ← Halaman login
│   ├── DashboardSiswa.html    ← Dashboard siswa
│   ├── Materi.html            ← Daftar materi
│   ├── MateriDetail.html      ← Detail per topik
│   ├── Pbl.html               ← Daftar fase PBL
│   ├── PblDetail.html         ← Detail per fase
│   ├── Quiz.html              ← Pretest/Posttest
│   ├── Angket.html            ← Angket motivasi
│   ├── Diskusi.html           ← Komentar per materi
│   ├── Tugas.html             ← Upload tugas
│   └── DashboardGuru.html     ← Rekap + ekspor
├── Components/
│   ├── Navbar.html            ← Navigasi (include)
│   ├── Footer.html            ← Footer (include)
│   └── Toast.html             ← Notifikasi (include)
└── Styles/
    └── Main.css               ← CSS global (include via <style>)
```

---

## HALAMAN & FITUR YANG HARUS DIBANGUN

### 1. Halaman Registrasi (Register.html) — BARU

Siswa kelas eksperimen mendaftar sendiri menggunakan kode akses kelas.

**Form Registrasi:**
- NIS (wajib, unik)
- Nama Lengkap (wajib)
- Password (wajib, minimal 6 karakter)
- Konfirmasi Password (wajib, harus sama)
- Kode Akses Kelas (wajib — diberikan guru ke kelas eksperimen)

**Logika Registrasi (di AuthService.gs):**
1. Validasi input: semua field wajib diisi
2. Cek NIS sudah terdaftar atau belum di sheet users
   - Jika sudah → error "NIS sudah terdaftar. Silakan login."
3. Validasi Kode Akses Kelas:
   - Cari di sheet class_config berdasarkan access_code
   - Jika tidak ditemukan → error "Kode akses tidak valid"
   - Jika ditemukan → cek is_eksperimen = TRUE
   - Jika is_eksperimen = FALSE → error "Kelas ini bukan kelas eksperimen"
4. Cek jumlah siswa yang sudah register untuk kelas tersebut
   - Jika sudah mencapai max_students (30) → error "Kuota kelas penuh"
5. Hash password (gunakan Utilities.computeDigest)
6. Simpan ke sheet users dengan role='siswa', is_eksperimen=TRUE
7. Catat di activity_logs: action='register'
8. Redirect ke halaman Login dengan pesan sukses

**Keamanan:**
- Password TIDAK disimpan dalam plain text
- Kode akses kelas TIDAK ditampilkan di halaman publik
- Jika kode salah 3x berturut-turut, tampilkan pesan umum tanpa detail
- Rate limit: 1 request registrasi per NIS per menit (gunakan CacheService)

### 2. Halaman Login (Login.html)

**Form Login:**
- NIS
- Password

**Logika Login (di AuthService.gs):**
1. Cari NIS di sheet users
2. Jika tidak ditemukan → error "NIS tidak terdaftar. Silakan daftar terlebih dahulu."
3. Cocokkan password hash
4. Jika cocok → buat session (PropertiesService atau CacheService dengan expiry 2 jam)
5. Catat di activity_logs: action='login'
6. Redirect berdasarkan role:
   - role='siswa' → /dashboard
   - role='guru' → /guru
   - role='admin' → /guru

### 3. Dashboard Siswa (DashboardSiswa.html)

- Progress card:
  - Materi: X/4 selesai
  - Pretest: ✅ Nilai / ⏳ Belum
  - Posttest: ✅ Nilai / ⏳ Belum / 🔒 Terkunci
  - Angket: ✅ Selesai / ⏳ Belum / 🔒 Terkunci
- Quick action buttons: Lanjutkan Belajar, Kerjakan Pretest, Isi Angket
- Pengumuman dari guru (jika ada)
- Jadwal PBL (5 fase)
- Navbar: Beranda | Materi | PBL | Pretest | Posttest | Angket | Diskusi | Tugas

### 4. Halaman Materi (Materi.html + MateriDetail.html)

4 topik materi Dasar-Dasar Ketenagalistrikan (dari Bab II proposal):

**Topik 1: Proses Perencanaan Instalasi**
Sub-materi:
- Penawaran pekerjaan (Jasa ME ditawarkan pekerjaan instalasi listrik dari pemilik gedung/kontraktor utama)
- Survei dan Penjelasan Pekerjaan (menghubungi pemilik, survey untuk data terperinci)
- Perencanaan (rancangan gambar pemasangan + Rencana Anggaran Biaya/RAB: nilai material, jasa teknisi, sewa alat)
- Presentasi (di depan pemilik pekerjaan, pembahasan, kesepakatan)
- Pelaksanaan pekerjaan ME (SPK terbit, Tim Pengawas, tahapan: Persiapan → Pelaksanaan → Tes/Commissioning)
- Serah terima hasil pekerjaan

**Topik 2: Pembuatan Panel**
Sub-materi:
- Panel kendali pensaklaran beban (PLN ke genset)
- Survey fokus pada peralatan yang akan dikendalikan
- Perhitungan peralatan, kabel, dan proteksi sesuai batas ukur
- Konsultasi cara kerja panel dengan pemilik pekerjaan
- Contoh: pemilik menghendaki panel genset mensuplai arus ke seluruh gedung setelah pemadaman secara otomatis

**Topik 3: Pemeliharaan, Perbaikan, dan Perawatan Peralatan Ketenagalistrikan**
Sub-materi:
- SOP perawatan sesuai peralatan yang digunakan
- Jadwal pemeliharaan (AC 3 bulan sekali, lampu, lift, pompa air, panel)
- Jadwal pengecekan harian untuk deteksi kerusakan
- Penanganan kerusakan: jika bisa ditangani internal → dikerjakan internal; jika tidak → order ke pihak ketiga

**Topik 4: Pengelolaan SDM**
Sub-materi:
- Posisi kerja lulusan SMK teknik ketenagalistrikan
- Alur: perencanaan → gambar instalasi → survey → RAB → pemasangan → testing → commissioning → pemeliharaan → perawatan → perbaikan

Setiap halaman materi memiliki:
- Tujuan pembelajaran
- Penjelasan konsep + gambar/ilustrasi
- Tombol unduh PPT dan PDF (link Google Drive)
- Contoh kasus
- Rangkuman
- Kolom komentar/diskusi di bawah
- Sidebar navigasi topik (Topik 1 ✅, Topik 2 ⬜, dst)
- Tombol "Tandai Selesai" untuk tracking progress

### 5. Halaman PBL (Pbl.html + PblDetail.html)

5 fase berdasarkan Tabel 2 proposal (Arends, 2008):

| Fase | Kegiatan | Fitur Web App |
|------|----------|---------------|
| 1 | Orientasi siswa kepada masalah: Guru menjelaskan tujuan pembelajaran, logistik, memotivasi siswa terlibat pemecahan masalah | Studi kasus kelistrikan, pertanyaan pemantik, gambar/video masalah |
| 2 | Mengorganisasikan siswa untuk belajar: Guru membantu mendefinisikan & mengorganisasikan tugas belajar | Pembagian kelompok, instruksi tugas, unduh LKPD |
| 3 | Membimbing penyelidikan individu maupun kelompok: Guru mendorong pengumpulan informasi, eksperimen, pemecahan masalah | Sumber bacaan, kolom diskusi kelompok, link materi terkait |
| 4 | Menghubungkan dan menyajikan hasil karya: Guru membantu merencanakan & menyiapkan karya (laporan, model) | Upload laporan, galeri hasil kerja, presentasi kelompok |
| 5 | Menganalisis dan mengevaluasi proses pemecahan masalah: Guru membantu refleksi/evaluasi | Refleksi tertulis, kuis formatif, feedback guru |

### 6. Halaman Pretest / Posttest (Quiz.html)

- 20 soal pilihan ganda (A, B, C, D)
- Level kognitif: C1 (Mengingat), C2 (Memahami), C3 (Mengaplikasikan), C4 (Menganalisis)
- Tampilkan 1 soal per view, navigasi prev/next
- Progress: "Soal 5/20"
- Grid navigasi soal 1-20 dengan status dijawab/belum
- Timer opsional (jika duration_min di-set)
- Setelah submit:
  - Server hitung skor: Benar = 1, Salah = 0
  - Rumus: **Nilai = (Jumlah Benar / 20) × 100**
  - Simpan ke test_attempts dan test_answers
  - Tampilkan skor ke siswa TANPA kunci jawaban
- Anti-cheat: cek di test_attempts, jika sudah ada → tolak
- Posttest hanya bisa diakses jika pretest selesai DAN is_open = TRUE di sheet tests

### 7. Halaman Angket Motivasi (Angket.html)

- Struktur: 4 indikator × 4 deskriptor = 16 item pernyataan
- Skala Likert 1-4:
  - 1 = Sangat Tidak Setuju
  - 2 = Tidak Setuju
  - 3 = Setuju
  - 4 = Sangat Setuju
- Kategori deskriptor (dari proposal):
  a. Muncul indikator dengan batas rendah
  b. Muncul indikator dengan kualitas cukup
  c. Muncul indikator dengan batas baik
  d. Muncul indikator dengan kualitas sangat baik
- Semua 16 item dalam satu halaman (scroll)
- Grouping per indikator
- Validasi: semua item harus diisi
- Hanya bisa diakses SETELAH posttest selesai
- Siswa hanya bisa mengisi 1x
- Rumus: **Nilai = (Skor Diperoleh / Skor Total) × 100**

### 8. Halaman Diskusi (Diskusi.html)

- Kolom komentar per topik materi
- Nested reply (siswa bertanya → guru menjawab)
- Moderasi guru (is_approved)
- Avatar inisial (huruf pertama nama)
- Timestamp
- Guru bisa hapus komentar tidak relevan

### 9. Halaman Tugas (Tugas.html)

- Daftar tugas per fase PBL
- Upload file ke Google Drive via GAS (PDF, DOC, JPG, PNG, max 5MB)
- Status: belum submit / sudah submit / dinilai
- Guru bisa beri nilai dan feedback

### 10. Dashboard Guru (DashboardGuru.html)

- Ringkasan: total siswa terdaftar, % selesai pretest/posttest/angket, rata-rata nilai
- Tabel siswa: NIS, Nama, Status Pretest, Nilai Pretest, Status Posttest, Nilai Posttest, Status Angket, Skor Motivasi
- Sortable, filterable, searchable
- Grafik sederhana (Google Charts via CDN)
- Tombol buka/tutup pretest, posttest, angket
- Link CRUD materi, CRUD soal
- Moderasi komentar
- Manajemen kode akses kelas

### 11. Ekspor Data (di DashboardGuru)

3 tombol ekspor:

**File 1: hasil_belajar.csv**
```
id_siswa,kelas,pretest_score,pretest_value,posttest_score,posttest_value,n_gain
S001,eksperimen,13,65.00,17,85.00,0.57
```

**File 2: butir_soal.csv**
```
id_siswa,jenis_test,no_soal,kunci,jawaban_siswa,skor,level_kognitif
S001,pretest,1,A,A,1,C1
```

**File 3: motivasi.csv**
```
id_siswa,kelas,skor_ind1,skor_ind2,skor_ind3,skor_ind4,total_motivasi
S001,eksperimen,14,12,13,15,54
```

PENTING: Gunakan ID anonim (S001, S002, ...), BUKAN NIS asli, untuk menjaga privasi siswa.

---

## FUNGSI GAS YANG HARUS DIBUAT

### Code.gs (Router)
```javascript
function doGet(e) {
  // Routing berdasarkan parameter ?page=xxx
  // Return HtmlService.createTemplateFromFile('Views/xxx')
  // Jika belum login dan page bukan 'register'/'login' → redirect ke login
}

function doPost(e) {
  // Handle form submit via google.script.run
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile('Components/' + filename).getContent();
}
```

### AuthService.gs
```javascript
function register(nis, nama, password, confirmPassword, accessCode) {
  // 1. Validasi input
  // 2. Cek NIS sudah terdaftar? Jika ya → error
  // 3. Validasi accessCode di sheet class_config
  //    - Jika tidak ditemukan → error "Kode akses tidak valid"
  //    - Jika is_eksperimen = FALSE → error "Kelas ini bukan kelas eksperimen"
  // 4. Cek kuota (max_students)
  // 5. Hash password
  // 6. Simpan ke sheet users
  // 7. Log activity
  // 8. Return success
}

function login(nis, password) {
  // 1. Cari NIS di sheet users
  // 2. Cocokkan password hash
  // 3. Buat session (CacheService, expiry 2 jam)
  // 4. Log activity
  // 5. Return { success, user, role }
}

function logout() { /* Hapus session */ }

function getCurrentUser() { /* Ambil dari session */ }

function requireAuth() { /* Middleware: cek session, throw jika tidak ada */ }

function hashPassword(password) {
  // Gunakan Utilities.computeDigest('SHA-256', password + SALT)
}
```

### DbService.gs
```javascript
function getSheet(name) { /* Return sheet by name */ }
function getAllRows(sheetName) { /* Return array of objects */ }
function findRow(sheetName, column, value) { /* Cari 1 baris */ }
function findRows(sheetName, column, value) { /* Cari banyak baris */ }
function insertRow(sheetName, data) { /* Tambah baris */ }
function updateRow(sheetName, rowIndex, data) { /* Update baris */ }
function deleteRow(sheetName, rowIndex) { /* Hapus baris */ }
function getNextId(sheetName) { /* Auto-increment ID */ }
function countRows(sheetName, column, value) { /* Hitung baris dengan kondisi */ }
```

### QuizService.gs
```javascript
function getQuestions(testType) {
  // Ambil soal dari sheet questions
  // PENTING: JANGAN kirim correct_answer ke client
  // Return: id, question_text, option_a-d, cognitive_level, order_num
}

function submitTest(userId, testType, answers) {
  // 1. Cek sudah pernah submit (anti-cheat)
  // 2. Ambil kunci jawaban dari sheet questions (server-side only)
  // 3. Hitung skor
  // 4. Simpan ke test_attempts dan test_answers
  // 5. Gunakan LockService untuk mencegah race condition
  // 6. Return skor final
}

function getTestResult(userId, testType) {
  // Return skor siswa (tanpa kunci jawaban)
}

function isTestOpen(testType) {
  // Cek is_open di sheet tests
}

function hasCompletedTest(userId, testType) {
  // Cek di test_attempts
}
```

### MotivationService.gs
```javascript
function getQuestions() {
  // Ambil 16 item dari sheet motivation_indicators
}

function submitMotivation(userId, responses) {
  // Validasi semua 16 item terisi
  // Cek sudah pernah submit
  // Simpan ke motivation_responses
}

function getMotivationResult(userId) {
  // Hitung skor per indikator dan total
}
```

### GuruService.gs
```javascript
function getRecap() {
  // Rekap semua siswa: status register, pretest, posttest, angket, nilai
}

function toggleTest(testType, isOpen) {
  // Update is_open di sheet tests
}

function manageAccessCode(action, kelas, code) {
  // CRUD kode akses kelas di sheet class_config
}

function exportHasilBelajar() {
  // Generate CSV dari data test_attempts
  // Gunakan ID anonim
}

function exportButirSoal() {
  // Generate CSV dari test_answers + questions
}

function exportMotivasi() {
  // Generate CSV dari motivation_responses
}

function getRegisteredStudents() {
  // Daftar semua siswa yang sudah register
}

function approveComment(commentId) {
  // Set is_approved = TRUE
}

function deleteComment(commentId) {
  // Hapus komentar
}
```

---

## ALUR REGISTRASI → LOGIN → BELAJAR

```
┌─────────────────────────────────────────────────────────────────┐
│                        ALUR SISWA                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Guru memberikan KODE AKSES KELAS ke kelas eksperimen        │
│     (mis: "DDK2025-EKS")                                        │
│                                                                  │
│  2. Siswa buka URL Web App → Halaman Register                   │
│     Input: NIS, Nama, Password, Kode Akses Kelas                │
│                                                                  │
│  3. Server validasi:                                            │
│     ✓ NIS belum terdaftar                                       │
│     ✓ Kode akses valid & is_eksperimen = TRUE                   │
│     ✓ Kuota belum penuh (max 30)                                │
│     ✓ Password & konfirmasi cocok                               │
│                                                                  │
│  4. Registrasi sukses → Redirect ke Login                       │
│                                                                  │
│  5. Siswa Login (NIS + Password)                                │
│                                                                  │
│  6. Masuk Dashboard Siswa                                       │
│     ├── Pretest (20 soal PG)                                    │
│     ├── Belajar Materi (4 topik)                                │
│     ├── Aktivitas PBL (5 fase)                                  │
│     ├── Diskusi                                                 │
│     ├── Tugas                                                   │
│     ├── Posttest (20 soal PG) ← hanya jika pretest selesai     │
│     └── Angket Motivasi ← hanya jika posttest selesai           │
│                                                                  │
│  7. Guru melihat rekap di Dashboard Guru                        │
│                                                                  │
│  8. Guru ekspor data CSV untuk analisis SPSS                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## UI/UX DESIGN

### Palet Warna
- Primary: #0F3460 (Navy)
- Accent: #E94560 (Merah)
- Dark Text: #16213E
- Success: #1DB954 (Hijau)
- Warning: #E6A817 (Kuning)
- Background: #F8F9FA
- Card Background: #FFFFFF

### Tipografi
- Font: 'Segoe UI', system font stack
- H1: 22px bold, H2: 18px semibold, Body: 14px, Small: 12px
- Button: 14px semibold

### Prinsip Desain
- Mobile-first (360px+)
- Minimalis, tidak ada elemen dekoratif berlebihan
- Kontras tinggi untuk keterbacaan di layar HP
- Maks 3 klik dari homepage ke konten manapun
- Toast notification untuk feedback setiap aksi
- Konsisten: warna, spacing, komponen sama di seluruh halaman
- Loading state untuk setiap aksi async (submit kuis, register, dll)

### Komponen UI
- Navbar: sticky top, max 7 item, hamburger di mobile
- Card Materi: icon + judul + progress bar + tombol "Lanjutkan"
- Quiz Container: 1 soal per view, navigasi prev/next, progress indicator
- Likert Scale: 4 tombol radio horizontal (1-4)
- Comment Thread: nested reply, avatar inisial, timestamp
- Progress Bar: hijau jika ≥75%, kuning jika <75%
- Data Table (guru): sortable, filterable, pagination 10 baris
- Toast Notification: muncul 3 detik di pojok kanan atas
- Form Input: label di atas, border jelas, error message merah di bawah

---

## SEED DATA

### class_config (1 baris)
```
kelas: 'X TITL 1'
access_code: 'DDK2025-EKS'
is_eksperimen: TRUE
max_students: 30
```

### users (1 guru + 1 admin)
```
Guru: nama='Guru Pamong', role='guru', is_eksperimen=TRUE
Admin: nama='Admin', role='admin', is_eksperimen=TRUE
```
Catatan: Siswa TIDAK di-seed. Siswa mendaftar sendiri via halaman Register.

### materials (4 topik)
- Topik 1: "Proses Perencanaan Instalasi"
- Topik 2: "Pembuatan Panel"
- Topik 3: "Pemeliharaan, Perbaikan, dan Perawatan Peralatan Ketenagalistrikan"
- Topik 4: "Pengelolaan SDM"

### questions (40 soal: 20 pretest + 20 posttest)
- Distribusi per tes: 5×C1, 5×C2, 5×C3, 5×C4
- Teks placeholder: "Contoh soal [C-level] nomor [X] tentang [topik DDK]"
- correct_answer: random A/B/C/D

### motivation_indicators (16 item)
- Indikator 1 (Dorongan Belajar): 4 deskriptor
- Indikator 2 (Ketekunan): 4 deskriptor
- Indikator 3 (Minat): 4 deskriptor
- Indikator 4 (Lingkungan Belajar): 4 deskriptor

### pbl_phases (5 fase)
- Fase 1: "Orientasi Siswa kepada Masalah"
- Fase 2: "Mengorganisasikan Siswa untuk Belajar"
- Fase 3: "Membimbing Penyelidikan Individu maupun Kelompok"
- Fase 4: "Menghubungkan dan Menyajikan Hasil Karya"
- Fase 5: "Menganalisis dan Mengevaluasi Proses Pemecahan Masalah"

---

## OUT OF SCOPE (JANGAN DIBUAT)

- Gamifikasi (poin, lencana, leaderboard)
- AI chatbot / AI tutor
- Video conference / live streaming
- Forum publik terbuka
- Sistem pembayaran
- Aplikasi mobile native (Android/iOS)
- Blog berita / company profile
- Pengganti total PPT dan model PBL
- Login via Google OAuth (cukup NIS + password)

---

## ACCEPTANCE CRITERIA

Web app dianggap selesai jika:

### Registrasi & Login
1. ✅ Siswa bisa register dengan NIS + Nama + Password + Kode Akses Kelas
2. ✅ Registrasi ditolak jika NIS sudah terdaftar
3. ✅ Registrasi ditolak jika kode akses salah/tidak valid
4. ✅ Registrasi ditolak jika kuota kelas penuh (30 siswa)
5. ✅ Siswa bisa login dengan NIS + Password
6. ✅ Login ditolak jika password salah
7. ✅ Session expire setelah 2 jam

### Akses & Keamanan
8. ✅ Siswa kelas kontrol TIDAK BISA register/login (tidak punya kode akses)
9. ✅ Kunci jawaban tidak tampil di client
10. ✅ Password disimpan sebagai hash, bukan plain text
11. ✅ Siswa hanya bisa submit pretest/posttest 1x

### Pembelajaran
12. ✅ Siswa bisa baca 4 topik materi DDK
13. ✅ Siswa bisa unduh file materi (Google Drive)
14. ✅ Siswa bisa komentar/diskusi per materi
15. ✅ Siswa bisa kerjakan pretest (20 PG)
16. ✅ Siswa bisa kerjakan posttest (20 PG) — hanya setelah pretest selesai
17. ✅ Siswa bisa isi angket motivasi (16 item) — hanya setelah posttest selesai
18. ✅ Siswa bisa upload tugas per fase PBL

### Scoring
19. ✅ Scoring otomatis: Nilai = (Benar/20) × 100
20. ✅ Angket scoring: Nilai = (Skor Diperoleh/Skor Total) × 100

### Dashboard Guru
21. ✅ Guru bisa lihat rekap semua siswa
22. ✅ Guru bisa buka/tutup pretest, posttest, angket
23. ✅ Guru bisa kelola kode akses kelas
24. ✅ Guru bisa ekspor 3 file CSV
25. ✅ Ekspor pakai ID anonim (S001, S002, ...)

### Umum
26. ✅ Tampilan responsif di smartphone (360px+)
27. ✅ Data tidak hilang setelah submit
28. ✅ Activity log tercatat untuk semua aksi (register, login, view, submit)

---

## INSTRUKSI UNTUK AI CODER

1. Buat semua file .gs dan .html sesuai struktur di atas.
2. Mulai dari DbService.gs (helper CRUD Google Sheets).
3. Buat AuthService.gs dengan fitur REGISTER dan LOGIN.
4. Buat QuizService.gs dengan anti-cheat dan kunci jawaban tersembunyi.
5. Buat MotivationService.gs.
6. Buat halaman frontend satu per satu (Register → Login → Dashboard → dst).
7. Buat GuruService.gs dengan fitur ekspor dan manajemen kode akses.
8. Buat seed data script (fungsi setupDatabase()).
9. Buat README.md dengan:
   - Cara buat Google Spreadsheet
   - Cara setup 13 sheet
   - Cara paste kode ke Apps Script editor
   - Cara deploy sebagai Web App
   - Cara share URL ke siswa
   - Cara guru mendapatkan kode akses kelas
10. JANGAN skip keamanan: isolasi perlakuan, anti-cheat, kunci jawaban, password hashing.
11. Gunakan komentar kode yang jelas untuk setiap fungsi penting.
12. Semua fungsi GAS harus handle error dengan try-catch.
13. Gunakan LockService untuk mencegah race condition saat submit kuis dan register.
14. Gunakan CacheService untuk session management (expiry 2 jam).
15. Pastikan halaman Register dan Login bisa diakses TANPA session (public).
16. Semua halaman lain WAJIB require session valid.

Mulai dari setup spreadsheet structure dan DbService.gs terlebih dahulu, lalu AuthService.gs (register + login), kemudian fitur-fitur lainnya.
```

---

Simpan sebagai **`prompt_qwen_coder_gas.md`**. Perubahan utama dari versi sebelumnya:

| Fitur Baru | Keterangan |
|---|---|
| **Halaman Register** | Siswa daftar sendiri pakai NIS + Kode Akses Kelas |
| **Sheet class_config** | Menyimpan kode akses kelas + kuota siswa |
| **Validasi kode akses** | Hanya kelas eksperimen yang bisa register |
| **Kuota 30 siswa** | Registrasi ditolak jika kelas sudah penuh |
| **Password hashing** | SHA-256 via Utilities.computeDigest |
| **Rate limit register** | 1 request/NIS/menit via CacheService |
| **Alur lengkap** | Register → Login → Pretest → Belajar → Posttest → Angket |