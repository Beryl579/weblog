/**
 * GuruService.gs — Dashboard guru + ekspor SPSS
 * PLAN.md:600-638, PDF p42-45 analisis (normalitas, homogenitas, t-test, korelasi)
 * Ekspor 3 CSV ID anonim S001 untuk jaga privasi — PLAN.md:483
 */

function getRecap() {
  try {
    var users = getAllRows('users');
    var students = [];
    for (var i = 0; i < users.length; i++) {
      if (String(users[i]['role']).toLowerCase() === 'siswa') students.push(users[i]);
    }
    // sort by kelas, nama
    students.sort(function(a, b) {
      var ka = String(a['kelas']).localeCompare(String(b['kelas']));
      if (ka !== 0) return ka;
      return String(a['nama']).localeCompare(String(b['nama']));
    });

    var recap = [];
    for (var s = 0; s < students.length; s++) {
      var stu = students[s];
      var uid = stu['id'];
      // pretest
      var pre = getTestResult(uid, 'pretest');
      var post = getTestResult(uid, 'posttest');
      var mot = getMotivationResult(uid);

      var preScore = pre.success ? pre.attempt.raw_score : '-';
      var preValue = pre.success ? pre.attempt.final_value : '-';
      var postScore = post.success ? post.attempt.raw_score : '-';
      var postValue = post.success ? post.attempt.final_value : '-';
      var motScore = mot.success ? mot.data.total_score : '-';
      var motNilai = mot.success ? mot.data.nilai : '-';

      var n_gain = '-';
      if (pre.success && post.success) {
        n_gain = Number(nGain(postValue, preValue).toFixed(2));
      }

      recap.push({
        id: uid,
        nis: stu['nis'],
        anon_id: anonId(s), // S001
        nama: stu['nama'],
        kelas: stu['kelas'],
        is_eksperimen: stu['is_eksperimen'],
        pretest_status: pre.success ? 'Selesai' : 'Belum',
        pretest_score: preScore,
        pretest_value: preValue,
        posttest_status: post.success ? 'Selesai' : 'Belum',
        posttest_score: postScore,
        posttest_value: postValue,
        n_gain: n_gain,
        angket_status: mot.success ? 'Selesai' : 'Belum',
        motivasi_total: motScore,
        motivasi_nilai: motNilai,
        motivasi_kategori: mot.success ? mot.data.kategori : '-'
      });
    }

    // ringkasan
    var total = recap.length;
    var preDone = recap.filter(function(r){ return r.pretest_status==='Selesai'; }).length;
    var postDone = recap.filter(function(r){ return r.posttest_status==='Selesai'; }).length;
    var angDone = recap.filter(function(r){ return r.angket_status==='Selesai'; }).length;
    var avgPre = 0, avgPost=0, avgMot=0;
    var cntPre=0,cntPost=0,cntMot=0;
    for (var k=0;k<recap.length;k++){
      if (recap[k].pretest_value!=='-'){ avgPre+=Number(recap[k].pretest_value); cntPre++; }
      if (recap[k].posttest_value!=='-'){ avgPost+=Number(recap[k].posttest_value); cntPost++; }
      if (recap[k].motivasi_nilai!=='-'){ avgMot+=Number(recap[k].motivasi_nilai); cntMot++; }
    }
    if(cntPre) avgPre/=cntPre;
    if(cntPost) avgPost/=cntPost;
    if(cntMot) avgMot/=cntMot;

    return {
      success: true,
      summary: {
        total_siswa: total,
        pretest_selesai: preDone,
        pretest_pct: total? ((preDone/total)*100).toFixed(1):0,
        posttest_selesai: postDone,
        posttest_pct: total? ((postDone/total)*100).toFixed(1):0,
        angket_selesai: angDone,
        angket_pct: total? ((angDone/total)*100).toFixed(1):0,
        rata_pretest: Number(avgPre.toFixed(2)),
        rata_posttest: Number(avgPost.toFixed(2)),
        rata_motivasi: Number(avgMot.toFixed(2))
      },
      data: recap
    };
  } catch (e) { return handleError(e); }
}

