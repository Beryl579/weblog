#!/usr/bin/env python3
"""
Local Server — Weblog DDK (Python)  [LEGACY — JANGAN DIPAKAI LAGI]

>>> Server dev yang dipakai sekarang adalah Node: `node server.js` (port 3000).
>>> File ini tertinggal dari arsitektur lama (?page=register, kode akses kelas,
>>> halaman materi/quiz/angket terpisah) dan TIDAK mendukung 3 halaman SPA
>>> (login / dashboard siswa / dashboard guru) + sheet `progress` yang sekarang dipakai.
>>> Jalankan `node server.js` untuk versi yang sinkron dengan aplikasi terkini.

Replikasi GAS + Sheets: JSON db.json + HTTP
Jalankan: python server.py  (port 8000)
"""
import http.server
import json
import os
import hashlib
import re
import urllib.parse
from datetime import datetime, timedelta

PORT = 8000
ROOT = os.path.join(os.path.dirname(__file__), '..', 'Weblog-DDK')
DB_PATH = os.path.join(os.path.dirname(__file__), 'db.json')
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

PASSWORD_SALT = 'DDK2025_UNIMED_SALT'
SESSION_EXPIRY = timedelta(hours=2)

# ---------- DB ----------
# db.json tidak ikut di-commit (lihat .gitignore) — buat kerangka kosong bila belum ada.
if not os.path.exists(DB_PATH):
    empty_tables = ['users', 'class_config', 'materials', 'tests', 'questions', 'test_attempts',
                    'test_answers', 'motivation_indicators', 'motivation_responses', 'comments',
                    'pbl_phases', 'task_submissions', 'activity_logs', 'progress']
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump({t: [] for t in empty_tables}, f, indent=2)

with open(DB_PATH, 'r', encoding='utf-8') as f:
    db = json.load(f)

def save_db():
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=2, ensure_ascii=False)

def get_all_rows(sheet):
    rows = db.get(sheet, [])
    return [{**r, "_rowIndex": i+2} for i, r in enumerate(rows)]

def find_row(sheet, col, val):
    target = str(val).strip()
    for i, r in enumerate(db.get(sheet, [])):
        if str(r.get(col, "")).strip() == target:
            return {**r, "_rowIndex": i+2}
    return None

def find_rows(sheet, col, val):
    target = str(val).strip()
    out = []
    for i, r in enumerate(db.get(sheet, [])):
        if str(r.get(col, "")).strip() == target:
            out.append({**r, "_rowIndex": i+2})
    return out

def get_next_id(sheet):
    rows = db.get(sheet, [])
    max_id = 0
    for r in rows:
        try:
            nid = int(r.get("id", 0))
            if nid > max_id:
                max_id = nid
        except:
            pass
    return max_id + 1

def count_rows(sheet, col, val):
    return len(find_rows(sheet, col, val))

def insert_row(sheet, data):
    if sheet not in db:
        db[sheet] = []
    if not data.get("id"):
        data["id"] = get_next_id(sheet)
    clean = {k: v for k, v in data.items() if k != "_rowIndex"}
    db[sheet].append(clean)
    save_db()
    return {"success": True, "id": clean["id"]}

def update_row(sheet, row_index, data):
    idx = row_index - 2
    if sheet not in db or idx < 0 or idx >= len(db[sheet]):
        raise Exception(f"Row {row_index} not found in {sheet}")
    for k, v in data.items():
        db[sheet][idx][k] = v
    save_db()
    return {"success": True}

def delete_row(sheet, row_index):
    idx = row_index - 2
    if sheet not in db or idx < 0 or idx >= len(db[sheet]):
        raise Exception(f"Row {row_index} not found")
    del db[sheet][idx]
    save_db()
    return {"success": True}

def hash_password(pw):
    if not pw:
        raise Exception("Password kosong")
    salted = pw + PASSWORD_SALT
    return hashlib.sha256(salted.encode()).hexdigest()

def now_iso():
    return datetime.now().isoformat()

def anon_id(idx):
    n = int(idx) + 1
    if n < 10:
        return f"S00{n}"
    if n < 100:
        return f"S0{n}"
    return f"S{n}"

def calc_nilai(score, total):
    if not total:
        return 0
    return (float(score) / float(total)) * 100

def n_gain(post, pre):
    pre = float(pre); post = float(post)
    if 100 - pre == 0:
        return 0
    return (post - pre) / (100 - pre)

def is_valid_nis(nis):
    return bool(re.match(r"^[0-9]{4,20}$", str(nis).strip()))

# ---------- Session ----------
sessions = {}  # nis -> {"user": dict, "expires": datetime}

def get_current_user(nis):
    if not nis:
        return None
    s = sessions.get(str(nis).strip())
    if not s:
        return None
    if datetime.now() > s["expires"]:
        del sessions[str(nis).strip()]
        return None
    return s["user"]

def is_session_valid(nis):
    return get_current_user(nis) is not None

