/**
 * QuizService.gs — Pretest/Posttest logic + scoring + anti-cheat
 * PLAN.md:552-581, PDF p34-42, Hard Constraint #2 & #3
 */

/**
 * getQuestions(testType) — PLAN.md:554-559
 * testType: 'pretest' | 'posttest'
 * PENTING: JANGAN kirim correct_answer ke client — PDF & PLAN Hard #3
 */
function getQuestions(testType) {
  try {
    testType = String(testType || '').toLowerCase().trim();
    if (testType !== 'pretest' && testType !== 'posttest') {
      throw new Error('testType harus pretest atau posttest');
    }

    // Ambil test_id dari sheet tests
    var testRow = findRow('tests', 'type', testType);
    if (!testRow) throw new Error('Test "' + testType + '" belum dibuat di sheet tests');

    var testId = testRow['id'];
    var questions = findRows('questions', 'test_id', testId);

    // sort by order_num
    questions.sort(function(a, b) {
      return Number(a['order_num']) - Number(b['order_num']);
    });

    // Strip correct_answer
    var safe = [];
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      safe.push({
        id: q['id'],
        test_id: q['test_id'],
        question_text: q['question_text'],
        option_a: q['option_a'],
        option_b: q['option_b'],
        option_c: q['option_c'],
        option_d: q['option_d'],
        cognitive_level: q['cognitive_level'], // C1-C4 PDF p34
        order_num: q['order_num']
        // correct_answer SENGAJA TIDAK DIKIRIM
      });
    }
    return { success: true, test: { id: testId, type: testType, total_questions: safe.length, is_open: testRow['is_open'] }, questions: safe };
  } catch (e) {
    return handleError(e);
  }
}

/**
 * hasCompletedTest(userId, testType) — PLAN.md:577-579
 */
function hasCompletedTest(userId, testType) {
  try {
    var testRow = findRow('tests', 'type', String(testType).toLowerCase());
    if (!testRow) return false;
    var testId = testRow['id'];
    var attempts = findRows('test_attempts', 'user_id', userId);
    for (var i = 0; i < attempts.length; i++) {
      if (String(attempts[i]['test_id']).trim() === String(testId).trim()) return true;
    }
    return false;
  } catch (e) {
    Logger.log('hasCompletedTest error: ' + e.message);
    return false;
  }
}

/**
 * isTestOpen(testType) — PLAN.md:573-575
 */
function isTestOpen(testType) {
  try {
    var testRow = findRow('tests', 'type', String(testType).toLowerCase());
    if (!testRow) return false;
    var v = String(testRow['is_open']).toLowerCase();
    return v === 'true' || testRow['is_open'] === true;
  } catch (e) {
    return false;
  }
}

/**
 * getTestResult(userId, testType) — PLAN.md:570-572
 * Return skor tanpa kunci jawaban
 */
function getTestResult(userId, testType) {
  try {
    var testRow = findRow('tests', 'type', String(testType).toLowerCase());
    if (!testRow) return { success: false, message: 'Test tidak ditemukan' };
    var testId = testRow['id'];
    var attempts = findRows('test_attempts', 'user_id', userId);
    var attempt = null;
    for (var i = 0; i < attempts.length; i++) {
      if (String(attempts[i]['test_id']).trim() === String(testId).trim()) {
        attempt = attempts[i];
        break;
      }
    }
    if (!attempt) return { success: false, message: 'Belum mengerjakan ' + testType, completed: false };

    // ambil answers untuk detail per soal (tanpa kunci global, tapi is_correct sudah tersimpan)
    var answers = findRows('test_answers', 'attempt_id', attempt['id']);
    return {
      success: true,
      completed: true,
      attempt: {
        id: attempt['id'],
        raw_score: attempt['raw_score'],
        final_value: attempt['final_value'], // PDF p35 (Benar/20*100)
        submitted_at: attempt['submitted_at']
      },
      answers: answers // is_correct, score, selected_answer (tanpa correct_answer global)
    };
  } catch (e) {
    return handleError(e);
  }
}

/**
 * submitTest(userId, testType, answers)
 * answers: [{question_id, selected_answer: 'A'|'B'|'C'|'D'}]
 * PLAN.md:560-568, Hard #2 anti-cheat, #3 kunci hidden, LockService
 */
