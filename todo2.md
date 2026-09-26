# TODO Backend — Google Apps Script (GAS) & Sheets

> Detail backend dari `PLAN.md` **disinkronisasi** dengan `SKRIPSI PEND TEKNIK ELEKTRO RISMAULI NAPITUPULU 14 Mar.pdf`. Frontend ringkas di `todo.MD`.

## 0. Setup Project GAS (`PLAN.md:50-73`, `PLAN.md:244-275` + PDF p18-20)
- [ ] Buat project Apps Script terhubung ke Spreadsheet `DB_Weblog_DDK_SMK_TR2`
- [ ] Buat file: `Code.gs`, `DbService.gs`, `AuthService.gs`, `MaterialService.gs`, `QuizService.gs`, `MotivationService.gs`, `PblService.gs`, `CommentService.gs`, `GuruService.gs`, `Utils.gs` (`PLAN.md:246-255`)
- [ ] Buat folder Views (11 HTML) + Components (Navbar, Footer, Toast) + Styles/Main.css (`PLAN.md:256-274`)
- [ ] Set `appsscript.json` untuk HtmlService & Drive/Sheets scope
- [ ] Catatan PDF p19: blog gratis (wordpress/blogspot) → tidak perlu hosting berat, GAS cukup

## 1. Spreadsheet DB — 13 Sheet (`PLAN.md:94-239`)
Buat 1 spreadsheet `DB_Weblog_DDK_SMK_TR2` (`PLAN.md:96`):

- [ ] **users** A:id B:nis UNIK C:nama D:kelas (X TITL 1/2 `PDF p32`) E:role F:is_eksperimen G:password_hash H:registered_at I:is_active (`PLAN.md:100-111`)
- [ ] **class_config** A:id B:kelas C:access_code D:is_eksperimen E:max_students=30 (`PLAN.md:113-121` + `PDF p32-33: 30/kelas random sampling`)
- [ ] **materials** A:id B:topik 1-4 C:judul D:konten HTML E:file_ppt_url F:file_pdf_url G:gambar_url H:published_at I:is_active (`PLAN.md:123-134`) — judul wajib PDF p24-28
- [ ] **tests** A:id B:type pretest/posttest C:total_questions=20 `PDF p42: 20 soal PG` D:duration_min E:is_open F:created_at (`PLAN.md:136-144`)
- [ ] **questions** A:id B:test_id C:question_text D:option_a E:option_b F:option_c G:option_d H:correct_answer A-D **JANGAN ke client** I:cognitive_level C1-C4 `PDF p34-35: C1 mengingat C2 memahami C3 mengaplikasikan C4 menganalisis` J:order_num (`PLAN.md:146-158`)
- [ ] **test_attempts** A:id B:user_id C:test_id D:raw_score E:final_value=(raw/20)*100 `PDF p35` F:started_at G:submitted_at | UNIQUE(user_id,test_id) (`PLAN.md:160-170`)
- [ ] **test_answers** A:id B:attempt_id C:question_id D:selected_answer E:is_correct F:score 0/1 `PDF p35: benar 1 salah 0` (`PLAN.md:172-181`)
- [ ] **motivation_indicators** A:id B:indicator_name C:descriptor_num 1-4 D:statement_text E:order_num (`PLAN.md:183-191` + `PDF p41: 4 indikator ×4 deskriptor`)
- [ ] **motivation_responses** A:id B:user_id C:indicator_id D:response_value 1-4 E:submitted_at (`PLAN.md:193-199` + `PDF p41: skala Likert 1-4`)
- [ ] **comments** A:id B:user_id C:material_id D:content E:parent_id F:is_approved G:created_at (`PLAN.md:201-210`)
- [ ] **pbl_phases** A:id B:phase_num 1-5 C:title D:description E:file_url LKPD (`PLAN.md:212-219` + `PDF p22-23 Tabel2`)
- [ ] **task_submissions** A:id B:user_id C:pbl_phase_id D:file_url Drive E:score F:feedback G:submitted_at (`PLAN.md:222-230`)
- [ ] **activity_logs** A:id B:user_id C:action (register/login/view_materi/submit_kuis…) D:target_id E:timestamp (`PLAN.md:232-238`) — untuk 9 langkah PDF p40-41 audit trail
- [ ] Freeze header + validasi tipe

