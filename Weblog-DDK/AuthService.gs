/**
 * AuthService.gs — Register, Login, Session, Validasi Akses
 * PLAN.md:506-538, PLAN.md:281-331 + PDF p40-41 (9 langkah, kuota 30)
 * Hard Constraints: isolasi perlakuan, NIS unik, hash, rate limit, LockService
 */

/**
 * register(nis, nama, kelas, password, confirmPassword)
 * Registrasi siswa TERBUKA — tanpa kode akses kelas.
 * Siswa memilih kelas (X TITL 1 / X TITL 2) saat mendaftar.
 * Return {success, message, user?}
 */
function register(nis, nama, kelas, password, confirmPassword) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    // 1. Validasi input wajib
    nis = String(nis || '').trim();
    nama = String(nama || '').trim();
    kelas = String(kelas || '').trim();
    password = String(password || '');
    confirmPassword = String(confirmPassword || '');

    if (!nis || !nama || !kelas || !password || !confirmPassword) {
      return { success: false, message: 'Semua field wajib diisi' };
    }
    if (!isValidNIS(nis)) {
      return { success: false, message: 'NIS tidak valid (4-20 digit angka)' };
    }
    if (nama.length < 3) {
      return { success: false, message: 'Nama lengkap minimal 3 karakter' };
    }
    if (password.length < 6) {
      return { success: false, message: 'Password minimal 6 karakter' };
    }
    if (password !== confirmPassword) {
      return { success: false, message: 'Konfirmasi password tidak cocok' };
    }
    if (['X TITL 1', 'X TITL 2'].indexOf(kelas) === -1) {
      return { success: false, message: 'Kelas tidak valid' };
    }

    // 2. Cek NIS sudah terdaftar? — NIS unik 1x register
    var existingUser = findRow('users', 'nis', nis);
    if (existingUser) {
      return { success: false, message: 'NIS sudah terdaftar. Silakan login.' };
    }

    // 3. Batas jumlah siswa per kelas (anti spam)
    var MAX_PER_CLASS = 40;
    var currentCount = countRows('users', 'kelas', kelas);
    if (currentCount >= MAX_PER_CLASS) {
      return { success: false, message: 'Kuota kelas penuh. Hubungi guru.' };
    }

    // 4. Hash password — PLAN.md:303,305
    var passwordHash = hashPassword(password);

    // 5. Simpan ke users
    var newId = getNextId('users');
    var userData = {
      id: newId,
      nis: nis,
      nama: nama,
      kelas: kelas,
      role: 'siswa',
      is_eksperimen: true,
      password_hash: passwordHash,
      registered_at: now(),
      is_active: true
    };
    insertRow('users', userData);

    // 6. Log activity — PLAN.md:305
    try {
      insertRow('activity_logs', {
        id: getNextId('activity_logs'),
        user_id: newId,
        action: 'register',
        target_id: newId,
        timestamp: now()
      });
    } catch (e) { Logger.log('log register fail: ' + e.message); }

    return { success: true, message: 'Registrasi berhasil! Silakan login.', userId: newId, kelas: kelas };

  } catch (e) {
    return handleError(e);
  } finally {
    lock.releaseLock();
  }
}

/**
 * login(nis, password) — PLAN.md:320-329
 * Return {success, message, user, role}
 */
function login(nis, password) {
  try {
    nis = String(nis || '').trim();
    password = String(password || '');

    if (!nis || !password) {
      return { success: false, message: 'NIS dan Password wajib diisi' };
    }

    // 1. Cari NIS
    var user = findRow('users', 'nis', nis);
    if (!user) {
      return { success: false, message: 'NIS tidak terdaftar. Silakan daftar terlebih dahulu.' };
    }

    // cek is_active
    var isActive = String(user['is_active']).toLowerCase();
    if (isActive === 'false' || user['is_active'] === false) {
      return { success: false, message: 'Akun non-aktif. Hubungi guru.' };
    }

    // 2. Cocokkan hash
    var inputHash = hashPassword(password);
    if (inputHash !== String(user['password_hash']).trim()) {
      return { success: false, message: 'Password salah' };
    }

    // 3. Buat session CacheService 2 jam — PLAN.md:322, Utils SESSION_EXPIRY_SEC
    var cache = CacheService.getScriptCache();
    // gunakan UserCache atau ScriptCache? ScriptCache global, tapi simpan per nis
    // Simpan session dengan key = session_nis
    var sessionKey = 'session_' + nis;
    var sessionData = {
      id: user['id'],
      nis: user['nis'],
      nama: user['nama'],
      kelas: user['kelas'],
      role: user['role'],
      is_eksperimen: user['is_eksperimen'],
      login_at: new Date().toISOString()
    };
    // CacheService max 6 jam, kita pakai 7200 detik
    cache.put(sessionKey, JSON.stringify(sessionData), SESSION_EXPIRY_SEC);
    // juga simpan di Properties untuk fallback? tidak perlu

    // 4. Log activity
    try {
      insertRow('activity_logs', {
        id: getNextId('activity_logs'),
        user_id: user['id'],
        action: 'login',
        target_id: user['id'],
        timestamp: now()
      });
    } catch (e) { Logger.log('log login fail: ' + e.message); }

    // 5. Return dengan role redirect info
    var redirect = '/dashboard';
    if (user['role'] === 'guru' || user['role'] === 'admin') redirect = '/guru';

    return { success: true, message: 'Login berhasil', user: sessionData, redirect: redirect };

  } catch (e) {
    return handleError(e);
  }
}

/**
 * logout() — hapus session
 * Dipanggil via google.script.run.logout()
 */
function logout(nis) {
  try {
    var cache = CacheService.getScriptCache();
    // jika nis tidak diberikan, coba ambil dari current (tapi GAS stateless, client harus kirim nis)
    if (nis) {
      cache.remove('session_' + String(nis).trim());
    } else {
      // fallback: tidak bisa identifikasi, return success
    }
    return { success: true, message: 'Logout berhasil' };
  } catch (e) {
    return handleError(e);
  }
}

/**
 * getCurrentUser(nis) — ambil dari session
 * Karena GAS web app stateless per request, client kirim nis via google.script.run atau via Cache
 * Alternatif: gunakan PropertiesService per user? Disini pakai Cache by nis
 * Jika dipanggil tanpa nis, coba cari session yang masih ada (untuk doGet, nis dari e.parameter)
 */
function getCurrentUser(nis) {
  try {
    if (!nis) return null;
    var cache = CacheService.getScriptCache();
    var data = cache.get('session_' + String(nis).trim());
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    Logger.log('getCurrentUser fail: ' + e.message);
    return null;
  }
}

/**
 * getCurrentUserById(userId) — helper lain
 */
function getCurrentUserById(userId) {
  var user = findRow('users', 'id', userId);
  if (!user) return null;
  return {
    id: user['id'],
    nis: user['nis'],
    nama: user['nama'],
    kelas: user['kelas'],
    role: user['role'],
    is_eksperimen: user['is_eksperimen']
  };
}

/**
 * requireAuth(nis) — middleware PLAN.md:533
 * Throw jika tidak ada session valid
 */
function requireAuth(nis) {
  var user = getCurrentUser(nis);
  if (!user) {
    throw new Error('Unauthorized: session tidak valid atau expired (2 jam). Silakan login ulang.');
  }
  return user;
}

/**
 * isSessionValid(nis) — boolean check untuk doGet routing
 */
function isSessionValid(nis) {
  return getCurrentUser(nis) !== null;
}

/**
 * hashPassword sudah di Utils.gs, tapi expose disini juga untuk konsistensi PLAN.md:535
 */
