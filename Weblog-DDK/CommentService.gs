/**
 * CommentService.gs — Diskusi per materi, nested reply, moderasi
 * PLAN.md:551, PDF p19 manfaat blog interaksi komentar
 */

function getComments(materialId) {
  try {
    var rows = findRows('comments', 'material_id', materialId);
    // hanya yang is_approved TRUE untuk siswa; guru lihat semua via getAllCommentsForGuru
    var approved = [];
    for (var i = 0; i < rows.length; i++) {
      var v = String(rows[i]['is_approved']).toLowerCase();
      if (v === 'true' || rows[i]['is_approved'] === true) approved.push(rows[i]);
    }
    // sort by created_at asc
    approved.sort(function(a, b) { return new Date(a['created_at']) - new Date(b['created_at']); });
    return { success: true, data: buildCommentTree(approved) };
  } catch (e) { return handleError(e); }
}

function getAllCommentsForGuru(materialId) {
  try {
    var rows = materialId ? findRows('comments', 'material_id', materialId) : getAllRows('comments');
    rows.sort(function(a, b) { return new Date(b['created_at']) - new Date(a['created_at']); });
    return { success: true, data: rows };
  } catch (e) { return handleError(e); }
}

/**
 * buildCommentTree — nested reply via parent_id
 */
function buildCommentTree(flat) {
  var map = {};
  var roots = [];
  for (var i = 0; i < flat.length; i++) {
    flat[i].replies = [];
    map[String(flat[i]['id']).trim()] = flat[i];
  }
  for (var j = 0; j < flat.length; j++) {
    var c = flat[j];
    var parent = c['parent_id'];
    if (parent && String(parent).trim() !== '' && map[String(parent).trim()]) {
      map[String(parent).trim()].replies.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots;
}

function addComment(userId, materialId, content, parentId) {
  try {
    if (!userId || !materialId || !content) return { success: false, message: 'userId, materialId, content wajib' };
    var user = findRow('users', 'id', userId);
    if (!user) return { success: false, message: 'User tidak ditemukan' };
    var mat = findRow('materials', 'id', materialId);
    if (!mat) return { success: false, message: 'Materi tidak ditemukan' };

    content = sanitizeInput(content);
    if (content.length < 3) return { success: false, message: 'Komentar minimal 3 karakter' };
    if (content.length > 1000) return { success: false, message: 'Komentar max 1000 karakter' };

    if (parentId) {
      var parent = findRow('comments', 'id', parentId);
      if (!parent) return { success: false, message: 'Parent komentar tidak ditemukan' };
      // parent harus di material yang sama
      if (String(parent['material_id']).trim() !== String(materialId).trim()) {
        return { success: false, message: 'Parent tidak sesuai materi' };
      }
    }

    var newId = getNextId('comments');
    var isApproved = false;
    // jika role guru/admin, auto approved
    if (user['role'] === 'guru' || user['role'] === 'admin') isApproved = true;

    insertRow('comments', {
      id: newId,
      user_id: userId,
      material_id: materialId,
      content: content,
      parent_id: parentId || '',
      is_approved: isApproved,
      created_at: now()
    });

    // log
    try {
      insertRow('activity_logs', {
        id: getNextId('activity_logs'),
        user_id: userId,
        action: 'comment',
        target_id: materialId,
        timestamp: now()
      });
    } catch (e) {}

    return { success: true, message: isApproved ? 'Komentar diposting' : 'Komentar menunggu moderasi guru', id: newId, is_approved: isApproved };
  } catch (e) { return handleError(e); }
}

function approveComment(commentId) {
  try {
    var row = findRow('comments', 'id', commentId);
    if (!row) return { success: false, message: 'Komentar tidak ditemukan' };
    return updateRow('comments', row._rowIndex, { is_approved: true });
  } catch (e) { return handleError(e); }
}

function deleteComment(commentId) {
  try {
    var row = findRow('comments', 'id', commentId);
    if (!row) return { success: false, message: 'Komentar tidak ditemukan' };
    return deleteRow('comments', row._rowIndex);
  } catch (e) { return handleError(e); }
}