# ---------- Seed ----------
def seed_if_empty():
    seeded = False
    if len(db.get("class_config", [])) == 0:
        insert_row("class_config", {"id": 1, "kelas": "X TITL 1", "access_code": "DDK2025-EKS", "is_eksperimen": True, "max_students": 30})
        print("Seed class_config")
        seeded = True
    if count_rows("users", "role", "guru") == 0:
        insert_row("users", {"id": 1, "nis": "GURU001", "nama": "Guru Pamong", "kelas": "X TITL 1", "role": "guru", "is_eksperimen": True, "password_hash": hash_password("guru123"), "registered_at": now_iso(), "is_active": True})
        insert_row("users", {"id": 2, "nis": "ADMIN001", "nama": "Admin", "kelas": "X TITL 1", "role": "admin", "is_eksperimen": True, "password_hash": hash_password("admin123"), "registered_at": now_iso(), "is_active": True})
        print("Seed users guru/admin (guru123/admin123)")
        seeded = True
    if len(db.get("materials", [])) == 0:
        m1 = """<h3>Tujuan Pembelajaran</h3><p>Memahami proses perencanaan instalasi listrik gedung meliputi penawaran hingga serah terima (PDF p24).</p><h3>a. Penawaran Pekerjaan</h3><p>Jasa ME ditawarkan pekerjaan instalasi listrik dari pemilik gedung/kontraktor utama sebagai sub-kontraktor.</p><h3>b. Survei & Penjelasan Pekerjaan</h3><p>Menghubungi pemilik, survey untuk data terperinci kebutuhan instalasi.</p><h3>c. Perencanaan</h3><p>Rancangan gambar (lampu, stop kontak, genset, panel) + RAB: nilai material, jasa teknisi, sewa alat.</p><h3>d. Presentasi</h3><p>Di depan pemilik pekerjaan, bahas kesesuaian sampai kesepakatan.</p><h3>e. Pelaksanaan (SPK + Pengawas)</h3><ul><li>Persiapan: alat, bahan, tenaga</li><li>Pelaksanaan: kerjakan sampai selesai</li><li>Tes/Commissioning: parsial & holistik</li></ul><h3>f. Serah Terima</h3><p>Setelah selesai, serah terima pemilik–pelaksana.</p>"""
        m2 = """<h3>Tujuan</h3><p>Memahami pembuatan panel kendali pensaklaran beban PLN–genset (PDF p26).</p><p>Survey fokus peralatan dikendalikan (genset). Perhitungan peralatan, kabel, proteksi sesuai batas ukur. Konsultasi cara kerja panel dengan pemilik: contoh genset otomatis suplai seluruh gedung setelah pemadaman.</p>"""
        m3 = """<h3>Tujuan</h3><p>Memahami pemeliharaan, perbaikan, perawatan peralatan ketenagalistrikan (PDF p27).</p><h3>SOP & Jadwal</h3><p>AC 3 bulan sekali, lampu, lift, pompa air, panel. Cek harian deteksi kerusakan.</p><h3>Penanganan</h3><p>Internal jika bisa, order pihak ketiga jika tidak. Tim siap sedia.</p>"""
        m4 = """<h3>Tujuan</h3><p>Memahami pengelolaan SDM lulusan TITL (PDF p27-28).</p><p>Alur: perencanaan → gambar instalasi → survey → RAB → pemasangan → testing → commissioning → pemeliharaan → perawatan → perbaikan</p>"""
        insert_row("materials", {"id": 1, "topik": 1, "judul": "Proses Perencanaan Instalasi", "konten": m1, "file_ppt_url": "https://drive.google.com/file/d/PLACEHOLDER_PPT1", "file_pdf_url": "https://drive.google.com/file/d/PLACEHOLDER_PDF1", "gambar_url": "", "published_at": now_iso(), "is_active": True})
        insert_row("materials", {"id": 2, "topik": 2, "judul": "Pembuatan Panel", "konten": m2, "file_ppt_url": "https://drive.google.com/file/d/PLACEHOLDER_PPT2", "file_pdf_url": "https://drive.google.com/file/d/PLACEHOLDER_PDF2", "gambar_url": "", "published_at": now_iso(), "is_active": True})
        insert_row("materials", {"id": 3, "topik": 3, "judul": "Pemeliharaan, Perbaikan, dan Perawatan Peralatan Ketenagalistrikan", "konten": m3, "file_ppt_url": "https://drive.google.com/file/d/PLACEHOLDER_PPT3", "file_pdf_url": "https://drive.google.com/file/d/PLACEHOLDER_PDF3", "gambar_url": "", "published_at": now_iso(), "is_active": True})
        insert_row("materials", {"id": 4, "topik": 4, "judul": "Pengelolaan SDM", "konten": m4, "file_ppt_url": "https://drive.google.com/file/d/PLACEHOLDER_PPT4", "file_pdf_url": "https://drive.google.com/file/d/PLACEHOLDER_PDF4", "gambar_url": "", "published_at": now_iso(), "is_active": True})
        print("Seed materials 4")
        seeded = True
    if len(db.get("tests", [])) == 0:
        insert_row("tests", {"id": 1, "type": "pretest", "total_questions": 20, "duration_min": 60, "is_open": False, "created_at": now_iso()})
        insert_row("tests", {"id": 2, "type": "posttest", "total_questions": 20, "duration_min": 60, "is_open": False, "created_at": now_iso()})
        insert_row("tests", {"id": 3, "type": "angket", "total_questions": 16, "duration_min": "", "is_open": True, "created_at": now_iso()})
        print("Seed tests")
        seeded = True
    if len(db.get("questions", [])) == 0:
        import random
        levels = ['C1']*5 + ['C2']*5 + ['C3']*5 + ['C4']*5
        topics = ['Perencanaan Instalasi','Pembuatan Panel','Pemeliharaan','Pengelolaan SDM']
        cid = 1
        for test_id in [1,2]:
            ttype = 'pretest' if test_id==1 else 'posttest'
            for i in range(20):
                level = levels[i]
                topic = topics[i%4]
                insert_row("questions", {
                    "id": cid, "test_id": test_id,
                    "question_text": f"Contoh soal [{level}] nomor {i+1} tentang {topic} — {ttype} (placeholder, ganti dengan soal valid PDF p35-40)",
                    "option_a": f"Pilihan A untuk {topic}",
                    "option_b": f"Pilihan B untuk {topic}",
                    "option_c": f"Pilihan C untuk {topic}",
                    "option_d": f"Pilihan D untuk {topic}",
                    "correct_answer": random.choice(['A','B','C','D']),
                    "cognitive_level": level,
                    "order_num": i+1
                })
                cid+=1
        print("Seed questions 40")
        seeded = True
    if len(db.get("motivation_indicators", [])) == 0:
        inds = [
            ("Dorongan Belajar", [
                "Saya bersemangat mengikuti pelajaran DDK karena ingin memahami instalasi listrik",
                "Saya terdorong belajar DDK untuk meningkatkan keterampilan teknik",
                "Saya termotivasi belajar DDK karena cita-cita di bidang ketenagalistrikan",
                "Saya memiliki dorongan kuat untuk mendapat nilai di atas KKTP 75"]),
            ("Ketekunan", [
                "Saya tekun mengerjakan tugas DDK walau sulit",
                "Saya mengulang materi DDK sampai paham",
                "Saya tidak mudah menyerah saat praktikum instalasi",
                "Saya konsisten hadir dan aktif di kelas DDK"]),
            ("Minat", [
                "Saya senang mempelajari rangkaian dan panel listrik",
                "Saya mencari sumber tambahan tentang DDK di weblog",
                "Saya antusias saat guru menjelaskan materi kelistrikan",
                "Saya berminat melanjutkan studi/kerja di bidang listrik"]),
            ("Lingkungan Belajar", [
                "Suasana kelas mendukung saya belajar DDK",
                "Teman dan guru memotivasi saya belajar DDK",
                "Fasilitas weblog membantu saya memahami materi",
                "Dukungan orang tua meningkatkan motivasi belajar DDK"]),
        ]
        cid=1
        for name, stmts in inds:
            for d, s in enumerate(stmts,1):
                insert_row("motivation_indicators", {"id": cid, "indicator_name": name, "descriptor_num": d, "statement_text": s, "order_num": cid})
                cid+=1
        print("Seed motivation 16")
        seeded=True
    if len(db.get("pbl_phases", [])) == 0:
        phases=[
            (1,"Orientasi Siswa kepada Masalah","Guru menjelaskan tujuan pembelajaran, logistik, motivasi terlibat pemecahan masalah. Fitur: studi kasus kelistrikan, pertanyaan pemantik, gambar/video masalah.","https://drive.google.com/file/d/LKPD_FASE1"),
            (2,"Mengorganisasikan Siswa untuk Belajar","Guru membantu mendefinisikan & mengorganisasikan tugas belajar. Fitur: pembagian kelompok, instruksi tugas, unduh LKPD.","https://drive.google.com/file/d/LKPD_FASE2"),
            (3,"Membimbing Penyelidikan Individu maupun Kelompok","Guru mendorong kumpul informasi, eksperimen, pemecahan masalah. Fitur: sumber bacaan, diskusi kelompok, link materi.","https://drive.google.com/file/d/LKPD_FASE3"),
            (4,"Menghubungkan dan Menyajikan Hasil Karya","Guru bantu rencanakan & siapkan karya (laporan, model) & berbagi tugas. Fitur: upload laporan, galeri, presentasi.","https://drive.google.com/file/d/LKPD_FASE4"),
            (5,"Menganalisis dan Mengevaluasi Proses Pemecahan Masalah","Guru bantu refleksi/evaluasi terhadap penyelidikan & proses. Fitur: refleksi tertulis, kuis formatif, feedback guru.","https://drive.google.com/file/d/LKPD_FASE5"),
        ]
        for num,title,desc,url in phases:
            insert_row("pbl_phases", {"id": num, "phase_num": num, "title": title, "description": desc, "file_url": url})
        print("Seed pbl 5")
        seeded=True
    if seeded:
        save_db()

