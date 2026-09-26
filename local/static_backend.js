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
/* __PROGRESS_API__ */

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