## 2. Utils.gs (`PLAN.md:255`)
- [ ] `generateId(sheetName)` via `getNextId()` (`PLAN.md:549`)
- [ ] `hashPassword(password)` → `Utilities.computeDigest('SHA-256', password+SALT)` hex (`PLAN.md:535-537`, `PLAN.md:303`)
- [ ] `formatValue(v)`, `now()`, `sanitizeInput()`, `anonId(index)` → S001 (`PLAN.md:483`)
- [ ] `handleError(e)` try-catch semua service (`PLAN.md:843`)
- [ ] `calcNilai(score,total)` → (score/total)*100 `PDF p35 & p41`

## 3. DbService.gs — CRUD Helper (`PLAN.md:540-551`)
- [ ] `getSheet(name)` → `SpreadsheetApp.getActive().getSheetByName()` + error jika null
- [ ] `getAllRows(sheetName)` → array objects header→value
- [ ] `findRow(sheetName, column, value)` & `findRows(...)`
- [ ] `insertRow(sheetName, dataObj)` mapping header
- [ ] `updateRow(sheetName, rowIndex, dataObj)`
- [ ] `deleteRow(sheetName, rowIndex)`
- [ ] `getNextId(sheetName)` → max(id)+1
- [ ] `countRows(sheetName, column, value)` untuk kuota 30
- [ ] Wrap `LockService.getScriptLock()` saat write

## 4. AuthService.gs — Register/Login/Session (`PLAN.md:506-538`, `PLAN.md:281-331` + PDF p40-41 langkah 1-6)
- [ ] `register(nis,nama,password,confirmPassword,accessCode)`:
  ```
  1. validasi wajib, password>=6, confirm sama (PLAN.md:293)
  2. findRow users nis → jika ada error "NIS sudah terdaftar" (AC2)
  3. findRow class_config access_code → null → "Kode akses tidak valid" (PLAN.md:296-298)
  4. is_eksperimen==FALSE → "Kelas ini bukan kelas eksperimen" (Hard #1, PDF p40 langkah 5: kontrol tanpa weblog)
  5. countRows users kelas → >=30 → "Kuota penuh" (PLAN.md:301-302, PDF p32)
  6. hashPassword(password)
  7. insertRow users {role:siswa,is_eksperimen:TRUE,is_active:TRUE,registered_at:now()}
  8. insertRow activity_logs action=register
  9. return success + CacheService rate limit 1/NIS/menit
  ```
  WAJIB `LockService` cegah race NIS+kuota (`PLAN.md:843`)
- [ ] `login(nis,password)`:
  ```
  1. findRow users nis → null → "NIS tidak terdaftar"
  2. hash compare → salah → error
  3. CacheService.put(session, JSON user, 7200s=2jam) (PLAN.md:322)
  4. activity_logs login
  5. return {success,user,role} redirect /dashboard atau /guru
  ```
- [ ] `logout()` → Cache remove
- [ ] `getCurrentUser()` → Cache get
- [ ] `requireAuth()` → throw/redirect jika no session, kecuali register/login public (`PLAN.md:845-846`)
- [ ] `hashPassword()` konsisten

## 5. Code.gs — Router (`PLAN.md:489-504`)
- [ ] `doGet(e)`:
  ```js
  page = e.parameter.page || 'login'
  user = getCurrentUser()
  if (!user && page!='register' && page!='login') return Login.html
  switch page → Views/xxx
  return HtmlService.createTemplateFromFile('Views/'+page).evaluate().setXFrameOptionsMode(ALLOWALL)
  ```
- [ ] `doPost(e)` opsional (utama google.script.run)
- [ ] `include(filename)` → Components (`PLAN.md:501-503`)
- [ ] Auth guard: register/login public, lainnya requireAuth (`PLAN.md:846`)