seed_if_empty()

# ---------- Service Functions ----------
def register_service(data):
    try:
        nis=str(data.get("nis","")).strip()
        nama=str(data.get("nama","")).strip()
        pw=str(data.get("password",""))
        cp=str(data.get("confirmPassword",""))
        code=str(data.get("accessCode","")).strip()
        if not nis or not nama or not pw or not cp or not code:
            return {"success": False, "message": "Semua field wajib diisi"}
        if not is_valid_nis(nis):
            return {"success": False, "message": "NIS tidak valid (4-20 digit angka)"}
        if len(nama)<3:
            return {"success": False, "message": "Nama minimal 3 karakter"}
        if len(pw)<6:
            return {"success": False, "message": "Password minimal 6 karakter"}
        if pw!=cp:
            return {"success": False, "message": "Konfirmasi password tidak cocok"}
        if find_row("users","nis",nis):
            return {"success": False, "message": "NIS sudah terdaftar. Silakan login."}
        cc=find_row("class_config","access_code",code)
        if not cc:
            return {"success": False, "message": "Kode akses tidak valid"}
        is_eks = cc.get("is_eksperimen") is True or str(cc.get("is_eksperimen")).lower()=="true"
        if not is_eks:
            return {"success": False, "message": "Kelas ini bukan kelas eksperimen"}
        kelas_name=cc.get("kelas")
        max_students=int(cc.get("max_students") or 30)
        if count_rows("users","kelas",kelas_name) >= max_students:
            return {"success": False, "message": "Kuota kelas penuh (30 siswa). Hubungi guru."}
        nid=get_next_id("users")
        insert_row("users",{"id":nid,"nis":nis,"nama":nama,"kelas":kelas_name,"role":"siswa","is_eksperimen":True,"password_hash":hash_password(pw),"registered_at":now_iso(),"is_active":True})
        insert_row("activity_logs",{"id":get_next_id("activity_logs"),"user_id":nid,"action":"register","target_id":nid,"timestamp":now_iso()})
        return {"success": True, "message": "Registrasi berhasil. Silakan login.", "userId": nid, "kelas": kelas_name}
    except Exception as e:
        return {"success": False, "message": str(e)}

def login_service(data):
    try:
        nis=str(data.get("nis","")).strip()
        pw=str(data.get("password",""))
        if not nis or not pw:
            return {"success": False, "message": "NIS dan Password wajib diisi"}
        user=find_row("users","nis",nis)
        if not user:
            return {"success": False, "message": "NIS tidak terdaftar. Silakan daftar terlebih dahulu."}
        if str(user.get("is_active")).lower()=="false" or user.get("is_active") is False:
            return {"success": False, "message": "Akun non-aktif. Hubungi guru."}
        if hash_password(pw)!=str(user.get("password_hash")).strip():
            return {"success": False, "message": "Password salah"}
        session_data={"id":user["id"],"nis":user["nis"],"nama":user["nama"],"kelas":user["kelas"],"role":user["role"],"is_eksperimen":user["is_eksperimen"],"login_at":datetime.now().isoformat()}
        sessions[nis]={"user":session_data,"expires":datetime.now()+SESSION_EXPIRY}
        insert_row("activity_logs",{"id":get_next_id("activity_logs"),"user_id":user["id"],"action":"login","target_id":user["id"],"timestamp":now_iso()})
        redirect="/guru" if user["role"] in ["guru","admin"] else "/dashboard"
        return {"success": True, "message": "Login berhasil", "user": session_data, "redirect": redirect}
    except Exception as e:
        return {"success": False, "message": str(e)}

def has_completed(user_id, test_type):
    tr=find_row("tests","type",str(test_type).lower())
    if not tr:
        return False
    attempts=find_rows("test_attempts","user_id",user_id)
    return any(str(a.get("test_id")).strip()==str(tr["id"]).strip() for a in attempts)

def is_test_open(test_type):
    r=find_row("tests","type",str(test_type).lower())
    if not r:
        return False
    return str(r.get("is_open")).lower()=="true" or r.get("is_open") is True

def get_questions(data):
    try:
        t=str(data.get("testType","")).lower().strip()
        if t not in ["pretest","posttest"]:
            return {"success": False, "message": "testType harus pretest/posttest"}
        tr=find_row("tests","type",t)
        if not tr:
            return {"success": False, "message": f"Test {t} belum dibuat"}
        qs=find_rows("questions","test_id",tr["id"])
        qs.sort(key=lambda x: int(x.get("order_num",0)))
        safe=[{"id":q["id"],"test_id":q["test_id"],"question_text":q["question_text"],"option_a":q["option_a"],"option_b":q["option_b"],"option_c":q["option_c"],"option_d":q["option_d"],"cognitive_level":q["cognitive_level"],"order_num":q["order_num"]} for q in qs]
        return {"success": True, "test": {"id": tr["id"], "type": t, "total_questions": len(safe), "is_open": tr["is_open"]}, "questions": safe}
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_test_result(data):
    try:
        uid=data.get("userId")
        t=str(data.get("testType","")).lower()
        tr=find_row("tests","type",t)
        if not tr:
            return {"success": False, "message": "Test tidak ditemukan"}
        attempts=find_rows("test_attempts","user_id",uid)
        attempt=None
        for a in attempts:
            if str(a.get("test_id")).strip()==str(tr["id"]).strip():
                attempt=a
                break
        if not attempt:
            return {"success": False, "message": f"Belum mengerjakan {t}", "completed": False}
        answers=find_rows("test_answers","attempt_id",attempt["id"])
        return {"success": True, "completed": True, "attempt": {"id": attempt["id"],"raw_score":attempt["raw_score"],"final_value":attempt["final_value"],"submitted_at":attempt["submitted_at"]}, "answers": answers}
    except Exception as e:
        return {"success": False, "message": str(e)}

