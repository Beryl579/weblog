/**
 * Local Server — Weblog DDK (Node.js)
 * Replikasi GAS + Sheets secara lokal: JSON db.json + HTTP server
 * Jalankan: node server.js  (port 3000)
 * Buka: http://localhost:3000/?page=register atau /?page=login
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');
const { makeProgressApi } = require('./progress_api');

const PORT = 3000;
const ROOT = path.join(__dirname, '..', 'Weblog-DDK');
const DB_PATH = path.join(__dirname, 'db.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- DB Helpers ----------
// db.json tidak ikut di-commit (lihat .gitignore), jadi kalau belum ada
// kita buat kerangka kosong. seedIfEmpty() di bawah akan mengisinya.
if (!fs.existsSync(DB_PATH)) {
  const emptyDb = {};
  ['users','class_config','materials','tests','questions','test_attempts','test_answers',
   'motivation_indicators','motivation_responses','comments','pbl_phases','task_submissions',
   'activity_logs','progress'].forEach(t => { emptyDb[t] = []; });
  fs.writeFileSync(DB_PATH, JSON.stringify(emptyDb, null, 2), 'utf8');
  console.log('db.json belum ada — dibuat kerangka kosong lalu di-seed.');
}

let db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function getAllRows(sheetName) {
  const rows = db[sheetName] || [];
  // add _rowIndex for compatibility (index +2 like GAS)
  return rows.map((r, i) => ({ ...r, _rowIndex: i + 2 }));
}

function findRow(sheetName, column, value) {
  const rows = db[sheetName] || [];
  const target = String(value).trim();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][column]).trim() === target) return { ...rows[i], _rowIndex: i + 2 };
  }
  return null;
}

function findRows(sheetName, column, value) {
  const rows = db[sheetName] || [];
  const target = String(value).trim();
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][column]).trim() === target) out.push({ ...rows[i], _rowIndex: i + 2 });
  }
  return out;
}

function getNextId(sheetName) {
  const rows = db[sheetName] || [];
  let max = 0;
  for (const r of rows) {
    const id = parseInt(r.id, 10);
    if (!isNaN(id) && id > max) max = id;
  }
  return max + 1;
}

function countRows(sheetName, column, value) {
  return findRows(sheetName, column, value).length;
}

function insertRow(sheetName, dataObj) {
  if (!db[sheetName]) db[sheetName] = [];
  if (!dataObj.id) dataObj.id = getNextId(sheetName);
  // ensure _rowIndex not stored
  const clean = { ...dataObj };
  delete clean._rowIndex;
  db[sheetName].push(clean);
  saveDb();
  return { success: true, id: clean.id, rowIndex: db[sheetName].length + 1 };
}

function updateRow(sheetName, rowIndex, dataObj) {
  const idx = rowIndex - 2;
  if (!db[sheetName] || !db[sheetName][idx]) throw new Error(`Row ${rowIndex} not found in ${sheetName}`);
  const current = db[sheetName][idx];
  for (const k in dataObj) {
    if (dataObj.hasOwnProperty(k)) current[k] = dataObj[k];
  }
  saveDb();
  return { success: true, rowIndex };
}

function deleteRow(sheetName, rowIndex) {
  const idx = rowIndex - 2;
  if (!db[sheetName] || !db[sheetName][idx]) throw new Error(`Row ${rowIndex} not found`);
  db[sheetName].splice(idx, 1);
  saveDb();
  return { success: true };
}

function findRowIndexById(sheetName, id) {
  const r = findRow(sheetName, 'id', id);
  return r ? r._rowIndex : null;
}

// ---------- Utils ----------
const PASSWORD_SALT = 'DDK2025_UNIMED_SALT';
const SESSION_EXPIRY_MS = 7200 * 1000;

function hashPassword(password) {
  if (!password) throw new Error('Password kosong');
  const salted = password + PASSWORD_SALT;
  return crypto.createHash('sha256').update(salted).digest('hex');
}

function nowISO() { return new Date().toISOString(); }
function now() { return new Date().toISOString(); }

function anonId(index) {
  const n = parseInt(index, 10) + 1;
  if (n < 10) return 'S00' + n;
  if (n < 100) return 'S0' + n;
  return 'S' + n;
}

function calcNilai(score, total) {
  if (!total) return 0;
  return (Number(score) / Number(total)) * 100;
}

function nGain(postValue, preValue) {
  const pre = Number(preValue), post = Number(postValue);
  if (100 - pre === 0) return 0;
  return (post - pre) / (100 - pre);
}

function isValidNIS(nis) {
  return /^[0-9]{4,20}$/.test(String(nis).trim());
}

function handleError(e) {
  return { success:false, message:e.message || String(e) };
}

// ---------- Session ----------
const sessions = {}; // nis -> {user, expiresAt}

function getCurrentUserByNis(nis) {
  if (!nis) return null;
  const s = sessions[nis];
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    delete sessions[nis];
    return null;
  }
  return s.user;
}

function isSessionValid(nis) {
  return !!getCurrentUserByNis(nis);
}

// ---------- Progress API (kuis gating + rekap guru) ----------
const dbHandle = {
  db,
  saveDb,
  getAllRows, findRow, findRows, insertRow, updateRow, deleteRow, getNextId, countRows,
  hashPassword, now: () => now()
};
const progressApi = makeProgressApi(dbHandle);

// ---------- Seed (mirip Setup.gs) ----------
function seedIfEmpty() {
  let seeded = false;

  if ((db.class_config || []).length === 0) {
    insertRow('class_config', { id: 1, kelas: 'X TITL 1', access_code: 'DDK2025-EKS', is_eksperimen: true, max_students: 30 });
    seeded = true;
    console.log('Seed class_config');
  }

  if (countRows('users', 'role', 'guru') === 0) {
    insertRow('users', {
      id: 1, nis: 'GURU001', nama: 'Guru Pamong', kelas: 'X TITL 1', role: 'guru', is_eksperimen: true,
      password_hash: hashPassword('guru123'), registered_at: now(), is_active: true
    });
    insertRow('users', {
      id: 2, nis: 'ADMIN001', nama: 'Admin', kelas: 'X TITL 1', role: 'admin', is_eksperimen: true,
      password_hash: hashPassword('admin123'), registered_at: now(), is_active: true
    });
    console.log('Seed users guru/admin (guru123/admin123)');
    seeded = true;
  }

  if ((db.materials || []).length === 0) {
    const m1 = `<h3>Tujuan Pembelajaran</h3><p>Memahami proses perencanaan instalasi listrik gedung meliputi penawaran hingga serah terima (PDF p24).</p><h3>a. Penawaran Pekerjaan</h3><p>Jasa ME ditawarkan pekerjaan instalasi listrik dari pemilik gedung/kontraktor utama sebagai sub-kontraktor.</p><h3>b. Survei & Penjelasan Pekerjaan</h3><p>Menghubungi pemilik, survey untuk data terperinci kebutuhan instalasi.</p><h3>c. Perencanaan</h3><p>Rancangan gambar (lampu, stop kontak, genset, panel) + RAB: nilai material, jasa teknisi, sewa alat.</p><h3>d. Presentasi</h3><p>Di depan pemilik pekerjaan, bahas kesesuaian sampai kesepakatan.</p><h3>e. Pelaksanaan (SPK + Pengawas)</h3><ul><li>Persiapan: alat, bahan, tenaga</li><li>Pelaksanaan: kerjakan sampai selesai</li><li>Tes/Commissioning: parsial & holistik</li></ul><h3>f. Serah Terima</h3><p>Setelah selesai, serah terima pemilik–pelaksana.</p>`;
    const m2 = `<h3>Tujuan</h3><p>Memahami pembuatan panel kendali pensaklaran beban PLN–genset (PDF p26).</p><p>Survey fokus peralatan dikendalikan (genset). Perhitungan peralatan, kabel, proteksi sesuai batas ukur. Konsultasi cara kerja panel dengan pemilik: contoh genset otomatis suplai seluruh gedung setelah pemadaman.</p>`;
    const m3 = `<h3>Tujuan</h3><p>Memahami pemeliharaan, perbaikan, perawatan peralatan ketenagalistrikan (PDF p27).</p><h3>SOP & Jadwal</h3><p>AC 3 bulan sekali, lampu, lift, pompa air, panel. Cek harian deteksi kerusakan.</p><h3>Penanganan</h3><p>Internal jika bisa, order pihak ketiga jika tidak. Tim siap sedia.</p>`;
    const m4 = `<h3>Tujuan</h3><p>Memahami pengelolaan SDM lulusan TITL (PDF p27-28).</p><p>Alur: perencanaan → gambar instalasi → survey → RAB → pemasangan → testing → commissioning → pemeliharaan → perawatan → perbaikan</p>`;
    insertRow('materials', { id: 1, topik: 1, judul: 'Proses Perencanaan Instalasi', konten: m1, file_ppt_url: 'https://drive.google.com/file/d/PLACEHOLDER_PPT1', file_pdf_url: 'https://drive.google.com/file/d/PLACEHOLDER_PDF1', gambar_url: '', published_at: now(), is_active: true });
    insertRow('materials', { id: 2, topik: 2, judul: 'Pembuatan Panel', konten: m2, file_ppt_url: 'https://drive.google.com/file/d/PLACEHOLDER_PPT2', file_pdf_url: 'https://drive.google.com/file/d/PLACEHOLDER_PDF2', gambar_url: '', published_at: now(), is_active: true });
    insertRow('materials', { id: 3, topik: 3, judul: 'Pemeliharaan, Perbaikan, dan Perawatan Peralatan Ketenagalistrikan', konten: m3, file_ppt_url: 'https://drive.google.com/file/d/PLACEHOLDER_PPT3', file_pdf_url: 'https://drive.google.com/file/d/PLACEHOLDER_PDF3', gambar_url: '', published_at: now(), is_active: true });
    insertRow('materials', { id: 4, topik: 4, judul: 'Pengelolaan SDM', konten: m4, file_ppt_url: 'https://drive.google.com/file/d/PLACEHOLDER_PPT4', file_pdf_url: 'https://drive.google.com/file/d/PLACEHOLDER_PDF4', gambar_url: '', published_at: now(), is_active: true });
    seeded = true;
    console.log('Seed materials 4');
  }

  if ((db.tests || []).length === 0) {
    insertRow('tests', { id: 1, type: 'pretest', total_questions: 20, duration_min: 60, is_open: false, created_at: now() });
    insertRow('tests', { id: 2, type: 'posttest', total_questions: 20, duration_min: 60, is_open: false, created_at: now() });
    insertRow('tests', { id: 3, type: 'angket', total_questions: 16, duration_min: '', is_open: true, created_at: now() });
    seeded = true;
    console.log('Seed tests');
  }

  if ((db.questions || []).length === 0) {
    const levels = ['C1','C1','C1','C1','C1','C2','C2','C2','C2','C2','C3','C3','C3','C3','C3','C4','C4','C4','C4','C4'];
    const topics = ['Perencanaan Instalasi','Pembuatan Panel','Pemeliharaan','Pengelolaan SDM'];
    let idCounter = 1;
    for (let testId = 1; testId <= 2; testId++) {
      const type = testId===1?'pretest':'posttest';
      for (let i=0;i<20;i++) {
        const level=levels[i];
        const topic=topics[i%4];
        insertRow('questions', {
          id: idCounter++,
          test_id: testId,
          question_text: `Contoh soal [${level}] nomor ${i+1} tentang ${topic} — ${type} (placeholder, ganti dengan soal valid PDF p35-40)`,
          option_a: `Pilihan A untuk ${topic}`,
          option_b: `Pilihan B untuk ${topic}`,
          option_c: `Pilihan C untuk ${topic}`,
          option_d: `Pilihan D untuk ${topic}`,
          correct_answer: ['A','B','C','D'][Math.floor(Math.random()*4)],
          cognitive_level: level,
          order_num: i+1
        });
      }
    }
    seeded = true;
    console.log('Seed questions 40');
  }

  if ((db.motivation_indicators || []).length === 0) {
    const inds = [
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
    let id=1;
    for (const ind of inds) {
      for (let d=0; d<4; d++) {
        insertRow('motivation_indicators', { id: id, indicator_name: ind.name, descriptor_num: d+1, statement_text: ind.statements[d], order_num: id });
        id++;
      }
    }
    seeded = true;
    console.log('Seed motivation_indicators 16');
  }

  if ((db.pbl_phases || []).length === 0) {
    const phases = [
      { num:1, title:'Orientasi Siswa kepada Masalah', desc:'Guru menjelaskan tujuan pembelajaran, logistik, motivasi terlibat pemecahan masalah. Fitur: studi kasus kelistrikan, pertanyaan pemantik, gambar/video masalah.', file:'https://drive.google.com/file/d/LKPD_FASE1' },
      { num:2, title:'Mengorganisasikan Siswa untuk Belajar', desc:'Guru membantu mendefinisikan & mengorganisasikan tugas belajar. Fitur: pembagian kelompok, instruksi tugas, unduh LKPD.', file:'https://drive.google.com/file/d/LKPD_FASE2' },
      { num:3, title:'Membimbing Penyelidikan Individu maupun Kelompok', desc:'Guru mendorong kumpul informasi, eksperimen, pemecahan masalah. Fitur: sumber bacaan, diskusi kelompok, link materi.', file:'https://drive.google.com/file/d/LKPD_FASE3' },
      { num:4, title:'Menghubungkan dan Menyajikan Hasil Karya', desc:'Guru bantu rencanakan & siapkan karya (laporan, model) & berbagi tugas. Fitur: upload laporan, galeri, presentasi.', file:'https://drive.google.com/file/d/LKPD_FASE4' },
      { num:5, title:'Menganalisis dan Mengevaluasi Proses Pemecahan Masalah', desc:'Guru bantu refleksi/evaluasi terhadap penyelidikan & proses. Fitur: refleksi tertulis, kuis formatif, feedback guru.', file:'https://drive.google.com/file/d/LKPD_FASE5' }
    ];
    for (let i=0;i<phases.length;i++) {
      insertRow('pbl_phases', { id:i+1, phase_num: phases[i].num, title: phases[i].title, description: phases[i].desc, file_url: phases[i].file });
    }
    seeded = true;
    console.log('Seed pbl_phases 5');
  }

  if (seeded) saveDb();
  progressApi.seedProgressData();
}

seedIfEmpty();

// ---------- Service Logic (adaptasi .gs) ----------
function registerService({ nis, nama, kelas, password, confirmPassword }) {
  // Delegasi ke progress_api (registrasi terbuka tanpa kode akses)
  return progressApi.registerService({ nis, nama, kelas, password, confirmPassword });
}

function loginService({ nis, password }) {
  try {
    nis=String(nis||'').trim(); password=String(password||'');
    if(!nis||!password) return {success:false,message:'NIS dan Password wajib diisi'};
    const user=findRow('users','nis',nis);
    if(!user) return {success:false,message:'NIS tidak terdaftar. Silakan daftar terlebih dahulu.'};
    const isActive = String(user.is_active).toLowerCase();
    if(isActive==='false' || user.is_active===false) return {success:false,message:'Akun non-aktif. Hubungi guru.'};
    const inputHash=hashPassword(password);
    if(inputHash!==String(user.password_hash).trim()) return {success:false,message:'Password salah'};
    const sessionData={ id:user.id, nis:user.nis, nama:user.nama, kelas:user.kelas, role:user.role, is_eksperimen:user.is_eksperimen, login_at:new Date().toISOString() };
    sessions[nis]={ user:sessionData, expiresAt:Date.now()+SESSION_EXPIRY_MS };
    insertRow('activity_logs',{ id:getNextId('activity_logs'), user_id:user.id, action:'login', target_id:user.id, timestamp:now() });
    const redirect = (user.role==='guru'||user.role==='admin')?'/guru':'/dashboard';
    return { success:true, message:'Login berhasil', user:sessionData, redirect };
  } catch(e){ return handleError(e); }
}

function logoutService({ nis }) {
  if(nis) delete sessions[String(nis).trim()];
  return { success:true, message:'Logout berhasil' };
}

function getCurrentUserService({ nis }) {
  const u=getCurrentUserByNis(nis);
  return u || null;
}

// Material
function getMaterialsService() {
  try{
    const rows=getAllRows('materials');
    const active=rows.filter(r=> String(r.is_active).toLowerCase()==='true' || r.is_active===true);
    active.sort((a,b)=>Number(a.topik)-Number(b.topik));
    return {success:true, data:active};
  }catch(e){ return handleError(e); }
}
function getMaterialByIdService({ id }){
  try{
    const row=findRow('materials','id',id);
    if(!row) return {success:false,message:'Materi tidak ditemukan'};
    return {success:true,data:row};
  }catch(e){return handleError(e);}
}

// PBL
function getPblPhasesService(){
  try{
    const rows=getAllRows('pbl_phases');
    rows.sort((a,b)=>Number(a.phase_num)-Number(b.phase_num));
    return {success:true,data:rows};
  }catch(e){return handleError(e);}
}
function getPblPhaseByIdService({ id }){
  try{
    const row=findRow('pbl_phases','id',id);
    if(!row) return {success:false,message:'Fase tidak ditemukan'};
    return {success:true,data:row};
  }catch(e){return handleError(e);}
}

// Quiz
function getQuestionsService({ testType }){
  try{
    testType=String(testType||'').toLowerCase().trim();
    if(['pretest','posttest'].indexOf(testType)===-1) throw new Error('testType harus pretest/posttest');
    const testRow=findRow('tests','type',testType);
    if(!testRow) throw new Error('Test '+testType+' belum dibuat');
    const testId=testRow.id;
    const questions=findRows('questions','test_id',testId).sort((a,b)=>Number(a.order_num)-Number(b.order_num));
    const safe=questions.map(q=>({
      id:q.id, test_id:q.test_id, question_text:q.question_text,
      option_a:q.option_a, option_b:q.option_b, option_c:q.option_c, option_d:q.option_d,
      cognitive_level:q.cognitive_level, order_num:q.order_num
    }));
    return {success:true, test:{id:testId,type:testType,total_questions:safe.length,is_open:testRow.is_open}, questions:safe};
  }catch(e){return handleError(e);}
}
function hasCompletedTest(userId,testType){
  const testRow=findRow('tests','type',String(testType).toLowerCase());
  if(!testRow) return false;
  const attempts=findRows('test_attempts','user_id',userId);
  return attempts.some(a=> String(a.test_id).trim()===String(testRow.id).trim());
}
function isTestOpenService({ testType }){
  const row=findRow('tests','type',String(testType).toLowerCase());
  if(!row) return false;
  return String(row.is_open).toLowerCase()==='true' || row.is_open===true;
}
function getTestResultService({ userId, testType }){
  try{
    const testRow=findRow('tests','type',String(testType).toLowerCase());
    if(!testRow) return {success:false,message:'Test tidak ditemukan'};
    const testId=testRow.id;
    const attempts=findRows('test_attempts','user_id',userId);
    const attempt=attempts.find(a=> String(a.test_id).trim()===String(testId).trim());
    if(!attempt) return {success:false,message:'Belum mengerjakan '+testType,completed:false};
    const answers=findRows('test_answers','attempt_id',attempt.id);
    return {success:true,completed:true,attempt:{id:attempt.id,raw_score:attempt.raw_score,final_value:attempt.final_value,submitted_at:attempt.submitted_at},answers};
  }catch(e){return handleError(e);}
}
function submitTestService({ userId, testType, answers }){
  try{
    testType=String(testType||'').toLowerCase().trim();
    if(!['pretest','posttest'].includes(testType)) return {success:false,message:'Jenis test tidak valid'};
    if(!userId) return {success:false,message:'userId wajib'};
    if(!answers||!Array.isArray(answers)||answers.length===0) return {success:false,message:'Jawaban kosong'};
    const user=findRow('users','id',userId);
    if(!user) return {success:false,message:'User tidak ditemukan'};
    const testRow=findRow('tests','type',testType);
    if(!testRow) return {success:false,message:'Test tidak ditemukan'};
    const testId=testRow.id;
    const isOpen=String(testRow.is_open).toLowerCase()==='true'||testRow.is_open===true;
    if(!isOpen) return {success:false,message:testType+' sedang tertutup. Hubungi guru.'};
    if(testType==='posttest' && !hasCompletedTest(userId,'pretest')) return {success:false,message:'Posttest hanya bisa setelah pretest selesai'};
    if(hasCompletedTest(userId,testType)) return {success:false,message:'Anda sudah submit '+testType+' sebelumnya.'};
    const allQs=findRows('questions','test_id',testId);
    if(answers.length < allQs.length) return {success:false,message:`Jawaban belum lengkap (${answers.length}/${allQs.length})`};
    const keyMap={};
    for(const q of allQs) keyMap[String(q.id).trim()]=String(q.correct_answer).trim().toUpperCase();
    let raw=0;
    const scored=[];
    for(const ans of answers){
      const qid=String(ans.question_id).trim();
      const sel=String(ans.selected_answer||'').trim().toUpperCase();
      if(!['A','B','C','D'].includes(sel)) return {success:false,message:'Jawaban tidak valid untuk soal '+qid};
      const correct=keyMap[qid];
      if(!correct) return {success:false,message:'Soal ID '+qid+' tidak ditemukan'};
      const ok=sel===correct;
      scored.push({question_id:qid,selected_answer:sel,is_correct:ok,score:ok?1:0});
      if(ok) raw++;
    }
    const total=allQs.length;
    const finalValue=calcNilai(raw,total);
    const attemptId=getNextId('test_attempts');
    insertRow('test_attempts',{ id:attemptId,user_id:userId,test_id:testId,raw_score:raw,final_value:Number(finalValue.toFixed(2)),started_at:now(),submitted_at:now() });
    for(const sa of scored){
      insertRow('test_answers',{ id:getNextId('test_answers'),attempt_id:attemptId,question_id:sa.question_id,selected_answer:sa.selected_answer,is_correct:sa.is_correct,score:sa.score });
    }
    insertRow('activity_logs',{ id:getNextId('activity_logs'),user_id:userId,action:'submit_kuis',target_id:attemptId,timestamp:now() });
    return {success:true,message:'Submit '+testType+' berhasil',result:{raw_score:raw,final_value:Number(finalValue.toFixed(2)),total_questions:total}};
  }catch(e){return handleError(e);}
}

// Motivation
function getMotivationQuestionsService(){
  try{
    const rows=getAllRows('motivation_indicators').sort((a,b)=>Number(a.order_num)-Number(b.order_num));
    const grouped={};
    const flat=[];
    for(const r of rows){
      const ind=r.indicator_name||'Indikator';
      if(!grouped[ind]) grouped[ind]=[];
      const item={id:r.id,indicator_name:ind,descriptor_num:r.descriptor_num,statement_text:r.statement_text,order_num:r.order_num};
      grouped[ind].push(item); flat.push(item);
    }
    return {success:true,total:flat.length,grouped,flat};
  }catch(e){return handleError(e);}
}
function hasSubmittedMotivation(userId){
  return findRows('motivation_responses','user_id',userId).length>0;
}
function submitMotivationService({ userId, responses }){
  try{
    if(!userId) return {success:false,message:'userId wajib'};
    const user=findRow('users','id',userId);
    if(!user) return {success:false,message:'User tidak ditemukan'};
    if(!hasCompletedTest(userId,'posttest')) return {success:false,message:'Angket hanya bisa setelah posttest'};
    if(hasSubmittedMotivation(userId)) return {success:false,message:'Anda sudah mengisi angket sebelumnya (1×).'};
    let arr=[];
    if(Array.isArray(responses)) arr=responses;
    else if(typeof responses==='object') for(const k in responses) arr.push({indicator_id:k,response_value:responses[k]});
    else return {success:false,message:'Format responses tidak valid'};
    const expected=getAllRows('motivation_indicators');
    if(arr.length!==expected.length) return {success:false,message:`Angket harus ${expected.length} item, terisi ${arr.length}`};
    const validIds={};
    for(const e of expected) validIds[String(e.id).trim()]=true;
    for(const r of arr){
      const indId=String(r.indicator_id).trim();
      const val=parseInt(r.response_value,10);
      if(!validIds[indId]) return {success:false,message:'indicator_id '+indId+' tidak valid'};
      if(isNaN(val)||val<1||val>4) return {success:false,message:'Nilai harus 1-4'};
    }
    for(const item of arr){
      insertRow('motivation_responses',{ id:getNextId('motivation_responses'),user_id:userId,indicator_id:String(item.indicator_id).trim(),response_value:parseInt(item.response_value,10),submitted_at:now() });
    }
    insertRow('activity_logs',{ id:getNextId('activity_logs'),user_id:userId,action:'submit_angket',target_id:userId,timestamp:now() });
    const result=getMotivationResultService({ userId });
    return {success:true,message:'Angket berhasil disimpan',result: result.data||result};
  }catch(e){return handleError(e);}
}
function getMotivationResultService({ userId }){
  try{
    if(!userId) return {success:false,message:'userId wajib'};
    const responses=findRows('motivation_responses','user_id',userId);
    if(responses.length===0) return {success:false,message:'Belum mengisi angket',completed:false};
    const indicators=getAllRows('motivation_indicators');
    const indMap={};
    for(const i of indicators) indMap[String(i.id).trim()]=i;
    const perIndicator={};
    let total=0;
    for(const resp of responses){
      const indId=String(resp.indicator_id).trim();
      const val=parseInt(resp.response_value,10);
      total+=val;
      const meta=indMap[indId];
      const name=meta?String(meta.indicator_name).trim():'Indikator '+indId;
      if(!perIndicator[name]) perIndicator[name]={score:0,count:0,items:[]};
      perIndicator[name].score+=val; perIndicator[name].count++;
    }
    const maxScore=64;
    const nilai=calcNilai(total,maxScore);
    let kategori='Belum diketahui';
    if(total<=28) kategori='Rendah (a)';
    else if(total<=40) kategori='Cukup (b)';
    else if(total<=52) kategori='Baik (c)';
    else kategori='Sangat Baik (d)';
    const perIndArray=[];
    for(const k in perIndicator){
      const s=perIndicator[k].score;
      const kat=s<=7?'Rendah':s<=10?'Cukup':s<=13?'Baik':'Sangat Baik';
      perIndArray.push({indicator_name:k,score:s,max:16,nilai:calcNilai(s,16),kategori:kat,count:perIndicator[k].count});
    }
    return {success:true,completed:true,data:{total_score:total,max_score:maxScore,nilai:Number(nilai.toFixed(2)),kategori,per_indikator:perIndArray,responses_count:responses.length}};
  }catch(e){return handleError(e);}
}

// Comments
function buildCommentTree(flat){
  const map={};
  const roots=[];
  for(const c of flat){ c.replies=[]; map[String(c.id).trim()]=c; }
  for(const c of flat){
    const parent=c.parent_id;
    if(parent && String(parent).trim()!=='' && map[String(parent).trim()]){
      map[String(parent).trim()].replies.push(c);
    } else roots.push(c);
  }
  return roots;
}
function getCommentsService({ materialId }){
  try{
    const rows=findRows('comments','material_id',materialId);
    const approved=rows.filter(r=> String(r.is_approved).toLowerCase()==='true' || r.is_approved===true);
    approved.sort((a,b)=> new Date(a.created_at)-new Date(b.created_at));
    return {success:true,data:buildCommentTree(approved)};
  }catch(e){return handleError(e);}
}
function addCommentService({ userId, materialId, content, parentId }){
  try{
    if(!userId||!materialId||!content) return {success:false,message:'userId, materialId, content wajib'};
    const user=findRow('users','id',userId);
    if(!user) return {success:false,message:'User tidak ditemukan'};
    const mat=findRow('materials','id',materialId);
    if(!mat) return {success:false,message:'Materi tidak ditemukan'};
    content=String(content).trim().replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if(content.length<3) return {success:false,message:'Komentar minimal 3 karakter'};
    if(parentId){
      const parent=findRow('comments','id',parentId);
      if(!parent) return {success:false,message:'Parent tidak ditemukan'};
      if(String(parent.material_id).trim()!==String(materialId).trim()) return {success:false,message:'Parent tidak sesuai materi'};
    }
    const newId=getNextId('comments');
    const isApproved=(user.role==='guru'||user.role==='admin');
    insertRow('comments',{ id:newId,user_id:userId,material_id:materialId,content,parent_id:parentId||'',is_approved:isApproved,created_at:now() });
    insertRow('activity_logs',{ id:getNextId('activity_logs'),user_id:userId,action:'comment',target_id:materialId,timestamp:now() });
    return {success:true,message:isApproved?'Komentar diposting':'Komentar menunggu moderasi guru',id:newId,is_approved:isApproved};
  }catch(e){return handleError(e);}
}

// Guru
function getRecapService(){
  try{
    const users=getAllRows('users').filter(r=> String(r.role).toLowerCase()==='siswa');
    users.sort((a,b)=> String(a.kelas).localeCompare(String(b.kelas)) || String(a.nama).localeCompare(String(b.nama)));
    const recap=[];
    for(let s=0;s<users.length;s++){
      const stu=users[s];
      const uid=stu.id;
      const pre=getTestResultService({userId:uid,testType:'pretest'});
      const post=getTestResultService({userId:uid,testType:'posttest'});
      const mot=getMotivationResultService({userId:uid});
      const preScore=pre.success?pre.attempt.raw_score:'-';
      const preVal=pre.success?pre.attempt.final_value:'-';
      const postScore=post.success?post.attempt.raw_score:'-';
      const postVal=post.success?post.attempt.final_value:'-';
      const motScore=mot.success?mot.data.total_score:'-';
      const motNilai=mot.success?mot.data.nilai:'-';
      let ng='-';
      if(pre.success&&post.success) ng=Number(nGain(postVal,preVal).toFixed(2));
      recap.push({ id:uid,nis:stu.nis,anon_id:anonId(s),nama:stu.nama,kelas:stu.kelas,is_eksperimen:stu.is_eksperimen,
        pretest_status:pre.success?'Selesai':'Belum',pretest_score:preScore,pretest_value:preVal,
        posttest_status:post.success?'Selesai':'Belum',posttest_score:postScore,posttest_value:postVal,n_gain:ng,
        angket_status:mot.success?'Selesai':'Belum',motivasi_total:motScore,motivasi_nilai:motNilai,motivasi_kategori:mot.success?mot.data.kategori:'-' });
    }
    let total=recap.length, preDone=recap.filter(r=>r.pretest_status==='Selesai').length, postDone=recap.filter(r=>r.posttest_status==='Selesai').length, angDone=recap.filter(r=>r.angket_status==='Selesai').length;
    let avgPre=0,avgPost=0,avgMot=0,cntPre=0,cntPost=0,cntMot=0;
    for(const r of recap){
      if(r.pretest_value!=='-'){avgPre+=Number(r.pretest_value);cntPre++}
      if(r.posttest_value!=='-'){avgPost+=Number(r.posttest_value);cntPost++}
      if(r.motivasi_nilai!=='-'){avgMot+=Number(r.motivasi_nilai);cntMot++}
    }
    if(cntPre) avgPre/=cntPre; if(cntPost) avgPost/=cntPost; if(cntMot) avgMot/=cntMot;
    return {success:true,summary:{total_siswa:total,pretest_selesai:preDone,pretest_pct:total?(preDone/total*100).toFixed(1):0,posttest_selesai:postDone,posttest_pct:total?(postDone/total*100).toFixed(1):0,angket_selesai:angDone,angket_pct:total?(angDone/total*100).toFixed(1):0,rata_pretest:Number(avgPre.toFixed(2)),rata_posttest:Number(avgPost.toFixed(2)),rata_motivasi:Number(avgMot.toFixed(2))},data:recap};
  }catch(e){return handleError(e);}
}
function toggleTestService({ testType, isOpen }){
  try{
    testType=String(testType).toLowerCase();
    if(!['pretest','posttest','angket'].includes(testType)) return {success:false,message:'testType harus pretest/posttest/angket'};
    const typeForSheet=testType;
    let row=findRow('tests','type',typeForSheet);
    if(!row){
      const nid=getNextId('tests');
      insertRow('tests',{ id:nid,type:typeForSheet,total_questions:typeForSheet==='angket'?16:20,duration_min:'',is_open:isOpen,created_at:now() });
      return {success:true,message:typeForSheet+' dibuat & '+(isOpen?'dibuka':'ditutup')};
    }
    updateRow('tests',row._rowIndex,{ is_open:isOpen });
    return {success:true,message:testType+' '+(isOpen?'dibuka':'ditutup')};
  }catch(e){return handleError(e);}
}
function manageAccessCodeService({ action, kelas, code }){
  try{
    action=String(action||'list').toLowerCase();
    if(action==='create'||action==='add'){
      if(!kelas||!code) return {success:false,message:'kelas & code wajib'};
      if(findRow('class_config','access_code',code)) return {success:false,message:'Kode sudah ada'};
      if(findRow('class_config','kelas',kelas)) return {success:false,message:'Kelas sudah ada, gunakan update'};
      insertRow('class_config',{ id:getNextId('class_config'),kelas,access_code:code,is_eksperimen:true,max_students:30 });
      return {success:true,message:'Kode akses dibuat'};
    } else if(action==='update'){
      const r=findRow('class_config','kelas',kelas);
      if(!r) return {success:false,message:'Kelas tidak ditemukan'};
      updateRow('class_config',r._rowIndex,{ access_code:code });
      return {success:true,message:'Kode updated'};
    } else if(action==='delete'){
      const del=findRow('class_config','kelas',kelas);
      if(!del) return {success:false,message:'Kelas tidak ditemukan'};
      deleteRow('class_config',del._rowIndex);
      return {success:true,message:'Kelas dihapus'};
    } else {
      return {success:true,data:getAllRows('class_config')};
    }
  }catch(e){return handleError(e);}
}
function exportHasilBelajarService(){
  try{
    const recap=getRecapService();
    if(!recap.success) return recap;
    const header='id_siswa,kelas,pretest_score,pretest_value,posttest_score,posttest_value,n_gain';
    const lines=[header];
    for(const r of recap.data){
      lines.push([r.anon_id,r.kelas,r.pretest_score==='-'?'':r.pretest_score,r.pretest_value==='-'?'':r.pretest_value,r.posttest_score==='-'?'':r.posttest_score,r.posttest_value==='-'?'':r.posttest_value,r.n_gain==='-'?'':r.n_gain].join(','));
    }
    return {success:true,csv:lines.join('\n'),filename:'hasil_belajar.csv',rows:recap.data.length};
  }catch(e){return handleError(e);}
}
function exportButirSoalService(){
  try{
    const users=getAllRows('users').filter(r=> String(r.role).toLowerCase()==='siswa').sort((a,b)=>Number(a.id)-Number(b.id));
    const header='id_siswa,jenis_test,no_soal,kunci,jawaban_siswa,skor,level_kognitif';
    const lines=[header];
    for(let u=0;u<users.length;u++){
      const user=users[u];
      const anon=anonId(u);
      for(const testType of ['pretest','posttest']){
        const testRow=findRow('tests','type',testType);
        if(!testRow) continue;
        const attempts=findRows('test_attempts','user_id',user.id);
        const attempt=attempts.find(a=> String(a.test_id).trim()===String(testRow.id).trim());
        if(!attempt) continue;
        const answers=findRows('test_answers','attempt_id',attempt.id);
        for(const ans of answers){
          const qRow=findRow('questions','id',ans.question_id);
          if(!qRow) continue;
          lines.push([anon,testType,qRow.order_num,qRow.correct_answer,ans.selected_answer,ans.score,qRow.cognitive_level].join(','));
        }
      }
    }
    return {success:true,csv:lines.join('\n'),filename:'butir_soal.csv',rows:lines.length-1};
  }catch(e){return handleError(e);}
}
function exportMotivasiService(){
  try{
    const indicators=getAllRows('motivation_indicators').sort((a,b)=>Number(a.order_num)-Number(b.order_num));
    const indNames=[];
    const seen={};
    for(const ind of indicators){
      const n=String(ind.indicator_name).trim();
      if(!seen[n]){seen[n]=true; indNames.push(n);}
      if(indNames.length===4) break;
    }
    const nameToIdx={};
    indNames.forEach((n,i)=> nameToIdx[n]=i+1);
    const users=getAllRows('users').filter(r=> String(r.role).toLowerCase()==='siswa').sort((a,b)=>Number(a.id)-Number(b.id));
    const header='id_siswa,kelas,skor_ind1,skor_ind2,skor_ind3,skor_ind4,total_motivasi';
    const lines=[header];
    for(let u=0;u<users.length;u++){
      const user=users[u];
      const anon=anonId(u);
      const resps=findRows('motivation_responses','user_id',user.id);
      if(resps.length===0) continue;
      const skor=[0,0,0,0];
      let total=0;
      for(const resp of resps){
        const qRow=findRow('motivation_indicators','id',resp.indicator_id);
        if(!qRow) continue;
        const name=String(qRow.indicator_name).trim();
        const idx=nameToIdx[name];
        if(idx) skor[idx-1]+=parseInt(resp.response_value,10);
        total+=parseInt(resp.response_value,10);
      }
      lines.push([anon,user.kelas,skor[0],skor[1],skor[2],skor[3],total].join(','));
    }
    return {success:true,csv:lines.join('\n'),filename:'motivasi.csv',rows:lines.length-1};
  }catch(e){return handleError(e);}
}

// Material mark & task
function markCompleteService({ userId, materialId }){
  try{
    if(!userId||!materialId) return {success:false,message:'userId & materialId wajib'};
    insertRow('activity_logs',{ id:getNextId('activity_logs'),user_id:userId,action:'view_materi',target_id:materialId,timestamp:now() });
    return {success:true,message:'Progress dicatat'};
  }catch(e){return handleError(e);}
}
function submitTaskService({ userId, pblPhaseId, fileBlob }){
  try{
    if(!userId||!pblPhaseId) return {success:false,message:'userId & pblPhaseId wajib'};
    const phase=findRow('pbl_phases','id',pblPhaseId);
    if(!phase) return {success:false,message:'Fase tidak ditemukan'};
    if(!fileBlob||!fileBlob.bytes) return {success:false,message:'File wajib'};
    const bytes=Buffer.from(fileBlob.bytes,'base64');
    if(bytes.length>5*1024*1024) return {success:false,message:'File max 5MB'};
    const filename=fileBlob.filename||'tugas';
    const ext=filename.split('.').pop().toLowerCase();
    if(!['pdf','doc','docx','jpg','jpeg','png'].includes(ext)) return {success:false,message:'Format harus PDF/DOC/JPG/PNG'};
    const safeName=Date.now()+'_'+filename.replace(/[^a-zA-Z0-9._-]/g,'_');
    const filePath=path.join(UPLOAD_DIR,safeName);
    fs.writeFileSync(filePath,bytes);
    const fileUrl='/uploads/'+safeName;
    const newId=getNextId('task_submissions');
    insertRow('task_submissions',{ id:newId,user_id:userId,pbl_phase_id:pblPhaseId,file_url:fileUrl,score:'',feedback:'',submitted_at:now() });
    insertRow('activity_logs',{ id:getNextId('activity_logs'),user_id:userId,action:'submit_tugas',target_id:pblPhaseId,timestamp:now() });
    return {success:true,message:'Tugas berhasil diupload',file_url:fileUrl,id:newId};
  }catch(e){return handleError(e);}
}

// ---------- HTTP Server ----------
function parseBody(req){
  return new Promise((resolve)=>{
    let body='';
    req.on('data',chunk=> body+=chunk);
    req.on('end',()=>{
      try{ resolve(body?JSON.parse(body):{}); }catch{ resolve({}); }
    });
  });
}

function serveStatic(req,res){
  const parsed=url.parse(req.url,true);
  let pathname=parsed.pathname;
  // /uploads
  if(pathname.startsWith('/uploads/')){
    const filePath=path.join(__dirname, pathname);
    if(fs.existsSync(filePath)){
      const ext=path.extname(filePath).toLowerCase();
      const mime={'.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}[ext]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':mime});
      fs.createReadStream(filePath).pipe(res);
      return true;
    }
  }
  // /Styles/Main.css
  if(pathname==='/Styles/Main.css' || pathname==='/Styles/Main'){
    const fp=path.join(ROOT,'Styles','Main.css');
    if(fs.existsSync(fp)){
      res.writeHead(200,{'Content-Type':'text/css'});
      res.end(fs.readFileSync(fp,'utf8'));
      return true;
    }
  }
  return false;
}

function renderGASTemplate(filePath, query){
  let content=fs.readFileSync(filePath,'utf8');
  const nis=query.nis||'';
  const currentUser=getCurrentUserByNis(nis);

  // 1) include
  content=content.replace(/<\?!= *include\(['"]([^'"]+)['"]\) *\?>/g, (m, inc)=>{
    let incPath=inc;
    // Handle Styles/Main -> Styles/Main.css
    let full=path.join(ROOT, incPath);
    if(!incPath.includes('.')){ // no extension
      if(fs.existsSync(full+'.html')) full=full+'.html';
      else if(fs.existsSync(full+'.css')) full=full+'.css';
      else if(fs.existsSync(path.join(ROOT,'Styles',incPath.split('/').pop()+'.css'))) full=path.join(ROOT,'Styles',incPath.split('/').pop()+'.css');
      else if(fs.existsSync(path.join(ROOT,'Components',incPath.split('/').pop()+'.html'))) full=path.join(ROOT,'Components',incPath.split('/').pop()+'.html');
    } else {
      full=path.join(ROOT, incPath);
    }
    // Try alternative locations
    if(!fs.existsSync(full)){
      const alt1=path.join(ROOT,'Components',path.basename(incPath)+'.html');
      if(fs.existsSync(alt1)) full=alt1;
    }
    if(!fs.existsSync(full)){
      const alt2=path.join(ROOT,'Styles',path.basename(incPath));
      if(fs.existsSync(alt2)) full=alt2;
      if(fs.existsSync(alt2+'.css')) full=alt2+'.css';
    }
    if(fs.existsSync(full)) return fs.readFileSync(full,'utf8');
    return `<!-- include not found ${inc} -->`;
  });

  // 2) <?= expr ?> — eval with context
  content=content.replace(/<\?= *([^?]+?) *\?>/g, (m, expr)=>{
    try{
      const params=query;
      // expose helper JSON.stringify
      const fn=new Function('currentNis','currentUser','params','JSON',`return (${expr});`);
      const res=fn(nis, currentUser, params, JSON);
      return res==null?'':String(res);
    }catch(e){ return ''; }
  });

  // 3) Remove remaining GAS control tags <? ... ?>  (like if)
  content=content.replace(/<\?[^=][\s\S]*?\?>/g, '');

  // 4) Inject google.script.run polyfill
  const polyfill = `<script>
window.google = window.google || {};
google.script = google.script || {};
(function(){
  const map = {
    register: '/api/register',
    login: '/api/login',
    logout: '/api/logout',
    getCurrentUser: '/api/getCurrentUser',
    getMaterials: '/api/getMaterials',
    getMaterialById: '/api/getMaterialById',
    getPblPhases: '/api/getPblPhases',
    getPblPhaseById: '/api/getPblPhaseById',
    getQuestions: '/api/getQuestions',
    submitTest: '/api/submitTest',
    getTestResult: '/api/getTestResult',
    isTestOpen: '/api/isTestOpen',
    getMotivationQuestions: '/api/getMotivationQuestions',
    submitMotivation: '/api/submitMotivation',
    getMotivationResult: '/api/getMotivationResult',
    getComments: '/api/getComments',
    addComment: '/api/addComment',
    getRecap: '/api/getRecap',
    toggleTest: '/api/toggleTest',
    manageAccessCode: '/api/manageAccessCode',
    exportHasilBelajar: '/api/exportHasilBelajar',
    exportButirSoal: '/api/exportButirSoal',
    exportMotivasi: '/api/exportMotivasi',
    submitTask: '/api/submitTask',
    markComplete: '/api/markComplete'
  };
  function createApi(successCb,failureCb){
    return new Proxy({},{
      get(_,prop){
        if(prop==='withSuccessHandler') return (cb)=> createApi(cb,failureCb);
        if(prop==='withFailureHandler') return (cb)=> createApi(successCb,cb);
        return (...args)=>{
          const endpoint = map[prop] || ('/api/'+prop);
          let body={};
          // build body per function
          if(prop==='register') body={nis:args[0],nama:args[1],password:args[2],confirmPassword:args[3],accessCode:args[4]};
          else if(prop==='login') body={nis:args[0],password:args[1]};
          else if(prop==='logout') body={nis:args[0]};
          else if(prop==='getCurrentUser') body={nis:args[0]};
          else if(prop==='getMaterialById') body={id:args[0]};
          else if(prop==='getPblPhaseById') body={id:args[0]};
          else if(prop==='getQuestions') body={testType:args[0]};
          else if(prop==='submitTest'){
            if(args.length===1 && typeof args[0]==='object' && args[0].answers) body=args[0];
            else if(args.length===3) body={userId:args[0],testType:args[1],answers:args[2]};
            else body=args[0]||{};
          }
          else if(prop==='getTestResult') body={userId:args[0],testType:args[1]};
          else if(prop==='isTestOpen') body={testType:args[0]};
          else if(prop==='submitMotivation'){
            if(args.length===1) body=args[0]; else body={userId:args[0],responses:args[1]};
          }
          else if(prop==='getMotivationResult') body={userId:args[0]};
          else if(prop==='getComments') body={materialId:args[0]};
          else if(prop==='addComment'){
            if(args.length===1) body=args[0]; else body={userId:args[0],materialId:args[1],content:args[2],parentId:args[3]};
          }
          else if(prop==='toggleTest') body={testType:args[0],isOpen:args[1]};
          else if(prop==='manageAccessCode') body={action:args[0],kelas:args[1],code:args[2]};
          else if(prop==='submitTask'){
            if(args.length===1) body=args[0]; else body={userId:args[0],pblPhaseId:args[1],fileBlob:args[2]};
          }
          else if(prop==='markComplete') body={userId:args[0],materialId:args[1]};
          else body=args[0]||{};
          fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
            .then(r=>r.json())
            .then(data=>{ if(successCb) successCb(data); })
            .catch(err=>{ if(failureCb) failureCb(err); else console.error(err); });
          return createApi(successCb,failureCb);
        };
      }
    });
  }
  google.script.run = createApi(null,null);
})();
</script>`;
  content = content.replace('</body>', polyfill + '</body>');
  return content;
}

const server=http.createServer(async (req,res)=>{
  const parsed=url.parse(req.url,true);
  const pathname=parsed.pathname;
  const query=parsed.query;

  // CORS for API
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');

  if(req.method==='OPTIONS'){ res.writeHead(204); res.end(); return; }

  // Static
  if(serveStatic(req,res)) return;

  // API routes
  if(pathname.startsWith('/api/')){
    const body=await parseBody(req);
    const api=pathname.replace('/api/','');
    let result={success:false,message:'Unknown API '+api};
    try{
      switch(api){
        case 'register': result=registerService(body); break;
        case 'login': result=loginService(body); break;
        case 'logout': result=logoutService(body); break;
        case 'getCurrentUser': result=getCurrentUserService(body) || {success:false,message:'No session'}; if(result && result.id) result={success:true,user:result}; break;
        case 'getMaterials': result=getMaterialsService(); break;
        case 'getMaterialById': result=getMaterialByIdService(body); break;
        case 'getPblPhases': result=getPblPhasesService(); break;
        case 'getPblPhaseById': result=getPblPhaseByIdService(body); break;
        case 'getQuestions': result=getQuestionsService(body); break;
        case 'submitTest': result=submitTestService(body); break;
        case 'getTestResult': result=getTestResultService(body); break;
        case 'isTestOpen': result=isTestOpenService(body); break;
        case 'getMotivationQuestions': result=getMotivationQuestionsService(); break;
        case 'submitMotivation': result=submitMotivationService(body); break;
        case 'getMotivationResult': result=getMotivationResultService(body); break;
        case 'getComments': result=getCommentsService(body); break;
        case 'addComment': result=addCommentService(body); break;
        case 'getRecap': result=getRecapService(); break;
        case 'toggleTest': result=toggleTestService(body); break;
        case 'manageAccessCode': result=manageAccessCodeService(body); break;
        case 'exportHasilBelajar': result=exportHasilBelajarService(); break;
        case 'exportButirSoal': result=exportButirSoalService(); break;
        case 'exportMotivasi': result=exportMotivasiService(); break;
        case 'markComplete': result=markCompleteService(body); break;
        case 'submitTask': result=submitTaskService(body); break;
        case 'getStudentProgress': result=progressApi.getStudentProgressService(body); break;
        case 'submitMateriQuiz': result=progressApi.submitMateriQuizService(body); break;
        case 'getGuruOverview': result=progressApi.getGuruOverviewService(body); break;
        default: result={success:false,message:'API not found: '+api};
      }
    }catch(e){ result=handleError(e); }
    // For isTestOpen, GAS returns boolean directly but we wrap
    if(api==='isTestOpen' && typeof result==='boolean') result={success:true,isOpen:result};
    // Normalize for getCurrentUser
    if(api==='getCurrentUser' && result && result.nis) result={success:true,user:result};
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify(result));
    return;
  }

  // Page rendering (GAS doGet) — 3 halaman SPA, session dikelola client via localStorage
  let page=(query.page||'login').toLowerCase();
  const valid=['login','dashboard','guru'];
  if(!valid.includes(page)) page='login';

  const map={
    login:'Views/Login.html',
    dashboard:'Views/DashboardSiswa.html',
    guru:'Views/DashboardGuru.html'
  };
  const file=map[page]||'Views/Login.html';
  const fullPath=path.join(ROOT,file);
  if(!fs.existsSync(fullPath)){
    res.writeHead(404,{'Content-Type':'text/html'});
    res.end('Page not found: '+page);
    return;
  }
  const html=renderGASTemplate(fullPath, query);
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  res.end(html);
});

server.listen(PORT, ()=>{
  console.log(`✅ Weblog DDK Local running at http://localhost:${PORT}`);
  console.log(`   Siswa:    http://localhost:${PORT}/  (daftar/login tanpa kode akses)`);
  console.log(`   Siswa demo: 2024001 / siswa123`);
  console.log(`   Guru:     http://localhost:${PORT}/?page=guru  (GURU001 / guru123)`);
  console.log(`   DB:       ${DB_PATH}`);
});

// Handle shutdown
process.on('SIGINT', ()=>{ console.log('\nShutting down...'); process.exit(0); });
