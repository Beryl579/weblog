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