def submit_test(data):
    try:
        uid=data.get("userId")
        t=str(data.get("testType","")).lower().strip()
        answers=data.get("answers")
        if t not in ["pretest","posttest"]:
            return {"success": False, "message": "Jenis test tidak valid"}
        if not uid:
            return {"success": False, "message": "userId wajib"}
        if not answers or not isinstance(answers, list) or len(answers)==0:
            return {"success": False, "message": "Jawaban kosong"}
        user=find_row("users","id",uid)
        if not user:
            return {"success": False, "message": "User tidak ditemukan"}
        tr=find_row("tests","type",t)
        if not tr:
            return {"success": False, "message": "Test tidak ditemukan"}
        if not is_test_open(t):
            return {"success": False, "message": f"{t} sedang tertutup. Hubungi guru."}
        if t=="posttest" and not has_completed(uid,"pretest"):
            return {"success": False, "message": "Posttest hanya bisa setelah pretest selesai"}
        if has_completed(uid,t):
            return {"success": False, "message": f"Anda sudah submit {t} sebelumnya."}
        all_qs=find_rows("questions","test_id",tr["id"])
        if len(answers) < len(all_qs):
            return {"success": False, "message": f"Jawaban belum lengkap ({len(answers)}/{len(all_qs)})"}
        key_map={str(q["id"]).strip(): str(q["correct_answer"]).strip().upper() for q in all_qs}
        raw=0
        scored=[]
        for ans in answers:
            qid=str(ans.get("question_id")).strip()
            sel=str(ans.get("selected_answer","")).strip().upper()
            if sel not in ["A","B","C","D"]:
                return {"success": False, "message": f"Jawaban tidak valid untuk soal {qid}"}
            correct=key_map.get(qid)
            if not correct:
                return {"success": False, "message": f"Soal ID {qid} tidak ditemukan"}
            ok=sel==correct
            scored.append({"question_id":qid,"selected_answer":sel,"is_correct":ok,"score":1 if ok else 0})
            if ok:
                raw+=1
        total=len(all_qs)
        final=calc_nilai(raw,total)
        aid=get_next_id("test_attempts")
        insert_row("test_attempts",{"id":aid,"user_id":uid,"test_id":tr["id"],"raw_score":raw,"final_value":round(final,2),"started_at":now_iso(),"submitted_at":now_iso()})
        for sa in scored:
            insert_row("test_answers",{"id":get_next_id("test_answers"),"attempt_id":aid,"question_id":sa["question_id"],"selected_answer":sa["selected_answer"],"is_correct":sa["is_correct"],"score":sa["score"]})
        insert_row("activity_logs",{"id":get_next_id("activity_logs"),"user_id":uid,"action":"submit_kuis","target_id":aid,"timestamp":now_iso()})
        return {"success": True, "message": f"Submit {t} berhasil", "result": {"raw_score": raw, "final_value": round(final,2), "total_questions": total}}
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_motivation_questions():
    try:
        rows=get_all_rows("motivation_indicators")
        rows.sort(key=lambda x: int(x.get("order_num",0)))
        grouped={}
        flat=[]
        for r in rows:
            ind=r.get("indicator_name") or "Indikator"
            if ind not in grouped:
                grouped[ind]=[]
            item={"id":r["id"],"indicator_name":ind,"descriptor_num":r["descriptor_num"],"statement_text":r["statement_text"],"order_num":r["order_num"]}
            grouped[ind].append(item)
            flat.append(item)
        return {"success": True, "total": len(flat), "grouped": grouped, "flat": flat}
    except Exception as e:
        return {"success": False, "message": str(e)}

def has_submitted_motivation(uid):
    return len(find_rows("motivation_responses","user_id",uid))>0

def get_motivation_result(data):
    try:
        uid=data.get("userId") or data.get("user_id")
        if not uid:
            return {"success": False, "message": "userId wajib"}
        responses=find_rows("motivation_responses","user_id",uid)
        if not responses:
            return {"success": False, "message": "Belum mengisi angket", "completed": False}
        indicators=get_all_rows("motivation_indicators")
        ind_map={str(i["id"]).strip():i for i in indicators}
        per={}
        total=0
        for resp in responses:
            ind_id=str(resp["indicator_id"]).strip()
            val=int(resp["response_value"])
            total+=val
            meta=ind_map.get(ind_id)
            name=str(meta.get("indicator_name")).strip() if meta else f"Indikator {ind_id}"
            if name not in per:
                per[name]={"score":0,"count":0}
            per[name]["score"]+=val
            per[name]["count"]+=1
        max_score=64
        nilai=calc_nilai(total,max_score)
        if total<=28:
            kat="Rendah (a)"
        elif total<=40:
            kat="Cukup (b)"
        elif total<=52:
            kat="Baik (c)"
        else:
            kat="Sangat Baik (d)"
        per_arr=[]
        for k,v in per.items():
            s=v["score"]
            k2="Rendah" if s<=7 else "Cukup" if s<=10 else "Baik" if s<=13 else "Sangat Baik"
            per_arr.append({"indicator_name":k,"score":s,"max":16,"nilai":calc_nilai(s,16),"kategori":k2,"count":v["count"]})
        return {"success": True, "completed": True, "data": {"total_score": total, "max_score": max_score, "nilai": round(nilai,2), "kategori": kat, "per_indikator": per_arr, "responses_count": len(responses)}}
    except Exception as e:
        return {"success": False, "message": str(e)}

def submit_motivation(data):
    try:
        uid=data.get("userId") or data.get("user_id")
        responses=data.get("responses")
        if not uid:
            return {"success": False, "message": "userId wajib"}
        if not find_row("users","id",uid):
            return {"success": False, "message": "User tidak ditemukan"}
        if not has_completed(uid,"posttest"):
            return {"success": False, "message": "Angket hanya bisa setelah posttest"}
        if has_submitted_motivation(uid):
            return {"success": False, "message": "Anda sudah mengisi angket sebelumnya (1×)."}
        arr=[]
        if isinstance(responses, list):
            arr=responses
        elif isinstance(responses, dict):
            for k,v in responses.items():
                arr.append({"indicator_id": k, "response_value": v})
        else:
            return {"success": False, "message": "Format responses tidak valid"}
        expected=get_all_rows("motivation_indicators")
        if len(arr)!=len(expected):
            return {"success": False, "message": f"Angket harus {len(expected)} item, terisi {len(arr)}"}
        valid_ids={str(e["id"]).strip(): True for e in expected}
        for r in arr:
            ind_id=str(r.get("indicator_id")).strip()
            val=int(r.get("response_value"))
            if ind_id not in valid_ids:
                return {"success": False, "message": f"indicator_id {ind_id} tidak valid"}
            if val<1 or val>4:
                return {"success": False, "message": "Nilai harus 1-4"}
        for item in arr:
            insert_row("motivation_responses",{"id":get_next_id("motivation_responses"),"user_id":uid,"indicator_id":str(item["indicator_id"]).strip(),"response_value":int(item["response_value"]),"submitted_at":now_iso()})
        insert_row("activity_logs",{"id":get_next_id("activity_logs"),"user_id":uid,"action":"submit_angket","target_id":uid,"timestamp":now_iso()})
        result=get_motivation_result({"userId": uid})
        return {"success": True, "message": "Angket berhasil disimpan", "result": result.get("data") or result}
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_comments(data):
    try:
        mid=data.get("materialId") or data.get("material_id")
        rows=find_rows("comments","material_id",mid)
        approved=[r for r in rows if str(r.get("is_approved")).lower()=="true" or r.get("is_approved") is True]
        approved.sort(key=lambda x: x.get("created_at"))
        # build tree
        mp={str(c["id"]).strip(): {**c, "replies": []} for c in approved}
        roots=[]
        for c in approved:
            parent=c.get("parent_id")
            if parent and str(parent).strip()!="" and str(parent).strip() in mp:
                mp[str(parent).strip()]["replies"].append(mp[str(c["id"]).strip()])
            else:
                roots.append(mp[str(c["id"]).strip()])
        return {"success": True, "data": roots}
    except Exception as e:
        return {"success": False, "message": str(e)}

