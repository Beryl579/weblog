/**
 * ProgressService.gs — Penyimpanan & rekap progres belajar siswa
 * Dipakai oleh DashboardSiswa (SPA) dan DashboardGuru.
 * Sheet: 'progress' (id, user_id, nis, quiz_key, best_score, score, total_questions, passed, attempts, updated_at)
 * quiz_key: kuis1 | kuis2 | kuis3 | kuis4 | ujian
 * Gating: materi N terbuka jika kuis (N-1) lulus; ujian terbuka jika kuis4 lulus.
 * KKTP kuis = 75.
 */

var PASS_SCORE = 75;
var QUIZ_KEYS = ['kuis1', 'kuis2', 'kuis3', 'kuis4'];

function getProgressSheetName() { return 'progress'; }

/**
 * Ambil semua baris progres satu siswa sebagai objek ter-normalisasi
 * return progress = { kuis: {kuis1:{best,passed,score,total,attempts},...}, ujian:{...} }
 */
function getStudentProgress(payload) {
  try {
    var userId = payload && payload.userId ? String(payload.userId).trim() : '';
    var nis = payload && payload.nis ? String(payload.nis).trim() : '';
    var row = null;

    if (userId) {
      row = findRow('users', 'id', userId);
    } else if (nis) {
      row = findRow('users', 'nis', nis);
    }
    if (!row) return { success: false, message: 'User tidak ditemukan' };

    var rows = findRows(getProgressSheetName(), 'user_id', row['id']);
    var progress = { kuis: { kuis1: null, kuis2: null, kuis3: null, kuis4: null }, ujian: null };
    for (var i = 0; i < rows.length; i++) {
      var key = String(rows[i]['quiz_key'] || '').trim();
      var node = {
        best: Number(rows[i]['best_score']) || 0,
        passed: String(rows[i]['passed']).toLowerCase() === 'true' || rows[i]['passed'] === true,
        score: Number(rows[i]['score']) || 0,
        total: Number(rows[i]['total_questions']) || 0,
        attempts: Number(rows[i]['attempts']) || 1
      };
      if (key === 'ujian') progress.ujian = node;
      else if (QUIZ_KEYS.indexOf(key) !== -1) progress.kuis[key] = node;
    }
    return { success: true, progress: progress };
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Simpan hasil kuis/ujian siswa (best score dipertahankan, attempts bertambah)
 * payload: {userId|nis, quizKey: kuis1..kuis4|ujian, score, total}
 */
function submitMateriQuiz(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var userId = payload && payload.userId ? String(payload.userId).trim() : '';
    var nis = payload && payload.nis ? String(payload.nis).trim() : '';
    var quizKey = String(payload && payload.quizKey ? payload.quizKey : '').toLowerCase().trim();
    var score = parseInt(payload && payload.score, 10) || 0;
    var total = parseInt(payload && payload.total, 10) || 0;

    if (!userId && !nis) return { success: false, message: 'userId/nis wajib' };
    if (QUIZ_KEYS.indexOf(quizKey) === -1 && quizKey !== 'ujian') {
      return { success: false, message: 'quizKey tidak valid' };
    }
    if (total <= 0) return { success: false, message: 'total soal tidak valid' };

    var user = userId ? findRow('users', 'id', userId) : findRow('users', 'nis', nis);
    if (!user) return { success: false, message: 'User tidak ditemukan' };

    // Gating server-side
    if (quizKey !== 'kuis1' && quizKey !== 'ujian') {
      var prev = 'kuis' + (parseInt(quizKey.replace('kuis', ''), 10) - 1);
      if (!isQuizPassed(user['id'], prev)) {
        return { success: false, message: 'Kuis sebelumnya belum lulus (KKTP ' + PASS_SCORE + ')' };
      }
    }
    if (quizKey === 'ujian' && !isQuizPassed(user['id'], 'kuis4')) {
      return { success: false, message: 'Selesaikan kuis Materi 4 dulu' };
    }

    var nilai = Math.round(score / total * 100);
    var passed = nilai >= PASS_SCORE;

    // Cari existing
    var rows = findRows(getProgressSheetName(), 'user_id', user['id']);
    var existing = null;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i]['quiz_key']).trim() === quizKey) { existing = rows[i]; break; }
    }

    if (existing) {
      var prevBest = Number(existing['best_score']) || 0;
      var attempts = (Number(existing['attempts']) || 1) + 1;
      var newBest = Math.max(prevBest, nilai);
      updateRow(getProgressSheetName(), existing['_rowIndex'], {
        best_score: newBest,
        score: score,
        total_questions: total,
        passed: (String(existing['passed']).toLowerCase() === 'true' || existing['passed'] === true) || passed,
        attempts: attempts,
        updated_at: now()
      });
    } else {
      insertRow(getProgressSheetName(), {
        id: getNextId(getProgressSheetName()),
        user_id: user['id'],
        nis: user['nis'],
        quiz_key: quizKey,
        best_score: nilai,
        score: score,
        total_questions: total,
        passed: passed,
        attempts: 1,
        updated_at: now()
      });
    }

    try {
      insertRow('activity_logs', {
        id: getNextId('activity_logs'),
        user_id: user['id'],
        action: quizKey === 'ujian' ? 'submit_ujian' : 'submit_kuis',
        target_id: user['id'],
        timestamp: now()
      });
    } catch (e) { Logger.log('log fail: ' + e.message); }

    var res = getStudentProgress({ userId: user['id'] });
    return { success: true, message: 'Nilai disimpan', progress: res.progress };
  } catch (e) {
    return handleError(e);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Apakah quizKey sudah lulus KKTP untuk user tertentu
 */
function isQuizPassed(userId, quizKey) {
  var rows = findRows(getProgressSheetName(), 'user_id', userId);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['quiz_key']).trim() === String(quizKey).trim()) {
      return String(rows[i]['passed']).toLowerCase() === 'true' || rows[i]['passed'] === true;
    }
  }
  return false;
}

