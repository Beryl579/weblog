/**
 * Setup.gs — Seed data untuk 14 sheet
 * PLAN.md:722-760 + PDF p24-28, p22-23, p34-35, p41
 * Jalankan 1×: setupDatabase() di Apps Script editor
 */

function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    // jika belum ada spreadsheet, buat baru
    ss = SpreadsheetApp.create('DB_Weblog_DDK_SMK_TR2');
    Logger.log('Spreadsheet baru: ' + ss.getUrl());
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  }

  // Definisi 14 sheet dengan header — PLAN.md:100-238 (+ 'progress' untuk nilai kuis/ujian)
  var sheetsDef = {
    'users': ['id','nis','nama','kelas','role','is_eksperimen','password_hash','registered_at','is_active'],
    'class_config': ['id','kelas','access_code','is_eksperimen','max_students'],
    'materials': ['id','topik','judul','konten','file_ppt_url','file_pdf_url','gambar_url','published_at','is_active'],
    'tests': ['id','type','total_questions','duration_min','is_open','created_at'],
    'questions': ['id','test_id','question_text','option_a','option_b','option_c','option_d','correct_answer','cognitive_level','order_num'],
    'test_attempts': ['id','user_id','test_id','raw_score','final_value','started_at','submitted_at'],
    'test_answers': ['id','attempt_id','question_id','selected_answer','is_correct','score'],
    'motivation_indicators': ['id','indicator_name','descriptor_num','statement_text','order_num'],
    'motivation_responses': ['id','user_id','indicator_id','response_value','submitted_at'],
    'comments': ['id','user_id','material_id','content','parent_id','is_approved','created_at'],
    'pbl_phases': ['id','phase_num','title','description','file_url'],
    'task_submissions': ['id','user_id','pbl_phase_id','file_url','score','feedback','submitted_at'],
    'activity_logs': ['id','user_id','action','target_id','timestamp'],
    'progress': ['id','user_id','nis','quiz_key','best_score','score','total_questions','passed','attempts','updated_at']
  };

  // Buat / reset header
  for (var name in sheetsDef) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    sheet.clear();
    sheet.getRange(1, 1, 1, sheetsDef[name].length).setValues([sheetsDef[name]]);
    sheet.getRange(1, 1, 1, sheetsDef[name].length).setFontWeight('bold').setBackground('#0F3460').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, sheetsDef[name].length);
  }

  // Hapus sheet default Sheet1 jika masih ada dan bukan bagian dari definisi di atas
  var extra = ss.getSheetByName('Sheet1');
  if (extra) ss.deleteSheet(extra);

  Logger.log('Header ' + Object.keys(sheetsDef).length + ' sheet dibuat. Lanjut seed...');

  seedClassConfig();
  seedUsers();
  seedMaterials();
  seedTests();
  seedQuestions();
  seedMotivationIndicators();
  seedPblPhases();

  Logger.log('setupDatabase SELESAI — cek spreadsheet: ' + ss.getUrl());
}

function seedClassConfig() {
  if (getAllRows('class_config').length > 0) { Logger.log('class_config sudah ada, skip'); return; }
  // CATATAN: kolom access_code TIDAK LAGI DIPAKAI — registrasi siswa terbuka,
  // siswa hanya memilih kelas (X TITL 1 / X TITL 2) saat daftar. Lihat AuthService.register().
  insertRow('class_config', { id: 1, kelas: 'X TITL 1', access_code: '', is_eksperimen: true, max_students: 40 });
  insertRow('class_config', { id: 2, kelas: 'X TITL 2', access_code: '', is_eksperimen: true, max_students: 40 });
  Logger.log('seed class_config OK (2 kelas, tanpa kode akses)');
}