def add_comment(data):
    try:
        uid=data.get("userId") or data.get("user_id")
        mid=data.get("materialId") or data.get("material_id")
        content=data.get("content")
        parent=data.get("parentId") or data.get("parent_id") or ""
        if not uid or not mid or not content:
            return {"success": False, "message": "userId, materialId, content wajib"}
        user=find_row("users","id",uid)
        if not user:
            return {"success": False, "message": "User tidak ditemukan"}
        if not find_row("materials","id",mid):
            return {"success": False, "message": "Materi tidak ditemukan"}
        content=str(content).strip().replace("<","&lt;").replace(">","&gt;")
        if len(content)<3:
            return {"success": False, "message": "Komentar minimal 3 karakter"}
        if parent:
            pr=find_row("comments","id",parent)
            if not pr:
                return {"success": False, "message": "Parent tidak ditemukan"}
            if str(pr.get("material_id")).strip()!=str(mid).strip():
                return {"success": False, "message": "Parent tidak sesuai materi"}
        nid=get_next_id("comments")
        is_app=user.get("role") in ["guru","admin"]
        insert_row("comments",{"id":nid,"user_id":uid,"material_id":mid,"content":content,"parent_id":parent or "","is_approved":is_app,"created_at":now_iso()})
        insert_row("activity_logs",{"id":get_next_id("activity_logs"),"user_id":uid,"action":"comment","target_id":mid,"timestamp":now_iso()})
        return {"success": True, "message": "Komentar diposting" if is_app else "Komentar menunggu moderasi guru", "id": nid, "is_approved": is_app}
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_recap():
    try:
        users=[r for r in get_all_rows("users") if str(r.get("role")).lower()=="siswa"]
        users.sort(key=lambda x: (str(x.get("kelas")), str(x.get("nama"))))
        recap=[]
        for s, stu in enumerate(users):
            uid=stu["id"]
            pre=get_test_result({"userId": uid, "testType": "pretest"})
            post=get_test_result({"userId": uid, "testType": "posttest"})
            mot=get_motivation_result({"userId": uid})
            pre_score=pre["attempt"]["raw_score"] if pre.get("success") else "-"
            pre_val=pre["attempt"]["final_value"] if pre.get("success") else "-"
            post_score=post["attempt"]["raw_score"] if post.get("success") else "-"
            post_val=post["attempt"]["final_value"] if post.get("success") else "-"
            mot_score=mot["data"]["total_score"] if mot.get("success") else "-"
            mot_nilai=mot["data"]["nilai"] if mot.get("success") else "-"
            ng="-"
            if pre.get("success") and post.get("success"):
                ng=round(n_gain(post_val, pre_val),2)
            recap.append({
                "id": uid, "nis": stu["nis"], "anon_id": anon_id(s), "nama": stu["nama"], "kelas": stu["kelas"], "is_eksperimen": stu["is_eksperimen"],
                "pretest_status": "Selesai" if pre.get("success") else "Belum", "pretest_score": pre_score, "pretest_value": pre_val,
                "posttest_status": "Selesai" if post.get("success") else "Belum", "posttest_score": post_score, "posttest_value": post_val, "n_gain": ng,
                "angket_status": "Selesai" if mot.get("success") else "Belum", "motivasi_total": mot_score, "motivasi_nilai": mot_nilai, "motivasi_kategori": mot["data"]["kategori"] if mot.get("success") else "-"
            })
        total=len(recap)
        pre_done=len([r for r in recap if r["pretest_status"]=="Selesai"])
        post_done=len([r for r in recap if r["posttest_status"]=="Selesai"])
        ang_done=len([r for r in recap if r["angket_status"]=="Selesai"])
        def avg(key):
            vals=[float(r[key]) for r in recap if r[key]!="-"]
            return round(sum(vals)/len(vals),2) if vals else 0
        summary={
            "total_siswa": total,
            "pretest_selesai": pre_done, "pretest_pct": round(pre_done/total*100,1) if total else 0,
            "posttest_selesai": post_done, "posttest_pct": round(post_done/total*100,1) if total else 0,
            "angket_selesai": ang_done, "angket_pct": round(ang_done/total*100,1) if total else 0,
            "rata_pretest": avg("pretest_value"),
            "rata_posttest": avg("posttest_value"),
            "rata_motivasi": avg("motivasi_nilai")
        }
        return {"success": True, "summary": summary, "data": recap}
    except Exception as e:
        return {"success": False, "message": str(e)}

