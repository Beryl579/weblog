/**
 * Utils.gs — Helper umum
 * PLAN.md:255, PDF p35 & p41 rumus Nilai, anonim S001
 */

var PASSWORD_SALT = 'DDK2025_UNIMED_SALT'; // simpan di PropertiesService untuk produksi
var SESSION_EXPIRY_SEC = 7200; // 2 jam — PLAN.md:322, AC7

/**
 * generateId — alias getNextId
 */
function generateId(sheetName) {
  return getNextId(sheetName);
}

/**
 * hashPassword(password) — PLAN.md:535-537, PDF p35 tidak plain text
 * Gunakan Utilities.computeDigest SHA-256 + SALT
 */
function hashPassword(password) {
  if (!password) throw new Error('Password kosong');
  var salted = password + PASSWORD_SALT;
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salted);
  // convert byte array to hex
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    var h = (digest[i] & 0xFF).toString(16);
    if (h.length === 1) h = '0' + h;
    hex += h;
  }
  return hex;
}

/**
 * verifyPassword(plain, hash) — helper login
 */
function verifyPassword(plain, hash) {
  return hashPassword(plain) === hash;
}

/**
 * now() — ISO timestamp untuk sheet
 */
function now() {
  return new Date();
}

/**
 * formatValue — helper display nilai 65.00
 */
function formatValue(num) {
  return Number(num).toFixed(2);
}

/**
 * sanitizeInput — trim & escape < > untuk komentar
 */
function sanitizeInput(str) {
  if (str == null) return '';
  var s = String(str).trim();
  // simple escape
  s = s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return s;
}

/**
 * anonId(index) — PLAN.md:483 S001, S002...
 * index 0-based atau 1-based → S001
 */
function anonId(index) {
  var n = parseInt(index, 10) + 1;
  // pad 3 digit
  if (n < 10) return 'S00' + n;
  if (n < 100) return 'S0' + n;
  return 'S' + n;
}

/**
 * calcNilai(score, total) — PDF p35 & p41
 * Nilai = (Jumlah skor / Jumlah skor total) *100
 */
function calcNilai(score, total) {
  if (!total || total === 0) return 0;
  return (Number(score) / Number(total)) * 100;
}

/**
 * nGain(post, pre) — untuk hasil_belajar.csv
 * n_gain = (post - pre)/(100 - pre) — PLAN.md:468
 */
function nGain(postValue, preValue) {
  var pre = Number(preValue);
  var post = Number(postValue);
  if (100 - pre === 0) return 0;
  return (post - pre) / (100 - pre);
}

/**
 * handleError — standar try-catch return
 */
function handleError(e) {
  var msg = (e && e.message) ? e.message : String(e);
  Logger.log('ERROR: ' + msg);
  return { success: false, message: msg };
}

/**
 * isValidNIS — NIS wajib angka, minimal 4 digit
 */
function isValidNIS(nis) {
  return /^[0-9]{4,20}$/.test(String(nis).trim());
}

/**
 * getSALT — ambil dari PropertiesService jika ada
 */
function getSalt() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('PASSWORD_SALT');
  return s || PASSWORD_SALT;
}