function seedUsers() {
  if (countRows('users', 'role', 'guru') > 0) { Logger.log('users guru sudah ada, skip'); return; }
  // Guru (akses Dashboard Guru: GURU001 / guru123)
  // Guru Pamong — PDF p0: Drs. H. Purwanto, M.Pd.T
  insertRow('users', {
    id: 1,
    nis: 'GURU001',
    nama: 'Guru Pamong',
    kelas: 'X TITL 1',
    role: 'guru',
    is_eksperimen: true,
    password_hash: hashPassword('guru123'),
    registered_at: now(),
    is_active: true
  });
  insertRow('users', {
    id: 2,
    nis: 'ADMIN001',
    nama: 'Admin',
    kelas: 'X TITL 1',
    role: 'admin',
    is_eksperimen: true,
    password_hash: hashPassword('admin123'),
    registered_at: now(),
    is_active: true
  });
  // Siswa demo (login dummy untuk uji coba: 2024001 / siswa123)
  insertRow('users', {
    id: 3,
    nis: '2024001',
    nama: 'Siswa Contoh',
    kelas: 'X TITL 1',
    role: 'siswa',
    is_eksperimen: true,
    password_hash: hashPassword('siswa123'),
    registered_at: now(),
    is_active: true
  });
  Logger.log('seed users OK — guru: GURU001/guru123, admin: ADMIN001/admin123, siswa demo: 2024001/siswa123');
}

function seedMaterials() {
  if (getAllRows('materials').length > 0) { Logger.log('materials sudah ada, skip'); return; }
  // Konten HTML sesuai PDF p24-28, singkat tapi representatif
  var m1 = `
    <h3>Tujuan Pembelajaran</h3><p>Memahami proses perencanaan instalasi listrik gedung meliputi penawaran hingga serah terima (PDF p24).</p>
    <h3>a. Penawaran Pekerjaan</h3><p>Jasa ME ditawarkan pekerjaan instalasi listrik dari pemilik gedung/kontraktor utama sebagai sub-kontraktor.</p>
    <h3>b. Survei & Penjelasan Pekerjaan</h3><p>Menghubungi pemilik, survey untuk data terperinci kebutuhan instalasi.</p>
    <h3>c. Perencanaan</h3><p>Rancangan gambar pemasangan (lampu, stop kontak, genset, panel) + Rencana Anggaran Biaya (RAB): nilai material, jasa teknisi, sewa alat.</p>
    <h3>d. Presentasi</h3><p>Di depan pemilik pekerjaan, bahas kesesuaian, penggantian sampai kesepakatan.</p>
    <h3>e. Pelaksanaan (SPK + Pengawas)</h3><ul><li>Persiapan: alat, bahan, tenaga</li><li>Pelaksanaan: kerjakan sampai selesai</li><li>Tes/Commissioning: parsial & holistik</li></ul>
    <h3>f. Serah Terima</h3><p>Setelah selesai, serah terima pemilik–pelaksana.</p>
    <h3>Rangkuman</h3><p>Alur lengkap penawaran→survey→gambar+RAB→presentasi→SPK→persiapan→pelaksanaan→tes→serah terima.</p>
  `;
  var m2 = `
    <h3>Tujuan</h3><p>Memahami pembuatan panel kendali pensaklaran beban PLN–genset (PDF p26).</p>
    <p>Survey fokus pada peralatan yang dikendalikan (genset). Perhitungan peralatan, kabel, proteksi sesuai batas ukur sangat dibutuhkan. Konsultasi cara kerja panel dengan pemilik: contoh genset otomatis suplai seluruh gedung setelah pemadaman.</p>
    <h3>Contoh Kasus</h3><p>Pemilik menghendaki panel genset otomatis — gambar rancangan & RAB disesuaikan kebutuhan.</p>
  `;
  var m3 = `
    <h3>Tujuan</h3><p>Memahami pemeliharaan, perbaikan, perawatan peralatan ketenagalistrikan (PDF p27).</p>
    <h3>SOP & Jadwal</h3><p>Buat SOP sesuai peralatan. AC 3 bulan sekali, lampu, lift, pompa air, panel. Jadwal pengecekan harian untuk deteksi kerusakan.</p>
    <h3>Penanganan Kerusakan</h3><p>Jika bisa internal → kerjakan internal; jika tidak → order pihak ketiga. Data kerusakan dari laporan pemilik, tim siap sedia.</p>
  `;
  var m4 = `
    <h3>Tujuan</h3><p>Memahami pengelolaan SDM lulusan TITL (PDF p27-28).</p>
    <p>Posisi penting lulusan SMK teknik ketenagalistrikan dari perencanaan gedung:</p>
    <p><strong>Alur:</strong> perencanaan → gambar instalasi → survey → RAB → pemasangan → testing → commissioning → pemeliharaan → perawatan → perbaikan</p>
  `;
  insertRow('materials', { id: 1, topik: 1, judul: 'Proses Perencanaan Instalasi', konten: m1, file_ppt_url: 'https://drive.google.com/file/d/PLACEHOLDER_PPT1', file_pdf_url: 'https://drive.google.com/file/d/PLACEHOLDER_PDF1', gambar_url: '', published_at: now(), is_active: true });
  insertRow('materials', { id: 2, topik: 2, judul: 'Pembuatan Panel', konten: m2, file_ppt_url: 'https://drive.google.com/file/d/PLACEHOLDER_PPT2', file_pdf_url: 'https://drive.google.com/file/d/PLACEHOLDER_PDF2', gambar_url: '', published_at: now(), is_active: true });
  insertRow('materials', { id: 3, topik: 3, judul: 'Pemeliharaan, Perbaikan, dan Perawatan Peralatan Ketenagalistrikan', konten: m3, file_ppt_url: 'https://drive.google.com/file/d/PLACEHOLDER_PPT3', file_pdf_url: 'https://drive.google.com/file/d/PLACEHOLDER_PDF3', gambar_url: '', published_at: now(), is_active: true });
  insertRow('materials', { id: 4, topik: 4, judul: 'Pengelolaan SDM', konten: m4, file_ppt_url: 'https://drive.google.com/file/d/PLACEHOLDER_PPT4', file_pdf_url: 'https://drive.google.com/file/d/PLACEHOLDER_PDF4', gambar_url: '', published_at: now(), is_active: true });
  Logger.log('seed materials 4 topik OK');
}

