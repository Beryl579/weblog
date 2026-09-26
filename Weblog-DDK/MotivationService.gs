/**
 * MotivationService.gs — Angket motivasi 16 item
 * PLAN.md:582-598, PDF p41-42 (4 indikator ×4 deskriptor, Likert 1-4, Nilai=(Diperoleh/Total)*100)
 * Gate: hanya setelah posttest selesai — PLAN.md:430, PDF p41 langkah7
 */

/**
 * getMotivationQuestions() — ambil 16 item dari motivation_indicators
 * Return grouping per indicator_name
 */
function getMotivationQuestions() {
  try {
    var rows = getAllRows('motivation_indicators');
    rows.sort(function(a, b) { return Number(a['order_num']) - Number(b['order_num']); });
    // group
    var grouped = {};
    var flat = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var ind = r['indicator_name'] || 'Indikator';
      if (!grouped[ind]) grouped[ind] = [];
      var item = {
        id: r['id'],
        indicator_name: ind,
        descriptor_num: r['descriptor_num'],
        statement_text: r['statement_text'],
        order_num: r['order_num']
      };
      grouped[ind].push(item);
      flat.push(item);
    }
    return { success: true, total: flat.length, grouped: grouped, flat: flat };
  } catch (e) {
    return handleError(e);
  }
}

/**
 * hasSubmittedMotivation(userId) — cek sudah pernah submit?
 */
function hasSubmittedMotivation(userId) {
  var rows = findRows('motivation_responses', 'user_id', userId);
  return rows.length > 0;
}

/**
 * submitMotivation(userId, responses)
 * responses: {indicator_id: 1-4} atau array [{indicator_id, response_value}]
 * Validasi 16 terisi, gate posttest, 1× submit
 */
function submitMotivation(userId, responses) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    if (!userId) return { success: false, message: 'userId wajib' };
    var user = findRow('users', 'id', userId);
    if (!user) return { success: false, message: 'User tidak ditemukan' };

    // Gate: hanya setelah posttest selesai — PLAN.md:430
    if (!hasCompletedTest(userId, 'posttest')) {
      return { success: false, message: 'Angket hanya bisa diisi setelah posttest selesai' };
    }

    // Cek sudah pernah submit — PLAN.md:591
    if (hasSubmittedMotivation(userId)) {
      return { success: false, message: 'Anda sudah mengisi angket sebelumnya (1×).' };
    }

    // Normalisasi responses ke array
    var arr = [];
    if (Array.isArray(responses)) {
      arr = responses;
    } else if (typeof responses === 'object') {
      // { "1": 4, "2":3 ... } dimana key = indicator_id
      for (var k in responses) {
        if (responses.hasOwnProperty(k)) {
          arr.push({ indicator_id: k, response_value: responses[k] });
        }
      }
    } else {
      return { success: false, message: 'Format responses tidak valid' };
    }

    // Validasi 16 item terisi — PLAN.md:589
    var expected = getAllRows('motivation_indicators');
    var expectedCount = expected.length; // 16
    if (arr.length !== expectedCount) {
      return { success: false, message: 'Angket harus 16 item, terisi ' + arr.length + '/' + expectedCount };
    }

    // Validasi setiap response_value 1-4 — PDF p41 Likert
    var validIds = {};
    for (var e = 0; e < expected.length; e++) validIds[String(expected[e]['id']).trim()] = true;

    for (var i = 0; i < arr.length; i++) {
      var r = arr[i];
      var indId = String(r.indicator_id).trim();
      var val = parseInt(r.response_value, 10);
      if (!validIds[indId]) {
        return { success: false, message: 'indicator_id ' + indId + ' tidak valid' };
      }
      if (isNaN(val) || val < 1 || val > 4) {
        return { success: false, message: 'Nilai untuk indikator ' + indId + ' harus 1-4' };
      }
    }

    // Simpan ke motivation_responses — PLAN.md:592
    for (var j = 0; j < arr.length; j++) {
      var item = arr[j];
      insertRow('motivation_responses', {
        id: getNextId('motivation_responses'),
        user_id: userId,
        indicator_id: String(item.indicator_id).trim(),
        response_value: parseInt(item.response_value, 10),
        submitted_at: now()
      });
    }

    // Log
    try {
      insertRow('activity_logs', {
        id: getNextId('activity_logs'),
        user_id: userId,
        action: 'submit_angket',
        target_id: userId,
        timestamp: now()
      });
    } catch (e) { Logger.log('log angket fail: ' + e.message); }

    // Hitung hasil untuk feedback
    var result = getMotivationResult(userId);
    return { success: true, message: 'Angket berhasil disimpan', result: result.data || result };

  } catch (e) {
    return handleError(e);
  } finally {
    lock.releaseLock();
  }
}

