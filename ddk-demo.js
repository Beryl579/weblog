/**
 * static_backend.js — backend tiruan untuk versi statis (GitHub Pages).
 *
 * Versi statis tidak punya server, jadi `fetch('/api/...')` yang dipanggil oleh
 * Views/*.html dicegat dan dijawab di dalam browser. Datanya disimpan di
 * localStorage pengunjung, sehingga:
 *   - tidak ada data yang berpindah ke mana pun (semua di komputer pengunjung),
 *   - progres tiap orang terpisah dan hilang kalau localStorage dibersihkan.
 *
 * Logika gating kuis TIDAK ditulis ulang di sini: berkas ini memakai ulang
 * local/progress_api.js (di-inline oleh local/build-static.js) supaya aturannya
 * tetap satu sumber dengan server lokal dan Apps Script.
 *
 * Berkas ini disalin menjadi `ddk-demo.js` di root repo. JANGAN diedit manual —
 * ubah sumbernya lalu jalankan `node local/build-static.js`.
 */

/* ===== progress_api.js (di-inline oleh build-static.js) ===== */
(function () {
  var module = { exports: {} }, exports = module.exports;
/**
 * progress_api.js — API progres belajar (kuis gating + rekap guru) untuk server lokal
 * Dipakai server.js via require(). Data disimpan di db.json sheet 'progress'.
 * quiz_key: kuis1..kuis4 | ujian ; KKTP = 75
 */

const PASS_SCORE = 75;
const QUIZ_KEYS = ['kuis1', 'kuis2', 'kuis3', 'kuis4'];

function makeProgressApi(db) {
  function saveDb() { db.saveDb(); }
  function getAllRows(name) { return db.getAllRows(name); }
  function findRow(name, col, val) { return db.findRow(name, col, val); }
  function findRows(name, col, val) { return db.findRows(name, col, val); }
  function insertRow(name, obj) { return db.insertRow(name, obj); }
  function updateRow(name, idx, obj) { return db.updateRow(name, idx, obj); }
  function getNextId(name) { return db.getNextId(name); }
  function now() { return new Date().toISOString(); }
  function handleError(e) { return { success: false, message: e.message }; }

  function ensureProgressSheet() {
    if (!db.db['progress']) db.db['progress'] = [];
  }

  function isQuizPassed(userId, quizKey) {
    const rows = findRows('progress', 'user_id', userId);
    for (const r of rows) {
      if (String(r.quiz_key).trim() === String(quizKey).trim()) {
        return String(r.passed).toLowerCase() === 'true' || r.passed === true;
      }
    }
    return false;
  }

  function normalize(rows) {
    const progress = { kuis: { kuis1: null, kuis2: null, kuis3: null, kuis4: null }, ujian: null };
    for (const r of rows) {
      const key = String(r.quiz_key || '').trim();
      const node = {
        best: Number(r.best_score) || 0,
        passed: String(r.passed).toLowerCase() === 'true' || r.passed === true,
        score: Number(r.score) || 0,
        total: Number(r.total_questions) || 0,
        attempts: Number(r.attempts) || 1
      };
      if (key === 'ujian') progress.ujian = node;
      else if (QUIZ_KEYS.includes(key)) progress.kuis[key] = node;
    }
    return progress;
  }

  function getStudentProgressService({ userId, nis }) {
    try {
      const row = userId ? findRow('users', 'id', userId) : (nis ? findRow('users', 'nis', nis) : null);
      if (!row) return { success: false, message: 'User tidak ditemukan' };
      const rows = findRows('progress', 'user_id', row.id);
      return { success: true, progress: normalize(rows) };
    } catch (e) { return handleError(e); }
  }

  function submitMateriQuizService({ userId, nis, quizKey, score, total }) {
    try {
      quizKey = String(quizKey || '').toLowerCase().trim();
      score = parseInt(score, 10) || 0;
      total = parseInt(total, 10) || 0;
      const user = userId ? findRow('users', 'id', userId) : (nis ? findRow('users', 'nis', nis) : null);
      if (!user) return { success: false, message: 'User tidak ditemukan' };
      if (!QUIZ_KEYS.includes(quizKey) && quizKey !== 'ujian') return { success: false, message: 'quizKey tidak valid' };
      if (total <= 0) return { success: false, message: 'total soal tidak valid' };

      // Gating server-side
      if (quizKey !== 'kuis1' && quizKey !== 'ujian') {
        const prev = 'kuis' + (parseInt(quizKey.replace('kuis', ''), 10) - 1);
        if (!isQuizPassed(user.id, prev)) return { success: false, message: 'Kuis sebelumnya belum lulus (KKTP ' + PASS_SCORE + ')' };
      }
      if (quizKey === 'ujian' && !isQuizPassed(user.id, 'kuis4')) {
        return { success: false, message: 'Selesaikan kuis Materi 4 dulu' };
      }

      const nilai = Math.round(score / total * 100);
      const passed = nilai >= PASS_SCORE;

      const rows = findRows('progress', 'user_id', user.id);
      const existing = rows.find(r => String(r.quiz_key).trim() === quizKey);
      if (existing) {
        const prevBest = Number(existing.best_score) || 0;
        const attempts = (Number(existing.attempts) || 1) + 1;
        updateRow('progress', existing._rowIndex, {
          best_score: Math.max(prevBest, nilai),
          score, total_questions: total,
          passed: (String(existing.passed).toLowerCase() === 'true' || existing.passed === true) || passed,
          attempts, updated_at: now()
        });
      } else {
        insertRow('progress', {
          id: getNextId('progress'), user_id: user.id, nis: user.nis,
          quiz_key: quizKey, best_score: nilai, score, total_questions: total,
          passed, attempts: 1, updated_at: now()
        });
      }

      insertRow('activity_logs', { id: getNextId('activity_logs'), user_id: user.id, action: quizKey === 'ujian' ? 'submit_ujian' : 'submit_kuis', target_id: user.id, timestamp: now() });
      saveDb();

      const fresh = findRows('progress', 'user_id', user.id);
      return { success: true, message: 'Nilai disimpan', progress: normalize(fresh) };
    } catch (e) { return handleError(e); }
  }

  function getGuruOverviewService() {
    try {
      const students = getAllRows('users').filter(u => String(u.role).toLowerCase() === 'siswa');
      students.sort((a, b) => String(a.kelas).localeCompare(String(b.kelas)) || String(a.nama).localeCompare(String(b.nama)));
      const data = students.map(s => {
        const rows = findRows('progress', 'user_id', s.id);
        const map = {};
        rows.forEach(r => { map[String(r.quiz_key).trim()] = r; });
        const d = {
          nis: s.nis, nama: s.nama, kelas: s.kelas, materi_selesai: 0,
          kuis1: null, kuis2: null, kuis3: null, kuis4: null,
          kuis1_passed: false, kuis2_passed: false, kuis3_passed: false, kuis4_passed: false,
          ujian: null, rata_kuis: null
        };
        const kuisVals = [];
        for (let k = 1; k <= 4; k++) {
          const key = 'kuis' + k, r = map[key];
          if (r) {
            const best = Number(r.best_score) || 0;
            d[key] = best;
            d[key + '_passed'] = String(r.passed).toLowerCase() === 'true' || r.passed === true;
            if (d[key + '_passed']) d.materi_selesai++;
            kuisVals.push(best);
          }
        }
        if (map['ujian']) d.ujian = Number(map['ujian'].best_score) || 0;
        if (kuisVals.length) d.rata_kuis = Math.round(kuisVals.reduce((a, b) => a + b, 0) / kuisVals.length);
        return d;
      });
      return { success: true, data };
    } catch (e) { return handleError(e); }
  }

  /**
   * registerService BARU — tanpa kode akses, siswa pilih kelas langsung
   */
  function registerService({ nis, nama, kelas, password, confirmPassword }) {
    try {
      nis = String(nis || '').trim();
      nama = String(nama || '').trim();
      kelas = String(kelas || '').trim();
      password = String(password || '');
      confirmPassword = String(confirmPassword || '');

      if (!nis || !nama || !kelas || !password || !confirmPassword) return { success: false, message: 'Semua field wajib diisi' };
      if (!/^\d{4,20}$/.test(nis)) return { success: false, message: 'NIS tidak valid (4-20 digit angka)' };
      if (nama.length < 3) return { success: false, message: 'Nama minimal 3 karakter' };
      if (!['X TITL 1', 'X TITL 2'].includes(kelas)) return { success: false, message: 'Kelas tidak valid' };
      if (password.length < 6) return { success: false, message: 'Password minimal 6 karakter' };
      if (password !== confirmPassword) return { success: false, message: 'Konfirmasi password tidak cocok' };

      if (findRow('users', 'nis', nis)) return { success: false, message: 'NIS sudah terdaftar. Silakan login.' };

      const MAX_PER_CLASS = 40;
      if (db.countRows('users', 'kelas', kelas) >= MAX_PER_CLASS) return { success: false, message: 'Kuota kelas penuh. Hubungi guru.' };

      const newId = db.getNextId('users');
      const hash = db.hashPassword(password);
      db.insertRow('users', { id: newId, nis, nama, kelas, role: 'siswa', is_eksperimen: true, password_hash: hash, registered_at: now(), is_active: true });
      db.insertRow('activity_logs', { id: db.getNextId('activity_logs'), user_id: newId, action: 'register', target_id: newId, timestamp: now() });
      return { success: true, message: 'Registrasi berhasil! Silakan login.', userId: newId, kelas };
    } catch (e) { return handleError(e); }
  }

  /**
   * Seed akun demo siswa (2024001/siswa123) + sheet progress kosong
   */
  function seedProgressData() {
    ensureProgressSheet();
    let seeded = false;
    if (!findRow('users', 'nis', '2024001')) {
      const nid = db.getNextId('users');
      db.insertRow('users', {
        id: nid, nis: '2024001', nama: 'Siswa Contoh', kelas: 'X TITL 1', role: 'siswa',
        is_eksperimen: true, password_hash: db.hashPassword('siswa123'), registered_at: now(), is_active: true
      });
      seeded = true;
    }
    if (seeded) saveDb();
  }

  return { getStudentProgressService, submitMateriQuizService, getGuruOverviewService, registerService, seedProgressData, ensureProgressSheet };
}

module.exports = { makeProgressApi, PASS_SCORE };

  window.__ddkProgress = module.exports;
})();