function toggleTest(testType, isOpen) {
  try {
    testType = String(testType).toLowerCase();
    if (['pretest','posttest','angket'].indexOf(testType)===-1) {
      return { success:false, message:'testType harus pretest/posttest/angket' };
    }
    // angket tidak ada di tests? kita buat jika belum
    var typeForSheet = testType === 'angket' ? 'angket' : testType;
    var row = findRow('tests', 'type', typeForSheet);
    if (!row) {
      // create
      var nid = getNextId('tests');
      insertRow('tests', { id: nid, type: typeForSheet, total_questions: typeForSheet==='angket'?16:20, duration_min: '', is_open: isOpen, created_at: now() });
      return { success:true, message: typeForSheet + ' dibuat & ' + (isOpen?'dibuka':'ditutup') };
    }
    updateRow('tests', row._rowIndex, { is_open: isOpen });
    return { success:true, message: testType + ' ' + (isOpen?'dibuka':'ditutup') };
  } catch (e) { return handleError(e); }
}

function manageAccessCode(action, kelas, code) {
  try {
    action = String(action).toLowerCase();
    if (action==='create' || action==='add') {
      if (!kelas || !code) return {success:false, message:'kelas & code wajib'};
      if (findRow('class_config','access_code',code)) return {success:false, message:'Kode sudah ada'};
      if (findRow('class_config','kelas',kelas)) return {success:false, message:'Kelas sudah ada, gunakan update'};
      insertRow('class_config', { id:getNextId('class_config'), kelas:kelas, access_code:code, is_eksperimen:true, max_students:30 });
      return {success:true, message:'Kode akses dibuat'};
    } else if (action==='update') {
      var r = findRow('class_config','kelas',kelas);
      if (!r) return {success:false, message:'Kelas tidak ditemukan'};
      return updateRow('class_config', r._rowIndex, { access_code: code });
    } else if (action==='delete') {
      var del = findRow('class_config','kelas',kelas);
      if (!del) return {success:false, message:'Kelas tidak ditemukan'};
      deleteRow('class_config', del._rowIndex);
      return {success:true, message:'Kelas dihapus'};
    } else if (action==='list') {
      return {success:true, data:getAllRows('class_config')};
    }
    return {success:false, message:'action harus create/update/delete/list'};
  } catch (e){ return handleError(e); }
}

function getRegisteredStudents() {
  try {
    var rows = getAllRows('users');
    var siswa = rows.filter(function(r){ return String(r['role']).toLowerCase()==='siswa'; });
    return { success:true, data:siswa };
  } catch(e){ return handleError(e); }
}

/**
 * Export 1: hasil_belajar.csv — PLAN.md:466, PDF p43-44 uji-t
 * id_siswa,kelas,pretest_score,pretest_value,posttest_score,posttest_value,n_gain
 * ID anonim S001
 */
function exportHasilBelajar() {
  try {
    var recapRes = getRecap();
    if (!recapRes.success) return recapRes;
    var data = recapRes.data;
    var header = 'id_siswa,kelas,pretest_score,pretest_value,posttest_score,posttest_value,n_gain';
    var lines = [header];
    for (var i=0;i<data.length;i++){
      var r=data[i];
      var isEks = (String(r.is_eksperimen).toLowerCase()==='true' || r.is_eksperimen===true) ? 'eksperimen':'kontrol';
      // tapi kelas sudah ada, kita pakai kelas asli + anonim
      lines.push([
        r.anon_id,
        r.kelas,
        r.pretest_score==='-'? '' : r.pretest_score,
        r.pretest_value==='-'? '' : r.pretest_value,
        r.posttest_score==='-'? '' : r.posttest_score,
        r.posttest_value==='-'? '' : r.posttest_value,
        r.n_gain==='-'? '' : r.n_gain
      ].join(','));
    }
    var csv = lines.join('\n');
    return { success:true, csv:csv, filename:'hasil_belajar.csv', rows:data.length };
  } catch(e){ return handleError(e); }
}

/**
 * Export 2: butir_soal.csv — PLAN.md:472, PDF p35-40
 * id_siswa,jenis_test,no_soal,kunci,jawaban_siswa,skor,level_kognitif
 */