function seedTests() {
  if (getAllRows('tests').length > 0) { Logger.log('tests sudah ada, skip'); return; }
  insertRow('tests', { id: 1, type: 'pretest', total_questions: 20, duration_min: 60, is_open: false, created_at: now() });
  insertRow('tests', { id: 2, type: 'posttest', total_questions: 20, duration_min: 60, is_open: false, created_at: now() });
  insertRow('tests', { id: 3, type: 'angket', total_questions: 16, duration_min: '', is_open: true, created_at: now() });
  Logger.log('seed tests OK');
}

function seedQuestions() {
  if (getAllRows('questions').length > 0) { Logger.log('questions sudah ada, skip'); return; }
  // 20 pretest (id 1) + 20 posttest (id 2), distribusi 5×C1-5×C4
  var levels = ['C1','C1','C1','C1','C1','C2','C2','C2','C2','C2','C3','C3','C3','C3','C3','C4','C4','C4','C4','C4'];
  var topics = ['Perencanaan Instalasi','Pembuatan Panel','Pemeliharaan','Pengelolaan SDM'];
  var idCounter = 1;
  for (var testId = 1; testId <= 2; testId++) {
    var type = testId===1 ? 'pretest' : 'posttest';
    for (var i = 0; i < 20; i++) {
      var level = levels[i];
      var topic = topics[i % 4];
      var qText = 'Contoh soal ['+level+'] nomor '+(i+1)+' tentang '+topic+' — '+type+' (placeholder, ganti dengan soal valid per PDF p35-40)';
      var correct = ['A','B','C','D'][Math.floor(Math.random()*4)];
      insertRow('questions', {
        id: idCounter++,
        test_id: testId,
        question_text: qText,
        option_a: 'Pilihan A untuk '+topic,
        option_b: 'Pilihan B untuk '+topic,
        option_c: 'Pilihan C untuk '+topic,
        option_d: 'Pilihan D untuk '+topic,
        correct_answer: correct,
        cognitive_level: level,
        order_num: i+1
      });
    }
  }
  Logger.log('seed questions 40 OK (20 pre+20 post, 5×C1-C4)');
}

