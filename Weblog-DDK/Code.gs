/**
 * Code.gs — Router utama doGet/doPost
 * Halaman: login (public), dashboard (siswa), guru (dashboard guru).
 * SPA menangani navigasi internal via hash (#/...).
 */

function doGet(e) {
  try {
    var page = (e && e.parameter && e.parameter.page) ? String(e.parameter.page).toLowerCase().trim() : 'login';

    var validPages = ['login', 'dashboard', 'guru'];
    if (validPages.indexOf(page) === -1) page = 'login';

    var fileMap = {
      'login': 'Views/Login',
      'dashboard': 'Views/DashboardSiswa',
      'guru': 'Views/DashboardGuru'
    };

    var template = HtmlService.createTemplateFromFile(fileMap[page]);
    return template.evaluate()
      .setTitle('Weblog DDK')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');

  } catch (err) {
    Logger.log('doGet error: ' + err.message);
    return HtmlService.createHtmlOutput('<h3>Error: ' + err.message + '</h3><a href="?page=login">Ke Login</a>');
  }
}

function doPost(e) {
  try {
    return doGet(e);
  } catch (err) {
    return HtmlService.createHtmlOutput('doPost error: ' + err.message);
  }
}

/**
 * include(filename) — untuk <?!= include('Styles/Main') ?> dll
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e1) {
    try {
      return HtmlService.createHtmlOutputFromFile('Components/' + filename).getContent();
    } catch (e2) {
      try {
        return HtmlService.createHtmlOutputFromFile('Styles/' + filename).getContent();
      } catch (e3) {
        Logger.log('include failed for ' + filename + ': ' + e3.message);
        return '<!-- include ' + filename + ' not found -->';
      }
    }
  }
}

/* ============ Client API wrappers (dipanggil via google.script.run) ============ */

// Auth
function clientGetCurrentUser(data) { return getCurrentUser(data ? data.nis : null) ? { success: true, user: getCurrentUser(data.nis) } : { success: false }; }
function clientRegister(data) { return register(data.nis, data.nama, data.kelas, data.password, data.confirmPassword); }
function clientLogin(data) { return login(data.nis, data.password); }
function clientLogout(data) { return logout(data ? data.nis : null); }

// Progres siswa & rekap guru
function clientGetStudentProgress(data) { return getStudentProgress(data); }
function clientSubmitMateriQuiz(data) { return submitMateriQuiz(data); }
function clientGetGuruOverview(data) { return getGuruOverview(data); }
