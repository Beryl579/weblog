/**
 * DbService.gs — CRUD helper untuk Google Sheets
 * Spreadsheet: DB_Weblog_DDK_SMK_TR2 (14 sheet)
 * Sesuai PLAN.md:540-551 & PDF p32-33 populasi/sampel
 * Semua fungsi wrap try-catch, return {success, data/msg}
 */

// Nama spreadsheet wajib sama dengan PLAN.md:96
var SPREADSHEET_NAME = 'DB_Weblog_DDK_SMK_TR2';
var SPREADSHEET_ID_KEY = 'SPREADSHEET_ID'; // simpan di PropertiesService jika sudah dibuat

/**
 * Ambil Spreadsheet aktif atau by ID (jika di-Properties)
 */
function getSpreadsheet() {
  try {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty(SPREADSHEET_ID_KEY);
    if (id) {
      return SpreadsheetApp.openById(id);
    }
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    throw new Error('Spreadsheet tidak ditemukan. Jalankan setupDatabase() dulu. ' + e.message);
  }
}

/**
 * getSheet(name) — PLAN.md:542
 */
function getSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" tidak ditemukan');
  return sheet;
}

/**
 * getAllRows(sheetName) — PLAN.md:543
 * Return array of objects {header: value}, header = row 1
 */
function getAllRows(sheetName) {
  try {
    var sheet = getSheet(sheetName);
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) return []; // hanya header
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var rows = [];
    for (var i = 0; i < values.length; i++) {
      // skip baris kosong total
      var isEmpty = true;
      for (var c = 0; c < values[i].length; c++) {
        if (values[i][c] !== '' && values[i][c] !== null) { isEmpty = false; break; }
      }
      if (isEmpty) continue;
      var obj = { _rowIndex: i + 2 }; // 1-indexed sheet row
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = values[i][j];
      }
      rows.push(obj);
    }
    return rows;
  } catch (e) {
    throw new Error('getAllRows(' + sheetName + ') gagal: ' + e.message);
  }
}

/**
 * findRow(sheetName, column, value) — PLAN.md:544
 * Cari 1 baris dimana column == value (exact, string compare)
 */
function findRow(sheetName, column, value) {
  var rows = getAllRows(sheetName);
  var target = String(value).trim();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][column]).trim() === target) return rows[i];
  }
  return null;
}

/**
 * findRows(sheetName, column, value) — PLAN.md:545
 */
function findRows(sheetName, column, value) {
  var rows = getAllRows(sheetName);
  var target = String(value).trim();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][column]).trim() === target) out.push(rows[i]);
  }
  return out;
}

/**
 * getNextId(sheetName) — PLAN.md:549
 * Auto-increment max(id)+1
 */
function getNextId(sheetName) {
  var rows = getAllRows(sheetName);
  var maxId = 0;
  for (var i = 0; i < rows.length; i++) {
    var id = parseInt(rows[i]['id'], 10);
    if (!isNaN(id) && id > maxId) maxId = id;
  }
  return maxId + 1;
}

/**
 * countRows(sheetName, column, value) — PLAN.md:550
 */
function countRows(sheetName, column, value) {
  return findRows(sheetName, column, value).length;
}

/**
 * insertRow(sheetName, dataObj) — PLAN.md:546
 * dataObj: {header: value}. Header harus persis row1 sheet.
 * Menggunakan LockService untuk race-condition (PLAN.md:843)
 */
function insertRow(sheetName, dataObj) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getSheet(sheetName);
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    // jika dataObj punya id kosong, auto generate
    if (!dataObj['id']) dataObj['id'] = getNextId(sheetName);
    var row = [];
    for (var i = 0; i < headers.length; i++) {
      row.push(dataObj.hasOwnProperty(headers[i]) ? dataObj[headers[i]] : '');
    }
    sheet.appendRow(row);
    // return inserted row dengan _rowIndex
    return { success: true, id: dataObj['id'], rowIndex: sheet.getLastRow() };
  } catch (e) {
    throw new Error('insertRow(' + sheetName + ') gagal: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * updateRow(sheetName, rowIndex, dataObj) — PLAN.md:547
 * rowIndex = nomor baris sheet (2..n), bukan id
 */
function updateRow(sheetName, rowIndex, dataObj) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getSheet(sheetName);
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var current = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
    var newRow = [];
    for (var i = 0; i < headers.length; i++) {
      if (dataObj.hasOwnProperty(headers[i])) {
        newRow.push(dataObj[headers[i]]);
      } else {
        newRow.push(current[i]);
      }
    }
    sheet.getRange(rowIndex, 1, 1, lastCol).setValues([newRow]);
    return { success: true, rowIndex: rowIndex };
  } catch (e) {
    throw new Error('updateRow(' + sheetName + ':' + rowIndex + ') gagal: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * deleteRow(sheetName, rowIndex) — PLAN.md:548
 */
function deleteRow(sheetName, rowIndex) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getSheet(sheetName);
    sheet.deleteRow(rowIndex);
    return { success: true };
  } catch (e) {
    throw new Error('deleteRow(' + sheetName + ':' + rowIndex + ') gagal: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: findRowIndex by id (untuk update/delete by id)
 */
function findRowIndexById(sheetName, id) {
  var row = findRow(sheetName, 'id', id);
  return row ? row._rowIndex : null;
}

/**
 * Helper: upsert — update jika id ada, insert jika tidak
 */
function upsertRow(sheetName, dataObj) {
  if (dataObj.id) {
    var existing = findRow(sheetName, 'id', dataObj.id);
    if (existing) return updateRow(sheetName, existing._rowIndex, dataObj);
  }
  return insertRow(sheetName, dataObj);
}