def toggle_test(data):
    try:
        t=str(data.get("testType","")).lower()
        is_open=data.get("isOpen")
        # bool handling
        if isinstance(is_open, str):
            is_open = is_open.lower()=="true"
        if t not in ["pretest","posttest","angket"]:
            return {"success": False, "message": "testType harus pretest/posttest/angket"}
        r=find_row("tests","type",t)
        if not r:
            nid=get_next_id("tests")
            insert_row("tests",{"id":nid,"type":t,"total_questions":16 if t=="angket" else 20,"duration_min":"","is_open":is_open,"created_at":now_iso()})
            return {"success": True, "message": f"{t} dibuat & {'dibuka' if is_open else 'ditutup'}"}
        update_row("tests", r["_rowIndex"], {"is_open": is_open})
        return {"success": True, "message": f"{t} {'dibuka' if is_open else 'ditutup'}"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def export_hasil():
    try:
        recap=get_recap()
        if not recap.get("success"):
            return recap
        header="id_siswa,kelas,pretest_score,pretest_value,posttest_score,posttest_value,n_gain"
        lines=[header]
        for r in recap["data"]:
            lines.append(f"{r['anon_id']},{r['kelas']},{'' if r['pretest_score']=='-' else r['pretest_score']},{'' if r['pretest_value']=='-' else r['pretest_value']},{'' if r['posttest_score']=='-' else r['posttest_score']},{'' if r['posttest_value']=='-' else r['posttest_value']},{'' if r['n_gain']=='-' else r['n_gain']}")
        return {"success": True, "csv": "\n".join(lines), "filename": "hasil_belajar.csv", "rows": len(recap["data"])}
    except Exception as e:
        return {"success": False, "message": str(e)}

def export_butir():
    try:
        users=[r for r in get_all_rows("users") if str(r.get("role")).lower()=="siswa"]
        users.sort(key=lambda x: int(x["id"]))
        header="id_siswa,jenis_test,no_soal,kunci,jawaban_siswa,skor,level_kognitif"
        lines=[header]
        for u, user in enumerate(users):
            anon=anon_id(u)
            for t in ["pretest","posttest"]:
                tr=find_row("tests","type",t)
                if not tr:
                    continue
                attempts=find_rows("test_attempts","user_id",user["id"])
                attempt=None
                for a in attempts:
                    if str(a.get("test_id")).strip()==str(tr["id"]).strip():
                        attempt=a
                        break
                if not attempt:
                    continue
                answers=find_rows("test_answers","attempt_id",attempt["id"])
                for ans in answers:
                    q=find_row("questions","id",ans["question_id"])
                    if not q:
                        continue
                    lines.append(f"{anon},{t},{q['order_num']},{q['correct_answer']},{ans['selected_answer']},{ans['score']},{q['cognitive_level']}")
        return {"success": True, "csv": "\n".join(lines), "filename": "butir_soal.csv", "rows": len(lines)-1}
    except Exception as e:
        return {"success": False, "message": str(e)}

def export_motivasi():
    try:
        inds=get_all_rows("motivation_indicators")
        inds.sort(key=lambda x: int(x.get("order_num")))
        names=[]
        seen=set()
        for i in inds:
            n=str(i["indicator_name"]).strip()
            if n not in seen:
                seen.add(n)
                names.append(n)
            if len(names)==4:
                break
        name_to_idx={n:i+1 for i,n in enumerate(names)}
        users=[r for r in get_all_rows("users") if str(r.get("role")).lower()=="siswa"]
        users.sort(key=lambda x: int(x["id"]))
        header="id_siswa,kelas,skor_ind1,skor_ind2,skor_ind3,skor_ind4,total_motivasi"
        lines=[header]
        for u, user in enumerate(users):
            anon=anon_id(u)
            resps=find_rows("motivation_responses","user_id",user["id"])
            if not resps:
                continue
            skor=[0,0,0,0]
            total=0
            for resp in resps:
                q=find_row("motivation_indicators","id",resp["indicator_id"])
                if not q:
                    continue
                name=str(q["indicator_name"]).strip()
                idx=name_to_idx.get(name)
                if idx:
                    skor[idx-1]+=int(resp["response_value"])
                total+=int(resp["response_value"])
            lines.append(f"{anon},{user['kelas']},{skor[0]},{skor[1]},{skor[2]},{skor[3]},{total}")
        return {"success": True, "csv": "\n".join(lines), "filename": "motivasi.csv", "rows": len(lines)-1}
    except Exception as e:
        return {"success": False, "message": str(e)}

# ---------- HTTP Handler ----------
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # custom log
        print(f"{self.client_address[0]} - - [{self.log_date_time_string()}] {format % args}")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        # flatten query (first value)
        qflat = {k: v[0] for k, v in query.items()}
        path_url = parsed.path

        # static
        if path_url.startswith("/uploads/"):
            fp = os.path.join(os.path.dirname(__file__), path_url.lstrip("/"))
            if os.path.exists(fp):
                ext = os.path.splitext(fp)[1].lower()
                mime = {".pdf":"application/pdf",".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".doc":"application/msword",".docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}.get(ext,"application/octet-stream")
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.end_headers()
                with open(fp, "rb") as f:
                    self.wfile.write(f.read())
                return
            self.send_error(404)
            return

        if path_url in ("/Styles/Main.css", "/Styles/Main", "/Styles/Main.html"):
            # GAS tidak punya tipe berkas CSS -> CSS disimpan sebagai Styles/Main.html
            fp = os.path.join(ROOT, "Styles", "Main.html")
            if os.path.exists(fp):
                self.send_response(200)
                self.send_header("Content-Type", "text/css")
                self.end_headers()
                self.wfile.write(open(fp,"r",encoding="utf-8").read().encode())
                return

        # API GET not used, but handle
        if path_url.startswith("/api/"):
            self.send_response(200)
            self.send_header("Content-Type","application/json")
            self.send_header("Access-Control-Allow-Origin","*")
            self.end_headers()
            self.wfile.write(json.dumps({"success":False,"message":"Use POST for API"}).encode())
            return

        # Page rendering
        page = qflat.get("page","login").lower()
        valid = ["register","login","dashboard","materi","materidetail","pbl","pbldetail","quiz","angket","diskusi","tugas","guru"]
        if page not in valid:
            page="login"
        public_pages = ["register","login"]
        nis = qflat.get("nis","")
        # auth guard
        if page not in public_pages and not is_session_valid(nis):
            page="login"
            qflat["page"]="login"
            fp = os.path.join(ROOT, "Views", "Login.html")
            html = render_template(fp, qflat)
            self.send_response(200)
            self.send_header("Content-Type","text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html.encode())
            return

        if page in ["register","login"] and is_session_valid(nis):
            user = get_current_user(nis)
            target = "DashboardGuru.html" if user and user.get("role") in ["guru","admin"] else "DashboardSiswa.html"
            fp = os.path.join(ROOT, "Views", target)
            html = render_template(fp, qflat)
            self.send_response(200)
            self.send_header("Content-Type","text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html.encode())
            return

        m = {
            "register": "Views/Register.html",
            "login": "Views/Login.html",
            "dashboard": "Views/DashboardSiswa.html",
            "materi": "Views/Materi.html",
            "materidetail": "Views/MateriDetail.html",
            "pbl": "Views/Pbl.html",
            "pbldetail": "Views/PblDetail.html",
            "quiz": "Views/Quiz.html",
            "angket": "Views/Angket.html",
            "diskusi": "Views/Diskusi.html",
            "tugas": "Views/Tugas.html",
            "guru": "Views/DashboardGuru.html",
        }
        fp = os.path.join(ROOT, m.get(page, "Views/Login.html"))
        if not os.path.exists(fp):
            self.send_error(404, f"Page not found {page}")
            return
        if page=="guru":
            user=get_current_user(nis)
            if user and str(user.get("role")).lower() not in ["guru","admin"]:
                fp=os.path.join(ROOT,"Views/DashboardSiswa.html")
        html=render_template(fp, qflat)
        self.send_response(200)
        self.send_header("Content-Type","text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode())

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path_url = parsed.path
        length = int(self.headers.get('Content-Length',0))
        body_bytes = self.rfile.read(length) if length else b""
        try:
            body = json.loads(body_bytes.decode()) if body_bytes else {}
        except:
            body = {}

        # API routing
        if path_url.startswith("/api/"):
            api = path_url.replace("/api/","")
            result = {"success": False, "message": f"Unknown API {api}"}
            try:
                if api=="register":
                    result=register_service(body)
                elif api=="login":
                    result=login_service(body)
                elif api=="logout":
                    sessions.pop(str(body.get("nis","")).strip(),None)
                    result={"success": True, "message": "Logout berhasil"}
                elif api=="getCurrentUser":
                    u=get_current_user(str(body.get("nis","")))
                    result={"success": True, "user": u} if u else {"success": False, "message": "No session"}
                elif api=="getMaterials":
                    rows=get_all_rows("materials")
                    active=[r for r in rows if str(r.get("is_active")).lower()=="true" or r.get("is_active") is True]
                    active.sort(key=lambda x: int(x.get("topik",0)))
                    result={"success": True, "data": active}
                elif api=="getMaterialById":
                    r=find_row("materials","id",body.get("id"))
                    result={"success": True, "data": r} if r else {"success": False, "message": "Materi tidak ditemukan"}
                elif api=="getPblPhases":
                    rows=get_all_rows("pbl_phases")
                    rows.sort(key=lambda x: int(x.get("phase_num",0)))
                    result={"success": True, "data": rows}
                elif api=="getPblPhaseById":
                    r=find_row("pbl_phases","id",body.get("id"))
                    result={"success": True, "data": r} if r else {"success": False, "message": "Fase tidak ditemukan"}
                elif api=="getQuestions":
                    result=get_questions(body)
                elif api=="submitTest":
                    result=submit_test(body)
                elif api=="getTestResult":
                    result=get_test_result(body)
                elif api=="isTestOpen":
                    result=is_test_open(body.get("testType",""))
                elif api=="getMotivationQuestions":
                    result=get_motivation_questions()
                elif api=="submitMotivation":
                    result=submit_motivation(body)
                elif api=="getMotivationResult":
                    result=get_motivation_result(body)
                elif api=="getComments":
                    result=get_comments(body)
                elif api=="addComment":
                    result=add_comment(body)
                elif api=="getRecap":
                    result=get_recap()
                elif api=="toggleTest":
                    result=toggle_test(body)
                elif api=="manageAccessCode":
                    action=body.get("action","list")
                    if action=="list":
                        result={"success": True, "data": get_all_rows("class_config")}
                    elif action in ["create","add"]:
                        kelas=body.get("kelas"); code=body.get("code")
                        if not kelas or not code:
                            result={"success": False, "message": "kelas & code wajib"}
                        elif find_row("class_config","access_code",code):
                            result={"success": False, "message": "Kode sudah ada"}
                        elif find_row("class_config","kelas",kelas):
                            result={"success": False, "message": "Kelas sudah ada, gunakan update"}
                        else:
                            insert_row("class_config",{"id":get_next_id("class_config"),"kelas":kelas,"access_code":code,"is_eksperimen":True,"max_students":30})
                            result={"success": True, "message": "Kode akses dibuat"}
                    elif action=="update":
                        r=find_row("class_config","kelas",body.get("kelas"))
                        if not r:
                            result={"success": False, "message": "Kelas tidak ditemukan"}
                        else:
                            update_row("class_config",r["_rowIndex"],{"access_code":body.get("code")})
                            result={"success": True, "message": "Kode updated"}
                    elif action=="delete":
                        r=find_row("class_config","kelas",body.get("kelas"))
                        if not r:
                            result={"success": False, "message": "Kelas tidak ditemukan"}
                        else:
                            delete_row("class_config",r["_rowIndex"])
                            result={"success": True, "message": "Kelas dihapus"}
                elif api=="exportHasilBelajar":
                    result=export_hasil()
                elif api=="exportButirSoal":
                    result=export_butir()
                elif api=="exportMotivasi":
                    result=export_motivasi()
                elif api=="markComplete":
                    uid=body.get("userId"); mid=body.get("materialId")
                    if not uid or not mid:
                        result={"success": False, "message": "userId & materialId wajib"}
                    else:
                        insert_row("activity_logs",{"id":get_next_id("activity_logs"),"user_id":uid,"action":"view_materi","target_id":mid,"timestamp":now_iso()})
                        result={"success": True, "message": "Progress dicatat"}
                elif api=="submitTask":
                    uid=body.get("userId"); pid=body.get("pblPhaseId"); blob=body.get("fileBlob")
                    if not uid or not pid:
                        result={"success": False, "message": "userId & pblPhaseId wajib"}
                    elif not blob or not blob.get("bytes"):
                        result={"success": False, "message": "File wajib"}
                    else:
                        import base64
                        b64=blob.get("bytes")
                        try:
                            data_bytes=base64.b64decode(b64)
                        except:
                            result={"success": False, "message": "Base64 invalid"}
                            data_bytes=None
                        if data_bytes is not None:
                            if len(data_bytes)>5*1024*1024:
                                result={"success": False, "message": "File max 5MB"}
                            else:
                                filename=blob.get("filename","tugas")
                                ext=filename.split(".")[-1].lower() if "." in filename else ""
                                if ext not in ["pdf","doc","docx","jpg","jpeg","png"]:
                                    result={"success": False, "message": "Format harus PDF/DOC/JPG/PNG"}
                                else:
                                    import time
                                    safe=str(int(time.time()))+"_"+re.sub(r"[^a-zA-Z0-9._-]","_",filename)
                                    fp=os.path.join(UPLOAD_DIR,safe)
                                    with open(fp,"wb") as f:
                                        f.write(data_bytes)
                                    file_url="/uploads/"+safe
                                    nid=get_next_id("task_submissions")
                                    insert_row("task_submissions",{"id":nid,"user_id":uid,"pbl_phase_id":pid,"file_url":file_url,"score":"","feedback":"","submitted_at":now_iso()})
                                    insert_row("activity_logs",{"id":get_next_id("activity_logs"),"user_id":uid,"action":"submit_tugas","target_id":pid,"timestamp":now_iso()})
                                    result={"success": True, "message": "Tugas berhasil diupload", "file_url": file_url, "id": nid}
                else:
                    result={"success": False, "message": f"API not found {api}"}
            except Exception as e:
                result={"success": False, "message": str(e)}
            # normalize isTestOpen bool
            if api=="isTestOpen" and isinstance(result,bool):
                result={"success": True, "isOpen": result}
            self.send_response(200)
            self.send_header("Content-Type","application/json")
            self.send_header("Access-Control-Allow-Origin","*")
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode())
            return
        # not api
        self.send_response(404)
        self.end_headers()

def render_template(file_path, query):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    nis = query.get("nis","")
    user = get_current_user(nis)
    # 1) includes
    def inc_repl(m):
        inc = m.group(1)
        # try resolve
        candidates = []
        candidates.append(os.path.join(ROOT, inc))
        candidates.append(os.path.join(ROOT, inc + ".html"))
        candidates.append(os.path.join(ROOT, inc + ".css"))
        candidates.append(os.path.join(ROOT, "Components", os.path.basename(inc) + ".html"))
        candidates.append(os.path.join(ROOT, "Styles", os.path.basename(inc) + ".html"))
        candidates.append(os.path.join(ROOT, "Styles", os.path.basename(inc) + ".css"))
        candidates.append(os.path.join(ROOT, "Styles", "Main.html"))
        candidates.append(os.path.join(ROOT, "Styles", "Main.css"))
        for cand in candidates:
            if os.path.exists(cand):
                with open(cand, "r", encoding="utf-8") as inc_f:
                    return inc_f.read()
        return f"<!-- include not found {inc} -->"
    content = re.sub(r"<\?!= *include\(['\"]([^'\"]+)['\"]\) *\?>", inc_repl, content)

    # 2) <?= expr ?>
    def expr_repl(m):
        expr = m.group(1)
        try:
            # provide JSON as json module
            # use eval with limited globals
            # create context
            params = query
            currentNis = nis
            currentUser = user
            # allow JSON.stringify -> json.dumps
            # replace JSON.stringify with json.dumps for python eval
            # Instead we try to evaluate as python-like? Use simple handling:
            # For JS expressions like "currentNis || ''" -> python "currentNis or ''"
            # But easier: try to evaluate via JS-like: replace || with or, etc. Simpler: handle known patterns
            # Known patterns:
            #  currentNis || ''
            #  currentUser ? JSON.stringify(currentUser) : 'null'
            #  params ? JSON.stringify(params) : '{}'
            # We'll handle those explicitly
            if "JSON.stringify" in expr:
                if "currentUser" in expr:
                    return json.dumps(user) if user else "null"
                if "params" in expr:
                    return json.dumps(query)
                return "null"
            # generic: try python eval after replacing || and && and ?:
            # Replace JS || with or, && with and, ! with not (careful)
            # For simple currentNis, just return it
            if expr.strip() == "currentNis || ''" or expr.strip() == "currentNis":
                return str(nis)
            # Fallback: try to eval as python
            # Replace JS ternary: a ? b : c -> (b if a else c)  (very rough, only for JSON.stringify case already handled)
            return str(eval(expr, {"currentNis": nis, "currentUser": user, "params": query, "JSON": json}))
        except Exception as e:
            return ""
    content = re.sub(r"<\?= *([^?]+?) *\?>", expr_repl, content)
    # 3) remove remaining <? ... ?>
    content = re.sub(r"<\?[^=][\s\S]*?\?>", "", content)

    # 4) inject polyfill
    polyfill = """<script>
window.google = window.google || {};
google.script = google.script || {};
(function(){
  const map = {
    register: '/api/register',
    login: '/api/login',
    logout: '/api/logout',
    getCurrentUser: '/api/getCurrentUser',
    getMaterials: '/api/getMaterials',
    getMaterialById: '/api/getMaterialById',
    getPblPhases: '/api/getPblPhases',
    getPblPhaseById: '/api/getPblPhaseById',
    getQuestions: '/api/getQuestions',
    submitTest: '/api/submitTest',
    getTestResult: '/api/getTestResult',
    isTestOpen: '/api/isTestOpen',
    getMotivationQuestions: '/api/getMotivationQuestions',
    submitMotivation: '/api/submitMotivation',
    getMotivationResult: '/api/getMotivationResult',
    getComments: '/api/getComments',
    addComment: '/api/addComment',
    getRecap: '/api/getRecap',
    toggleTest: '/api/toggleTest',
    manageAccessCode: '/api/manageAccessCode',
    exportHasilBelajar: '/api/exportHasilBelajar',
    exportButirSoal: '/api/exportButirSoal',
    exportMotivasi: '/api/exportMotivasi',
    submitTask: '/api/submitTask',
    markComplete: '/api/markComplete'
  };
  function createApi(successCb,failureCb){
    return new Proxy({},{
      get(_,prop){
        if(prop==='withSuccessHandler') return (cb)=> createApi(cb,failureCb);
        if(prop==='withFailureHandler') return (cb)=> createApi(successCb,cb);
        return (...args)=>{
          const endpoint = map[prop] || ('/api/'+prop);
          let body={};
          if(prop==='register') body={nis:args[0],nama:args[1],password:args[2],confirmPassword:args[3],accessCode:args[4]};
          else if(prop==='login') body={nis:args[0],password:args[1]};
          else if(prop==='logout') body={nis:args[0]};
          else if(prop==='getCurrentUser') body={nis:args[0]};
          else if(prop==='getMaterialById') body={id:args[0]};
          else if(prop==='getPblPhaseById') body={id:args[0]};
          else if(prop==='getQuestions') body={testType:args[0]};
          else if(prop==='submitTest'){
            if(args.length===1 && typeof args[0]==='object' && args[0].answers) body=args[0];
            else if(args.length===3) body={userId:args[0],testType:args[1],answers:args[2]};
            else body=args[0]||{};
          }
          else if(prop==='getTestResult') body={userId:args[0],testType:args[1]};
          else if(prop==='isTestOpen') body={testType:args[0]};
          else if(prop==='submitMotivation'){
            if(args.length===1) body=args[0]; else body={userId:args[0],responses:args[1]};
          }
          else if(prop==='getMotivationResult') body={userId:args[0]};
          else if(prop==='getComments') body={materialId:args[0]};
          else if(prop==='addComment'){
            if(args.length===1) body=args[0]; else body={userId:args[0],materialId:args[1],content:args[2],parentId:args[3]};
          }
          else if(prop==='toggleTest') body={testType:args[0],isOpen:args[1]};
          else if(prop==='manageAccessCode') body={action:args[0],kelas:args[1],code:args[2]};
          else if(prop==='submitTask'){
            if(args.length===1) body=args[0]; else body={userId:args[0],pblPhaseId:args[1],fileBlob:args[2]};
          }
          else if(prop==='markComplete') body={userId:args[0],materialId:args[1]};
          else body=args[0]||{};
          fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
            .then(r=>r.json())
            .then(data=>{ if(successCb) successCb(data); })
            .catch(err=>{ if(failureCb) failureCb(err); else console.error(err); });
          return createApi(successCb,failureCb);
        };
      }
    });
  }
  google.script.run = createApi(null,null);
})();
</script>"""
    content = content.replace("</body>", polyfill + "</body>")
    return content

if __name__ == "__main__":
    server_address = ("", PORT)
    httpd = http.server.HTTPServer(server_address, Handler)
    print(f"✅ Weblog DDK Local (Python) running at http://localhost:{PORT}")
    print(f"   Register: http://localhost:{PORT}/?page=register")
    print(f"   Login:    http://localhost:{PORT}/?page=login")
    print(f"   Guru:     GURU001 / guru123  (ADMIN001 / admin123)")
    print(f"   Siswa:    daftar DDK2025-EKS (X TITL 1, kuota 30)")
    print(f"   DB:       {DB_PATH}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        httpd.server_close()
