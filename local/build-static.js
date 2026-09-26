/**
 * build-static.js — menghasilkan versi statis yang bisa dilayani GitHub Pages.
 *
 *   node local/build-static.js
 *
 * Yang dilakukan:
 *   1. Menyalin logika lokal/progress_api.js ke dalam ddk-demo.js, sehingga
 *      aturan gating kuis tetap satu sumber dengan server lokal & Apps Script.
 *   2. Mengambil tiap View dari Weblog-DDK/Views/, menyelesaikan
 *      <?!= include(...) ?> (Styles/Main, Components/Toast) sehingga berkas
 *      hasilnya benar-benar mandiri (tanpa templating GAS).
 *   3. Mengarahkan ulang navigasi ?page=... menjadi folder statis
 *      (index.html, dashboard/, guru/) karena Pages tidak punya router.
 *   4. Menyisipkan ddk-demo.js sebagai backend tiruan.
 *
 * Hasil ditulis ke root repo supaya setelan Pages "main / (root)" langsung jalan:
 *   index.html          <-- halaman login (entri)
 *   dashboard/index.html
 *   guru/index.html
 *   ddk-demo.js
 *
 * CATATAN: berkas hasil build JANGAN diedit manual — ubah sumber di
 * Weblog-DDK/Views/ lalu jalankan skrip ini lagi.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const GAS_ROOT = path.join(REPO_ROOT, 'Weblog-DDK');
const DEMO_JS = 'ddk-demo.js';

/* ---------- 1. ddk-demo.js ---------- */

const progressApiSource = fs.readFileSync(path.join(__dirname, 'progress_api.js'), 'utf8');
const backendSource = fs.readFileSync(path.join(__dirname, 'static_backend.js'), 'utf8');

// progress_api.js adalah modul Node (module.exports) — bungkus dengan shim
// modul kecil agar bisa jalan apa adanya di browser.
const wrapped = [
  '(function () {',
  "  var module = { exports: {} }, exports = module.exports;",
  progressApiSource,
  '  window.__ddkProgress = module.exports;',
  '})();'
].join('\n');

const demoJs = backendSource.replace('/* __PROGRESS_API__ */', () => wrapped);
if (demoJs === backendSource) {
  throw new Error('Penanda __PROGRESS_API__ tidak ditemukan di static_backend.js');
}
fs.writeFileSync(path.join(REPO_ROOT, DEMO_JS), demoJs, 'utf8');
console.log('  ✓ ' + DEMO_JS);

/* ---------- 2. resolver include (mengikuti perilaku server.js & Code.gs) ---------- */

function resolveInclude(name) {
  const tries = [];
  if (!name.includes('.')) {
    tries.push(name + '.html', name + '.css');
    const base = name.split('/').pop();
    tries.push('Styles/' + base + '.html', 'Styles/' + base + '.css');
    tries.push('Components/' + base + '.html');
  }
  tries.push(name);
  tries.push('Styles/' + path.basename(name));
  tries.push('Components/' + path.basename(name));

  for (const rel of tries) {
    const full = path.join(GAS_ROOT, rel);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return fs.readFileSync(full, 'utf8');
    }
  }
  // Meniru include() di Code.gs yang mengembalikan komentar saat gagal.
  console.warn('  ! include tidak ditemukan: ' + name);
  return '/* include ' + name + ' tidak ditemukan saat build */';
}

function renderView(viewFile) {
  let html = fs.readFileSync(path.join(GAS_ROOT, 'Views', viewFile), 'utf8');

  // <?!= include('X') ?>
  html = html.replace(/<\?!= *include\((['"])([^'"]+)\1\) *\?>/g, (m, q, name) => resolveInclude(name));

  // Sisa ekspresi GAS apa pun (tidak dipakai ketiga view, tapi jaga-jaga).
  html = html.replace(/<\?[!=]?[\s\S]*?\?>/g, '');
  html = html.replace(/<\?-[\s\S]*?-\?>/g, '');

  return html;
}

/* ---------- 3. navigasi ?page=... -> folder statis ---------- */

function staticTargets(base) {
  // base = '' untuk index.html, '../' untuk berkas di dalam subfolder
  return {
    login: base === '' ? './' : '../',
    dashboard: base + 'dashboard/',
    guru: base + 'guru/'
  };
}

function rewriteNavigation(html, base) {
  const t = staticTargets(base);
  return html
    .replace(/\?page=login\b/g, t.login)
    .replace(/\?page=dashboard\b/g, t.dashboard)
    .replace(/\?page=guru\b/g, t.guru);
}

/* ---------- 4. sisipkan backend tiruan ke <head> ---------- */

function injectDemoBackend(html, scriptSrc, label) {
  const tag = '<script src="' + scriptSrc + '"></script>';
  if (!html.includes('</head>')) throw new Error('Tidak ada </head> di ' + label);
  return html.replace('</head>',
    '<!-- Berkas hasil build dari local/build-static.js — jangan diedit manual. ' +
    'Sumber: Weblog-DDK/Views/ -->\n' + tag + '\n</head>');
}

/* ---------- 5. tulis keluaran ---------- */

const PAGES = [
  { view: 'Login.html',         out: 'index.html',              base: '',     script: DEMO_JS },
  { view: 'DashboardSiswa.html', out: 'dashboard/index.html',   base: '../',  script: '../' + DEMO_JS },
  { view: 'DashboardGuru.html',  out: 'guru/index.html',        base: '../',  script: '../' + DEMO_JS }
];

console.log('Membangun versi statis GitHub Pages...');

for (const page of PAGES) {
  let html = renderView(page.view);
  html = rewriteNavigation(html, page.base);
  html = injectDemoBackend(html, page.script, page.view);

  const outPath = path.join(REPO_ROOT, page.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
  console.log('  ✓ ' + page.out + '  (' + page.view + ')');
}

// Jekyll melewati folder yang diawali garis bawah; ini pengaman kalau nanti
// ada berkas bernama seperti itu.
fs.writeFileSync(path.join(REPO_ROOT, '.nojekyll'), '', 'utf8');
console.log('  ✓ .nojekyll');

console.log('\nSelesai. Aktifkan GitHub Pages: Settings → Pages → Source: Deploy from a branch → main → / (root).');