/**
 * getMotivationResult(userId) — PLAN.md:594-597, PDF p41-42
 * Hitung skor per indikator (sum 4 deskriptor) & total, Nilai=(Diperoleh/64)*100
 * Kategori a-d: PDF p41-42
 */
function getMotivationResult(userId) {
  try {
    if (!userId) return { success: false, message: 'userId wajib' };
    var responses = findRows('motivation_responses', 'user_id', userId);
    if (responses.length === 0) {
      return { success: false, message: 'Belum mengisi angket', completed: false };
    }

    // mapping indicator_id -> value, plus grouping by indicator_name
    var indicators = getAllRows('motivation_indicators');
    var indMap = {}; // id -> {indicator_name, descriptor_num}
    for (var i = 0; i < indicators.length; i++) {
      indMap[String(indicators[i]['id']).trim()] = indicators[i];
    }

    var perIndicator = {}; // indicator_name -> {score, count}
    var totalScore = 0;
    for (var j = 0; j < responses.length; j++) {
      var resp = responses[j];
      var indId = String(resp['indicator_id']).trim();
      var val = parseInt(resp['response_value'], 10);
      totalScore += val;
      var meta = indMap[indId];
      var name = meta ? String(meta['indicator_name']).trim() : 'Indikator ' + indId;
      if (!perIndicator[name]) perIndicator[name] = { score: 0, count: 0, items: [] };
      perIndicator[name].score += val;
      perIndicator[name].count += 1;
      perIndicator[name].items.push({ indicator_id: indId, descriptor_num: meta ? meta['descriptor_num'] : '', response_value: val });
    }

    // PDF: Skor total max = 16 item *4 =64, Nilai = (Diperoleh/Total)*100
    var maxScore = 64;
    var nilai = calcNilai(totalScore, maxScore); // PDF p41

    // Kategori per PDF p41-42 (a-d)
    // a muncul batas rendah, b cukup, c baik, d sangat baik
    // Interpretasi: total 16-28 rendah, 29-40 cukup, 41-52 baik, 53-64 sangat baik (asumsi interval 16/4)
    // Atau per indikator 4-7 rendah etc. Kita pakai total.
    var kategori = 'Belum diketahui';
    if (totalScore <= 28) kategori = 'Rendah (a)';
    else if (totalScore <= 40) kategori = 'Cukup (b)';
    else if (totalScore <= 52) kategori = 'Baik (c)';
    else kategori = 'Sangat Baik (d)';

    // Per indikator skor max 16 (4*4)
    var perIndArray = [];
    for (var k in perIndicator) {
      if (perIndicator.hasOwnProperty(k)) {
        var s = perIndicator[k].score;
        var kat = s <= 7 ? 'Rendah' : s <= 10 ? 'Cukup' : s <= 13 ? 'Baik' : 'Sangat Baik';
        perIndArray.push({ indicator_name: k, score: s, max: 16, nilai: calcNilai(s, 16), kategori: kat, count: perIndicator[k].count });
      }
    }

    return {
      success: true,
      completed: true,
      data: {
        total_score: totalScore,
        max_score: maxScore,
        nilai: Number(nilai.toFixed(2)),
        kategori: kategori,
        per_indikator: perIndArray,
        responses_count: responses.length
      }
    };
  } catch (e) {
    return handleError(e);
  }
}

/**
 * isMotivationOpen — cek apakah angket dibuka guru? (opsional, PLAN tidak sebut tapi simetri dengan tests)
 * Kita pakai tests type=angket jika ada, atau selalu open setelah posttest
 */
function isMotivationOpen() {
  // jika ada sheet tests dengan type angket, cek is_open
  var row = findRow('tests', 'type', 'angket');
  if (row) {
    var v = String(row['is_open']).toLowerCase();
    return v === 'true' || row['is_open'] === true;
  }
  return true; // default open
}