/**
 * Rekap untuk Dashboard Guru:
 * data = [{ nis, nama, kelas, materi_selesai, kuis1..kuis4 (best | null), kuisN_passed, ujian, rata_kuis }]
 */
function getGuruOverview(payload) {
  try {
    var students = getAllRows('users').filter(function(u) {
      return String(u['role']).toLowerCase() === 'siswa';
    });
    students.sort(function(a, b) {
      var k = String(a['kelas']).localeCompare(String(b['kelas']));
      if (k !== 0) return k;
      return String(a['nama']).localeCompare(String(b['nama']));
    });

    var data = [];
    for (var i = 0; i < students.length; i++) {
      var s = students[i];
      var rows = findRows(getProgressSheetName(), 'user_id', s['id']);
      var map = {};
      for (var j = 0; j < rows.length; j++) {
        map[String(rows[j]['quiz_key']).trim()] = rows[j];
      }
      var d = {
        nis: s['nis'],
        nama: s['nama'],
        kelas: s['kelas'],
        materi_selesai: 0,
        kuis1: null, kuis2: null, kuis3: null, kuis4: null,
        kuis1_passed: false, kuis2_passed: false, kuis3_passed: false, kuis4_passed: false,
        ujian: null,
        rata_kuis: null
      };
      var kuisVals = [];
      for (var k = 1; k <= 4; k++) {
        var key = 'kuis' + k;
        var r = map[key];
        if (r) {
          var best = Number(r['best_score']) || 0;
          d[key] = best;
          d[key + '_passed'] = String(r['passed']).toLowerCase() === 'true' || r['passed'] === true;
          if (d[key + '_passed']) d.materi_selesai++;
          kuisVals.push(best);
        }
      }
      var u = map['ujian'];
      if (u) d.ujian = Number(u['best_score']) || 0;
      if (kuisVals.length) {
        d.rata_kuis = Math.round(kuisVals.reduce(function(a, b) { return a + b; }, 0) / kuisVals.length);
      }
      data.push(d);
    }

    return { success: true, data: data };
  } catch (e) {
    return handleError(e);
  }
}
