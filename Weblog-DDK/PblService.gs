/**
 * PblService.gs — PBL 5 Fase Arends 2008
 * PLAN.md:551 + PDF p22-23 Tabel2 + p24-28
 */

function getPblPhases() {
  try {
    var rows = getAllRows('pbl_phases');
    rows.sort(function(a, b) { return Number(a['phase_num']) - Number(b['phase_num']); });
    return { success: true, data: rows };
  } catch (e) { return handleError(e); }
}

function getPblPhaseById(id) {
  try {
    var row = findRow('pbl_phases', 'id', id);
    if (!row) return { success: false, message: 'Fase PBL tidak ditemukan' };
    return { success: true, data: row };
  } catch (e) { return handleError(e); }
}

function getPblPhaseByNum(phaseNum) {
  try {
    var row = findRow('pbl_phases', 'phase_num', phaseNum);
    if (!row) return { success: false, message: 'Fase ' + phaseNum + ' tidak ditemukan' };
    return { success: true, data: row };
  } catch (e) { return handleError(e); }
}

/**
 * submitTask — upload tugas per fase PBL ke Google Drive
 * PLAN.md:421-448, validasi PDF/DOC/JPG/PNG max 5MB
 * fileBlob: {bytes (base64), filename, mimeType}
 */
function submitTask(userId, pblPhaseId, fileBlob) {
  try {
    if (!userId || !pblPhaseId) return { success: false, message: 'userId & pblPhaseId wajib' };
    var phase = findRow('pbl_phases', 'id', pblPhaseId);
    if (!phase) return { success: false, message: 'Fase PBL tidak ditemukan' };

    if (!fileBlob || !fileBlob.bytes) return { success: false, message: 'File wajib diupload' };

    // validasi mime & size
    var allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg'];
    var mime = String(fileBlob.mimeType || '').toLowerCase();
    // allow pdf, doc, docx, jpg, png
    var isAllowed = false;
    for (var i = 0; i < allowed.length; i++) {
      if (mime.indexOf(allowed[i]) !== -1 || mime === allowed[i]) { isAllowed = true; break; }
    }
    // fallback check extension
    var filename = String(fileBlob.filename || 'tugas');
    var ext = filename.split('.').pop().toLowerCase();
    if (['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'].indexOf(ext) === -1) {
      return { success: false, message: 'Format file harus PDF/DOC/JPG/PNG' };
    }

    // decode base64
    var bytes = Utilities.base64Decode(fileBlob.bytes);
    if (bytes.length > 5 * 1024 * 1024) {
      return { success: false, message: 'File max 5MB' };
    }

    // Buat file di Drive — folder khusus Weblog DDK
    var folderName = 'Weblog_DDK_Tugas';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    var blob = Utilities.newBlob(bytes, mime || 'application/octet-stream', filename);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileUrl = file.getUrl();

    // Simpan ke task_submissions
    var newId = getNextId('task_submissions');
    insertRow('task_submissions', {
      id: newId,
      user_id: userId,
      pbl_phase_id: pblPhaseId,
      file_url: fileUrl,
      score: '',
      feedback: '',
      submitted_at: now()
    });

    // log
    try {
      insertRow('activity_logs', {
        id: getNextId('activity_logs'),
        user_id: userId,
        action: 'submit_tugas',
        target_id: pblPhaseId,
        timestamp: now()
      });
    } catch (e) {}

    return { success: true, message: 'Tugas berhasil diupload', file_url: fileUrl, id: newId };
  } catch (e) {
    return handleError(e);
  }
}

function getSubmissionsByUser(userId) {
  try {
    var rows = findRows('task_submissions', 'user_id', userId);
    return { success: true, data: rows };
  } catch (e) { return handleError(e); }
}

function getSubmissionsByPhase(pblPhaseId) {
  try {
    var rows = findRows('task_submissions', 'pbl_phase_id', pblPhaseId);
    return { success: true, data: rows };
  } catch (e) { return handleError(e); }
}

/**
 * Guru nilai tugas
 */
function gradeTask(submissionId, score, feedback) {
  try {
    var row = findRow('task_submissions', 'id', submissionId);
    if (!row) return { success: false, message: 'Submission tidak ditemukan' };
    return updateRow('task_submissions', row._rowIndex, { score: score, feedback: feedback });
  } catch (e) { return handleError(e); }
}