function exportButirSoal() {
  try {
    var users = getAllRows('users').filter(function(r){ return String(r['role']).toLowerCase()==='siswa'; });
    users.sort(function(a,b){ return Number(a['id'])-Number(b['id']); });
    var header = 'id_siswa,jenis_test,no_soal,kunci,jawaban_siswa,skor,level_kognitif';
    var lines=[header];
    for (var u=0; u<users.length; u++){
      var user=users[u];
      var anon = anonId(u);
      // untuk setiap test
      var types=['pretest','posttest'];
      for (var t=0; t<types.length; t++){
        var testType=types[t];
        var testRow=findRow('tests','type',testType);
        if(!testRow) continue;
        var attemptRows=findRows('test_attempts','user_id',user['id']);
        var attempt=null;
        for(var a=0;a<attemptRows.length;a++) if(String(attemptRows[a]['test_id']).trim()===String(testRow['id']).trim()) attempt=attemptRows[a];
        if(!attempt) continue;
        var answers=findRows('test_answers','attempt_id',attempt['id']);
        // butuh kunci & level dari questions
        for(var q=0;q<answers.length;q++){
          var ans=answers[q];
          var qRow=findRow('questions','id',ans['question_id']);
          if(!qRow) continue;
          lines.push([
            anon,
            testType,
            qRow['order_num'],
            qRow['correct_answer'],
            ans['selected_answer'],
            ans['score'],
            qRow['cognitive_level']
          ].join(','));
        }
      }
    }
    var csv=lines.join('\n');
    return {success:true, csv:csv, filename:'butir_soal.csv', rows:lines.length-1};
  } catch(e){ return handleError(e); }
}

/**
 * Export 3: motivasi.csv — PLAN.md:478, PDF p44-45
 * id_siswa,kelas,skor_ind1,skor_ind2,skor_ind3,skor_ind4,total_motivasi
 * ind1-4 berdasarkan urutan indicator_name di motivation_indicators
 */
function exportMotivasi() {
  try {
    var indicators=getAllRows('motivation_indicators');
    indicators.sort(function(a,b){ return Number(a['order_num'])-Number(b['order_num']); });
    // grouping ke 4 indikator (berdasarkan indicator_name unik, ambil 4 pertama)
    var indNames=[];
    var seen={};
    for(var i=0;i<indicators.length;i++){
      var n=String(indicators[i]['indicator_name']).trim();
      if(!seen[n]){ seen[n]=true; indNames.push(n); }
      if(indNames.length===4) break;
    }
    // mapping indicator_name -> index 1-4
    var nameToIdx={};
    for(var k=0;k<indNames.length;k++) nameToIdx[indNames[k]]=k+1;

    var users=getAllRows('users').filter(function(r){ return String(r['role']).toLowerCase()==='siswa'; });
    users.sort(function(a,b){ return Number(a['id'])-Number(b['id']); });
    var header='id_siswa,kelas,skor_ind1,skor_ind2,skor_ind3,skor_ind4,total_motivasi';
    var lines=[header];
    for(var u=0;u<users.length;u++){
      var user=users[u];
      var anon=anonId(u);
      var resps=findRows('motivation_responses','user_id',user['id']);
      if(resps.length===0) continue;
      var skor=[0,0,0,0];
      var total=0;
      for(var r=0;r<resps.length;r++){
        var resp=resps[r];
        var indId=String(resp['indicator_id']).trim();
        var qRow=findRow('motivation_indicators','id',indId);
        if(!qRow) continue;
        var name=String(qRow['indicator_name']).trim();
        var idx=nameToIdx[name];
        if(idx){
          skor[idx-1]+=parseInt(resp['response_value'],10);
        }
        total+=parseInt(resp['response_value'],10);
      }
      lines.push([anon, user['kelas'], skor[0], skor[1], skor[2], skor[3], total].join(','));
    }
    var csv=lines.join('\n');
    return {success:true, csv:csv, filename:'motivasi.csv', rows:lines.length-1};
  } catch(e){ return handleError(e); }
}

function approveCommentGuru(commentId){ return approveComment(commentId); }
function deleteCommentGuru(commentId){ return deleteComment(commentId); }