## 6. QuizService.gs — Pretest/Posttest + Anti-Cheat (`PLAN.md:552-581`, `PLAN.md:399-413` + PDF p34-42)
- [ ] `getQuestions(testType)`:
  - Lookup `tests` where type==testType → id
  - `findRows questions test_id`
  - **Strip `correct_answer`** (Hard #3, `PLAN.md:559`)
  - Return id, question_text, option_a-d, cognitive_level, order_num sorted
- [ ] `submitTest(userId,testType,answers)`:
  ```
  1. LockService.waitLock(10000)
  2. cek hasCompletedTest → jika ada tolak (ANTI-CHEAT PLAN.md:81,561)
  3. ambil correct_answer server-side only
  4. loop hitung is_correct & score 0/1 `PDF p35`, raw sum
  5. final_value=(raw/20)*100 `PDF p35 & p42`
  6. insertRow test_attempts + loop test_answers
  7. activity_logs submit_kuis
  8. return {raw,final} tanpa kunci
  ```
- [ ] `getTestResult(userId,testType)` tanpa kunci
- [ ] `isTestOpen(testType)` → tests.is_open guru toggle (`PLAN.md:412`, PDF p40 langkah6 kondisi sama tapi guru kontrol buka/tutup)
- [ ] `hasCompletedTest(userId,testType)` → test_attempts
- [ ] Gate posttest: `hasCompletedTest(pretest) && isTestOpen(posttest)` (`PLAN.md:412`)
- [ ] Catatan validasi soal (tidak di kode, tapi README guru `PDF p35-40`):
  - Validitas product moment `PDF p35-36`: r_xy=[NΣXY-(ΣX)(ΣY)]/√[(NΣX²-(ΣX)²)(NΣY²-(ΣY)²)], valid jika r_hitung>r_tabel dbN-2 α0.05
  - Reliabilitas Cronbach `PDF p36-37`: r11=K/(K-1)(1-Σs²/St²), Tabel3 0.800-1.000 sangat tinggi
  - Kesukaran P=B/JS `PDF p38`: P<0.2 sulit, 0.2-0.8 sedang, >0.8 mudah (syarat 0.20-0.80)
  - Daya beda D=BA/JA-BB/JB `PDF p39`: -1 s/d +1, syarat 0.20-1.00, Tabel5 0.00-0.20 tidak baik…0.71-1.00 sangat baik

## 7. MotivationService.gs (`PLAN.md:582-598`, `PLAN.md:415-433` + PDF p41-42)
- [ ] `getMotivationQuestions()` → 16 item `PDF p41: 4 indikator×4 deskriptor`, kategori a rendah/b cukup/c baik/d sangat baik `PDF p41-42`
- [ ] `submitMotivation(userId, responses{indicator_id:1-4})`:
  ```
  1. validasi 16 terisi
  2. cek sudah pernah submit → tolak 1×
  3. Gate: hasCompletedTest(posttest) else tolak (PLAN.md:430, PDF p41 langkah7)
  4. loop insertRow motivation_responses
  5. activity_logs submit_angket
  ```
- [ ] `getMotivationResult(userId)` → skor per indikator (sum 4 item, max 16) & total max 64, **Nilai=(Diperoleh/64)*100** `PDF p41` + kategori a-d
- [ ] Skala Likert 1 STS 2 TS 3 S 4 SS `PLAN.md:417-421` konsisten PDF

## 8. MaterialService.gs + PblService.gs + CommentService.gs
- [ ] **MaterialService.gs** `getMaterials()`, `getMaterialById(id)`, `markComplete(userId,materialId)` → log view_materi — konten HTML wajib wording PDF p24-28 (4 topik)
- [ ] **PblService.gs** `getPhases()`, `getPhaseDetail(phase_num)`, `submitTask(userId,pbl_phase_id,fileBlob)` → DriveApp.createFile, simpan `task_submissions.file_url`, `getSubmissions()` status belum/sudah/dinilai (`PLAN.md:421-448`)
  - Wording phases wajib PDF Tabel2 p22-23 (Arends 2008): F1 Orientasi tujuan/logistik/motivasi, F2 Mengorganisasikan definisi tugas, F3 Membimbing penyelidikan info/eksperimen, F4 Menghubungkan & menyajikan laporan/model/berbagi, F5 Menganalisis mengevaluasi refleksi
  - Validasi upload: PDF/DOC/JPG/PNG max 5MB (`PLAN.md:446`)
- [ ] **CommentService.gs** `getComments(material_id)` where is_approved==TRUE, `addComment(userId,material_id,content,parent_id)`, `approveComment(id)`, `deleteComment(id)` (guru, `PLAN.md:634-637`)

## 9. GuruService.gs (`PLAN.md:600-638`, `PLAN.md:450-484` + PDF p42-45)
- [ ] `getRecap()` → join users+test_attempts+motivation: per siswa anonim, status pre/post/angket, nilai pre/post, skor motivasi, rata kelas, % selesai — untuk cek homogen pretest `PDF p40 langkah2-3` & rata contoh `PDF p28: pretest eksperimen 49.58 vs kontrol 46.25`, motivasi 70.36% vs 61.6% `PDF p28-29`
- [ ] `toggleTest(testType,isOpen)` → updateRow tests is_open (AC22)
- [ ] `manageAccessCode(action,kelas,code)` CRUD class_config (AC23)
- [ ] **Ekspor 3 CSV ID anonim** (`PLAN.md:613-625`, PDF p42-45 untuk SPSS):
  - [ ] `exportHasilBelajar()` → hasil_belajar.csv: S001,kelas,pretest_score,pretest_value,posttest_score,posttest_value,n_gain=(post-pre)/(100-pre) — untuk **uji-t pihak kanan `PDF p43-44` thitung=(X1-X2)/S√(1/n1+1/n2) db n1+n2-2 α0.05 thitung>ttabel Ha diterima**, plus **normalitas chi kuadrat JK6 PK=(max-min)/6 x²hitung<x²tabel normal `PDF p42-43`** & **homogenitas F=varians besar/kecil Fhit<Ftabel homogen `PDF p43`**
  - [ ] `exportButirSoal()` → butir_soal.csv: id,jenis,no,kunci,jawaban,skor,level C1-C4 — untuk **validitas/reliabilitas/kesukaran/daya beda `PDF p35-40`** (analisis butir)
  - [ ] `exportMotivasi()` → motivasi.csv: id,kelas,skor_ind1-4,total,nilai_motivasi — untuk **korelasi product moment `PDF p44-45` r=[NΣXY-(ΣX)(ΣY)]/√[(NΣX²-(ΣX)²)(NΣY²-(ΣY)²)] Tabel6 0.00 tidak berkorelasi…0.81-1.00 sangat tinggi, CD=r² `PDF p45-46`**
  - WAJIB anonim S001 bukan NIS asli (`PLAN.md:483`)
- [ ] `getRegisteredStudents()` + `approveComment()` + `deleteComment()` (`PLAN.md:627-637`)
- [ ] Grafik Google Charts CDN (frontend)

## 10. Keamanan & Hardening (`PLAN.md:76-92`, `PLAN.md:843-846` + PDF p40-41)
- [ ] `LockService` di register & submitTest cegah race (`PLAN.md:843`)
- [ ] `CacheService` session 7200s + rate limit 1/menit/NIS (`PLAN.md:313,844`)
- [ ] `try-catch` semua fungsi return {success:false,msg} (`PLAN.md:842`)
- [ ] Register/Login public, lainnya `requireAuth()` (`PLAN.md:845-846`)
- [ ] `PropertiesService` untuk SALT
- [ ] Pertahankan 9 langkah PDF: siswa tidak tahu disampel `PDF p41 langkah4` + kondisi terkontrol `PDF p41 langkah6` (PBL/PPT/guru/waktu sama, hanya weblog beda)

## 11. Seed Data Script (`PLAN.md:722-760` + PDF)
Buat `setupDatabase()` sekali run:
- [ ] `class_config`: {id:1, kelas:'X TITL 1', access_code:'DDK2025-EKS', is_eksperimen:TRUE, max_students:30} `PDF p32-33`
- [ ] `users`: 2 row guru/admin (hash default, role guru/admin) `PLAN.md:730-734`
- [ ] `materials`: 4 row judul PDF p24-28 + konten HTML lengkap (tujuan, materi a-f, gambar, RAB, contoh genset otomatis, SOP, alur SDM) + Drive URL dummy
- [ ] `tests`: 2 row pretest+posttest 20 soal `PDF p42` is_open false/true
- [ ] `questions`: 40 row (20+20) distribusi 5×C1-5×C2-5×C3-5×C4 `PLAN.md:745` `PDF p34-35`, kunci random A-D, teks placeholder "[C-level] tentang DDK"
- [ ] `motivation_indicators`: 16 row `PDF p41` 4 indikator×4 deskriptor, order_num 1-16, indicator_name generik + statement_text contoh motivasi `PDF p41-42 kategori a-d`
- [ ] `pbl_phases`: 5 row Arends `PDF p22-23 Tabel2` + file_url LKPD dummy
- [ ] Idempoten cek sebelum insert

## 12. Checklist Deploy & README (`PLAN.md:834-840` + PDF p18-19)
- [ ] README.md: cara buat spreadsheet 13 sheet + paste GAS + deploy Execute as me + share URL + guru bagikan DDK2025-EKS hanya ke eksperimen `PDF p40 langkah1: pendataan kuesioner` + lampiran cara buat blog `PDF p18-19`
- [ ] Verifikasi AC 1-28 (`PLAN.md:779-821`) + 9 langkah PDF p40-41 sebelum declare selesai
- [ ] Uji: register kuota 30, kontrol ditolak, 1× submit blocked, kunci tidak bocor di Network, hash di sheet, mobile 360px, log lengkap `PDF p42-45` export bisa diuji normalitas/homogenitas/t/korelasi di SPSS

---
**Urutan Backend:** DbService → Utils → AuthService → QuizService → MotivationService → Pbl/Comment → GuruService → Code router → seed → harden → deploy. Semua wording materi/PBL/rumus pakai PDF, bukan ringkas PLAN.