/* ===== adapter db berbasis localStorage ===== */
(function () {
  'use strict';

  var PROGRESS = window.__ddkProgress;
  var DB_KEY = 'ddk_demo_db_v1';
  var SALT = 'DDK2025_UNIMED_SALT';
  var TABLES = [
    'users', 'class_config', 'materials', 'tests', 'questions',
    'test_attempts', 'test_answers', 'motivation_indicators', 'motivation_responses',
    'comments', 'pbl_phases', 'task_submissions', 'activity_logs', 'progress'
  ];

  /**
   * Hash password untuk versi demo.
   * Sengaja BUKAN SHA-256 asli: Web Crypto bersifat asinkron, sedangkan
   * progress_api.js memanggil hashPassword() secara sinkron. Karena seluruh data
   * hanya tersimpan di browser pengunjung, ini bukan batas keamanan — versi
   * Apps Script dan server lokal tetap memakai SHA-256 + salt.
   */
  function hashPassword(password) {
    var s = SALT + '|' + String(password);
    var h1 = 0x811c9dc5, h2 = 0x1000193;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = (Math.imul(h2 + c * (i + 1), 2654435761)) >>> 0;
    }
    return ('00000000' + h1.toString(16)).slice(-8) +
           ('00000000' + h2.toString(16)).slice(-8);
  }

  function emptyDb() {
    var o = {};
    TABLES.forEach(function (t) { o[t] = []; });
    return o;
  }

  function load() {
    var data = null;
    try { data = JSON.parse(localStorage.getItem(DB_KEY) || 'null'); } catch (e) { data = null; }
    if (!data || typeof data !== 'object') data = emptyDb();
    TABLES.forEach(function (t) { if (!Array.isArray(data[t])) data[t] = []; });
    return data;
  }

  var data = load();

  var db = {
    db: data, // dipakai progress_api (ensureProgressSheet)

    saveDb: function () {
      try { localStorage.setItem(DB_KEY, JSON.stringify(data)); } catch (e) { /* kuota penuh / mode privat */ }
    },

    // _rowIndex meniru nomor baris Sheet (data mulai baris 2) supaya updateRow tetap cocok.
    getAllRows: function (name) {
      return (data[name] || []).map(function (r, i) {
        var o = {};
        for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k)) o[k] = r[k];
        o._rowIndex = i + 2;
        return o;
      });
    },

    findRow: function (name, col, val) {
      var target = String(val).trim(), rows = this.getAllRows(name);
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][col]).trim() === target) return rows[i];
      }
      return null;
    },

    findRows: function (name, col, val) {
      var target = String(val).trim();
      return this.getAllRows(name).filter(function (r) {
        return String(r[col]).trim() === target;
      });
    },

    countRows: function (name, col, val) { return this.findRows(name, col, val).length; },

    getNextId: function (name) {
      var rows = this.getAllRows(name), max = 0;
      for (var i = 0; i < rows.length; i++) {
        var id = parseInt(rows[i].id, 10);
        if (!isNaN(id) && id > max) max = id;
      }
      return max + 1;
    },

    insertRow: function (name, obj) {
      if (!obj.id) obj.id = this.getNextId(name);
      if (!data[name]) data[name] = [];
      var clone = {};
      for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) clone[k] = obj[k];
      data[name].push(clone);
      this.saveDb();
      return { success: true, id: clone.id, rowIndex: data[name].length + 1 };
    },

    updateRow: function (name, rowIndex, obj) {
      var i = rowIndex - 2;
      if (!data[name] || !data[name][i]) return { success: false, message: 'Baris tidak ditemukan' };
      for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) data[name][i][k] = obj[k];
      this.saveDb();
      return { success: true, rowIndex: rowIndex };
    },

    hashPassword: hashPassword
  };

  /* ===== seed akun demo (sekali, saat pertama dibuka) ===== */
  function seed() {
    var seeds = [
      { nis: 'GURU001',  nama: 'Guru Pamong', kelas: 'X TITL 1', role: 'guru',  password: 'guru123'  },
      { nis: 'ADMIN001', nama: 'Admin',       kelas: 'X TITL 1', role: 'admin', password: 'admin123' },
      { nis: '2024001',  nama: 'Siswa Contoh', kelas: 'X TITL 1', role: 'siswa', password: 'siswa123' }
    ];
    seeds.forEach(function (s) {
      if (db.findRow('users', 'nis', s.nis)) return;
      db.insertRow('users', {
        id: db.getNextId('users'),
        nis: s.nis, nama: s.nama, kelas: s.kelas, role: s.role,
        is_eksperimen: true, password_hash: hashPassword(s.password),
        registered_at: new Date().toISOString(), is_active: true
      });
    });
    if (!db.getAllRows('class_config').length) {
      db.insertRow('class_config', { id: 1, kelas: 'X TITL 1', access_code: '', is_eksperimen: true, max_students: 40 });
      db.insertRow('class_config', { id: 2, kelas: 'X TITL 2', access_code: '', is_eksperimen: true, max_students: 40 });
    }
  }

  seed();
  var progressApi = PROGRESS.makeProgressApi(db);
  progressApi.seedProgressData();

  /* ===== sesi (hanya di memori tab; versi asli pakai CacheService) ===== */
  var sessions = {};

  function loginService(body) {
    var nis = String((body && body.nis) || '').trim();
    var password = String((body && body.password) || '');
    if (!nis || !password) return { success: false, message: 'NIS dan Password wajib diisi' };
    var user = db.findRow('users', 'nis', nis);
    if (!user) return { success: false, message: 'NIS tidak terdaftar. Silakan daftar terlebih dahulu.' };
    if (String(user.is_active).toLowerCase() === 'false' || user.is_active === false) {
      return { success: false, message: 'Akun non-aktif. Hubungi guru.' };
    }
    if (hashPassword(password) !== String(user.password_hash).trim()) {
      return { success: false, message: 'Password salah' };
    }
    var session = {
      id: user.id, nis: user.nis, nama: user.nama, kelas: user.kelas,
      role: user.role, is_eksperimen: user.is_eksperimen,
      login_at: new Date().toISOString()
    };
    sessions[nis] = session;
    db.insertRow('activity_logs', {
      id: db.getNextId('activity_logs'), user_id: user.id,
      action: 'login', target_id: user.id, timestamp: new Date().toISOString()
    });
    return { success: true, message: 'Login berhasil', user: session };
  }

  /* ===== router: /api/<fn> -> service ===== */
  function handle(fn, body) {
    switch (fn) {
      case 'login':              return loginService(body);
      case 'logout':             return { success: true, message: 'Logout berhasil' };
      case 'register':           return progressApi.registerService(body || {});
      case 'getStudentProgress': return progressApi.getStudentProgressService(body || {});
      case 'submitMateriQuiz':   return progressApi.submitMateriQuizService(body || {});
      case 'getGuruOverview':    return progressApi.getGuruOverviewService(body || {});
      case 'getCurrentUser':     return { success: false };
      default:                   return { success: false, message: 'Endpoint demo tidak tersedia: ' + fn };
    }
  }

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : ((input && input.url) || '');
    var match = /^\/api\/([A-Za-z_]+)$/.exec(String(url).split('?')[0]);
    if (!match) return realFetch ? realFetch(input, init) : Promise.reject(new Error('offline'));

    var body = {};
    try { body = init && init.body ? JSON.parse(init.body) : {}; } catch (e) { body = {}; }

    var result;
    try { result = handle(match[1], body); }
    catch (e) { result = { success: false, message: (e && e.message) || String(e) }; }

    return Promise.resolve(new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
  };

  // Penanda agar mudah dicek dari console: versi statis aktif.
  window.DDK_STATIC_DEMO = true;
})();