function submitTest(userId, testType, answers) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    testType = String(testType || '').toLowerCase().trim();
    if (!testType || (testType !== 'pretest' && testType !== 'posttest')) {
      return { success: false, message: 'Jenis test tidak valid' };
    }
    if (!userId) return { success: false, message: 'userId wajib' };
    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return { success: false, message: 'Jawaban kosong' };
    }

    // Validasi user ada
    var user = findRow('users', 'id', userId);
    if (!user) return { success: false, message: 'User tidak ditemukan' };

    // Ambil test
    var testRow = findRow('tests', 'type', testType);
    if (!testRow) return { success: false, message: 'Test ' + testType + ' tidak ditemukan' };
    var testId = testRow['id'];

    // Cek is_open — guru yang buka/tutup PLAN.md:412, PDF p40 langkah 6
    if (!isTestOpen(testType)) {
      return { success: false, message: testType + ' sedang tertutup. Hubungi guru.' };
    }

    // Gate posttest: hanya jika pretest selesai — PLAN.md:412
    if (testType === 'posttest') {
      if (!hasCompletedTest(userId, 'pretest')) {
        return { success: false, message: 'Posttest hanya bisa setelah pretest selesai' };
      }
    }

    // 1. Anti-cheat cek UNIQUE(user_id, test_id) — PLAN.md:561,565
    if (hasCompletedTest(userId, testType)) {
      return { success: false, message: 'Anda sudah submit ' + testType + ' sebelumnya. Tidak bisa submit ulang.' };
    }

    // Validasi jumlah jawaban harus 20 (PDF p34, p42)
    // ambil jumlah soal sebenarnya
    var allQs = findRows('questions', 'test_id', testId);
    if (answers.length !== allQs.length) {
      // tetap izinkan tapi log warning — karena client mungkin skip? Kita wajibkan 20
      // return error jika kurang
      if (answers.length < allQs.length) {
        return { success: false, message: 'Jawaban belum lengkap (' + answers.length + '/' + allQs.length + ')' };
      }
    }

    // 2. Ambil kunci jawaban server-side only — PLAN.md:562-563
    var keyMap = {};
    for (var k = 0; k < allQs.length; k++) {
      keyMap[String(allQs[k]['id']).trim()] = String(allQs[k]['correct_answer']).trim().toUpperCase();
    }

    // 3. Hitung skor — PDF p35: benar 1 salah 0
    var rawScore = 0;
    var scoredAnswers = [];
    for (var i = 0; i < answers.length; i++) {
      var ans = answers[i];
      var qid = String(ans.question_id).trim();
      var selected = String(ans.selected_answer || '').trim().toUpperCase();
      if (['A', 'B', 'C', 'D'].indexOf(selected) === -1) {
        return { success: false, message: 'Jawaban tidak valid untuk soal ' + qid };
      }
      var correct = keyMap[qid];
      if (!correct) {
        return { success: false, message: 'Soal ID ' + qid + ' tidak ditemukan' };
      }
      var isCorrect = (selected === correct);
      var score = isCorrect ? 1 : 0;
      rawScore += score;
      scoredAnswers.push({
        question_id: qid,
        selected_answer: selected,
        is_correct: isCorrect,
        score: score,
        correct_answer: correct // simpan internal tapi tidak return ke client? untuk test_answers kita simpan is_correct saja
      });
    }

    // 4. Hitung final_value — PDF p35: Nilai = (Jumlah skor / Jumlah skor total)*100
    var totalQuestions = allQs.length; // 20
    var finalValue = calcNilai(rawScore, totalQuestions); // (raw/20)*100

    // 5. Simpan ke test_attempts — PLAN.md:564
    var attemptId = getNextId('test_attempts');
    var attemptData = {
      id: attemptId,
      user_id: userId,
      test_id: testId,
      raw_score: rawScore,
      final_value: Number(finalValue.toFixed(2)),
      started_at: now(), // idealnya dari client started_at, tapi pakai now untuk simpel
      submitted_at: now()
    };
    insertRow('test_attempts', attemptData);

    // 6. Simpan ke test_answers
    for (var j = 0; j < scoredAnswers.length; j++) {
      var sa = scoredAnswers[j];
      insertRow('test_answers', {
        id: getNextId('test_answers'),
        attempt_id: attemptId,
        question_id: sa.question_id,
        selected_answer: sa.selected_answer,
        is_correct: sa.is_correct,
        score: sa.score
      });
    }

    // 7. Log activity
    try {
      insertRow('activity_logs', {
        id: getNextId('activity_logs'),
        user_id: userId,
        action: 'submit_kuis',
        target_id: attemptId,
        timestamp: now()
      });
    } catch (e) { Logger.log('log submitTest fail: ' + e.message); }

    // 8. Return skor tanpa kunci jawaban — PLAN.md:410
    return {
      success: true,
      message: 'Submit ' + testType + ' berhasil',
      result: {
        raw_score: rawScore,
        final_value: Number(finalValue.toFixed(2)),
        total_questions: totalQuestions
      }
    };

  } catch (e) {
    return handleError(e);
  } finally {
    lock.releaseLock();
  }
}

/**
 * toggleTest via GuruService, tapi expose helper disini juga
 */
function setTestOpen(testType, isOpen) {
  var row = findRow('tests', 'type', String(testType).toLowerCase());
  if (!row) throw new Error('Test tidak ditemukan');
  return updateRow('tests', row._rowIndex, { is_open: isOpen });
}