function seedMotivationIndicators() {
  if (getAllRows('motivation_indicators').length > 0) { Logger.log('motivation_indicators sudah ada, skip'); return; }
  // 4 indikator ×4 deskriptor =16 — PDF p41
  // Nama indikator sesuai PLAN: Dorongan Belajar, Ketekunan, Minat, Lingkungan Belajar
  var inds = [
    { name: 'Dorongan Belajar', statements: [
      'Saya bersemangat mengikuti pelajaran DDK karena ingin memahami instalasi listrik',
      'Saya terdorong belajar DDK untuk meningkatkan keterampilan teknik',
      'Saya termotivasi belajar DDK karena cita-cita di bidang ketenagalistrikan',
      'Saya memiliki dorongan kuat untuk mendapat nilai di atas KKTP 75'
    ]},
    { name: 'Ketekunan', statements: [
      'Saya tekun mengerjakan tugas DDK walau sulit',
      'Saya mengulang materi DDK sampai paham',
      'Saya tidak mudah menyerah saat praktikum instalasi',
      'Saya konsisten hadir dan aktif di kelas DDK'
    ]},
    { name: 'Minat', statements: [
      'Saya senang mempelajari rangkaian dan panel listrik',
      'Saya mencari sumber tambahan tentang DDK di weblog',
      'Saya antusias saat guru menjelaskan materi kelistrikan',
      'Saya berminat melanjutkan studi/kerja di bidang listrik'
    ]},
    { name: 'Lingkungan Belajar', statements: [
      'Suasana kelas mendukung saya belajar DDK',
      'Teman dan guru memotivasi saya belajar DDK',
      'Fasilitas weblog membantu saya memahami materi',
      'Dukungan orang tua meningkatkan motivasi belajar DDK'
    ]}
  ];
  var id=1;
  for (var i=0;i<inds.length;i++){
    for (var d=0; d<4; d++){
      insertRow('motivation_indicators', {
        id: id,
        indicator_name: inds[i].name,
        descriptor_num: d+1,
        statement_text: inds[i].statements[d],
        order_num: id
      });
      id++;
    }
  }
  Logger.log('seed motivation_indicators 16 OK');
}

function seedPblPhases() {
  if (getAllRows('pbl_phases').length > 0) { Logger.log('pbl_phases sudah ada, skip'); return; }
  // PDF Tabel2 p22-23 Arends 2008
  var phases = [
    { num:1, title:'Orientasi Siswa kepada Masalah', desc:'Guru menjelaskan tujuan pembelajaran, menjelaskan logistik yang dibutuhkan, memotivasi siswa terlibat pada aktivitas pemecahan masalah. Fitur: studi kasus kelistrikan, pertanyaan pemantik, gambar/video masalah.', file:'https://drive.google.com/file/d/LKPD_FASE1' },
    { num:2, title:'Mengorganisasikan Siswa untuk Belajar', desc:'Guru membantu siswa mendefinisikan dan mengorganisasikan tugas belajar yang berhubungan dengan masalah. Fitur: pembagian kelompok, instruksi tugas, unduh LKPD.', file:'https://drive.google.com/file/d/LKPD_FASE2' },
    { num:3, title:'Membimbing Penyelidikan Individu maupun Kelompok', desc:'Guru mendorong siswa mengumpulkan informasi yang sesuai, melaksanakan eksperimen, untuk mendapatkan penjelasan dan pemecahan masalah. Fitur: sumber bacaan, kolom diskusi kelompok, link materi terkait.', file:'https://drive.google.com/file/d/LKPD_FASE3' },
    { num:4, title:'Menghubungkan dan Menyajikan Hasil Karya', desc:'Guru membantu siswa merencanakan dan menyiapkan karya yang sesuai seperti laporan, model dan membantu mereka berbagi tugas. Fitur: upload laporan, galeri hasil kerja, presentasi kelompok.', file:'https://drive.google.com/file/d/LKPD_FASE4' },
    { num:5, title:'Menganalisis dan Mengevaluasi Proses Pemecahan Masalah', desc:'Guru membantu siswa melakukan refleksi/evaluasi terhadap penyelidikan dan proses-proses yang digunakan. Fitur: refleksi tertulis, kuis formatif, feedback guru.', file:'https://drive.google.com/file/d/LKPD_FASE5' }
  ];
  for (var i=0;i<phases.length;i++){
    insertRow('pbl_phases', { id:i+1, phase_num: phases[i].num, title: phases[i].title, description: phases[i].desc, file_url: phases[i].file });
  }
  Logger.log('seed pbl_phases 5 OK');
}

/**
 * Reset helper — hapus semua data (kecuali header) untuk testing
 */
function resetDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var names = ['users','class_config','materials','tests','questions','test_attempts','test_answers','motivation_indicators','motivation_responses','comments','pbl_phases','task_submissions','activity_logs'];
  for (var i=0;i<names.length;i++){
    var sh = ss.getSheetByName(names[i]);
    if(sh && sh.getLastRow()>1) sh.deleteRows(2, sh.getLastRow()-1);
  }
  Logger.log('resetDatabase selesai — header tetap');
  setupDatabase();
}
