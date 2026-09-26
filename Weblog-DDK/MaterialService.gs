/**
 * MaterialService.gs — CRUD materi 4 Topik DDK
 * PLAN.md:549 + PDF p24-28 (wording materi)
 */

function getMaterials() {
  try {
    var rows = getAllRows('materials');
    // hanya yang is_active TRUE
    var active = [];
    for (var i = 0; i < rows.length; i++) {
      var v = String(rows[i]['is_active']).toLowerCase();
      if (v === 'true' || rows[i]['is_active'] === true) active.push(rows[i]);
    }
    active.sort(function(a, b) { return Number(a['topik']) - Number(b['topik']); });
    return { success: true, data: active };
  } catch (e) { return handleError(e); }
}

function getMaterialById(id) {
  try {
    var row = findRow('materials', 'id', id);
    if (!row) return { success: false, message: 'Materi tidak ditemukan' };
    return { success: true, data: row };
  } catch (e) { return handleError(e); }
}

function getMaterialByTopik(topik) {
  try {
    var row = findRow('materials', 'topik', topik);
    if (!row) return { success: false, message: 'Topik ' + topik + ' tidak ditemukan' };
    return { success: true, data: row };
  } catch (e) { return handleError(e); }
}

/**
 * markComplete — tandai selesai + log view_materi
 * PDF p41 langkah 6: aktivitas belajar dicatat
 */
function markComplete(userId, materialId) {
  try {
    if (!userId || !materialId) return { success: false, message: 'userId & materialId wajib' };
    var mat = findRow('materials', 'id', materialId);
    if (!mat) return { success: false, message: 'Materi tidak ditemukan' };
    insertRow('activity_logs', {
      id: getNextId('activity_logs'),
      user_id: userId,
      action: 'view_materi',
      target_id: materialId,
      timestamp: now()
    });
    // optional: bisa simpan progress di sheet terpisah, tapi untuk now cukup log
    return { success: true, message: 'Progress materi ' + materialId + ' dicatat' };
  } catch (e) { return handleError(e); }
}

/**
 * CRUD guru — create/update materi
 */
function createMaterial(data) {
  try {
    // data: {topik, judul, konten, file_ppt_url, file_pdf_url, gambar_url}
    if (!data.topik || !data.judul) return { success: false, message: 'topik & judul wajib' };
    var newId = getNextId('materials');
    var row = {
      id: newId,
      topik: data.topik,
      judul: data.judul,
      konten: data.konten || '',
      file_ppt_url: data.file_ppt_url || '',
      file_pdf_url: data.file_pdf_url || '',
      gambar_url: data.gambar_url || '',
      published_at: now(),
      is_active: true
    };
    insertRow('materials', row);
    return { success: true, data: row };
  } catch (e) { return handleError(e); }
}

function updateMaterial(id, data) {
  try {
    var row = findRow('materials', 'id', id);
    if (!row) return { success: false, message: 'Materi tidak ditemukan' };
    return updateRow('materials', row._rowIndex, data);
  } catch (e) { return handleError(e); }
}

function deleteMaterial(id) {
  try {
    var row = findRow('materials', 'id', id);
    if (!row) return { success: false, message: 'Materi tidak ditemukan' };
    return deleteRow('materials', row._rowIndex);
  } catch (e) { return handleError(e); }
}
