# 📋 Pendataan Mahasiswa — Google Apps Script Web App

Web app sederhana berbasis **Google Apps Script** untuk pendataan mahasiswa dengan validasi email terhadap **Google Classroom**, penyimpanan otomatis ke **Google Sheets**, dan **panel admin** untuk membuka/menutup survey tanpa perlu deploy ulang.

---

## 📑 Daftar Isi

1. [Fitur Utama](#-fitur-utama)
2. [Arsitektur & Alur Routing](#-arsitektur--alur-routing)
3. [Struktur File](#-struktur-file)
4. [Prasyarat](#-prasyarat)
5. [Langkah Instalasi (Build from Scratch)](#-langkah-instalasi-build-from-scratch)
6. [Konfigurasi Akun Admin](#-konfigurasi-akun-admin)
7. [Cara Mengganti Email / Password Admin](#-cara-mengganti-email--password-admin)
8. [Cara Deploy & Update Versi](#-cara-deploy--update-versi)
9. [Cara Menggunakan Panel Admin](#-cara-menggunakan-panel-admin)
10. [Struktur Data di Spreadsheet](#-struktur-data-di-spreadsheet)
11. [Catatan Keamanan](#-catatan-keamanan)
12. [Troubleshooting](#-troubleshooting)
13. [FAQ](#-faq)

---

## ✨ Fitur Utama

- ✅ **Form pendataan mahasiswa** — input email, NIM, nama, angkatan, jurusan, kelas.
- ✅ **Validasi email ke Google Classroom** — hanya email yang terdaftar di kelas aktif yang bisa submit.
- ✅ **Anti-duplikat** — satu email hanya bisa mendaftar satu kali.
- ✅ **Penyimpanan otomatis** ke Google Sheets (tab `DataMahasiswa`).
- ✅ **Panel admin** — buka/tutup survey tanpa perlu edit kode atau deploy ulang.
- ✅ **Sesi admin ber-timer** — token expire otomatis 30 menit.
- ✅ **Anti brute force** — login gagal 5x dikunci 15 menit.
- ✅ **Kredensial aman** — email & password admin disimpan di **Script Properties**, bukan di kode sumber.

---

## 🗺 Arsitektur & Alur Routing

Aplikasi menggunakan **satu URL deployment** dengan parameter `?page=` untuk routing:

```
┌─────────────────────────────────────────────────────────────┐
│  URL Deployment (contoh):                                   │
│  https://script.google.com/macros/s/XXXXX/exec              │
└─────────────────────────────────────────────────────────────┘
              │
              ├── TANPA parameter
              │   → doGet(e) → page = ''
              │   → render Formulir.html   (form mahasiswa)
              │
              └── ?page=admin
                  → doGet(e) → page = 'admin'
                  → render Admin.html     (panel admin)
```

### Alur `doGet(e)` di `Code.gs`

```javascript
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) ? e.parameter.page : '';

  if (page === 'admin') {
    return HtmlService.createHtmlOutputFromFile('Admin')...;
  }

  return HtmlService.createHtmlOutputFromFile('Formulir')...;
}
```

### Alur Proses Submit Form Mahasiswa

```
Formulir.html (isi form)
        │
        ▼
google.script.run.prosesFormMahasiswa(data)
        │
        ▼
┌──────────────────────────────────────┐
│ 1. Cek isSurveyClosed()              │  ← baca dari Sheet "Config"
│    Jika ditutup → return error       │
├──────────────────────────────────────┤
│ 2. Cek email sudah terdaftar?        │  ← baca Sheet "DataMahasiswa"
│    Jika ya → return error            │
├──────────────────────────────────────┤
│ 3. Ambil email dari Classroom API    │  ← Classroom.Courses.Students.list()
│    Jika email tidak ada → return err │
├──────────────────────────────────────┤
│ 4. Simpan ke Sheet "DataMahasiswa"   │
│    → return success                  │
└──────────────────────────────────────┘
```

### Alur Admin Toggle Status

```
Admin.html → login(email, password)
        │
        ▼
adminLogin() → validasi ke Script Properties
        │
        ├── gagal → catat failCount di CacheService
        │            (maks 5x, kunci 15 menit)
        │
        └── sukses → buat UUID token
                     simpan di CacheService (TTL 30 menit)
                     return token ke client
        │
        ▼
Admin.html simpan TOKEN di variabel JS (tidak di localStorage)
        │
        ▼
Klik "Buka/Tutup Survey" → adminSetStatus(token, closed)
        │
        ▼
validateToken_(token) → jika valid → setSurveyClosed_(closed)
        │
        ▼
Update Sheet "Config" → refresh halaman formulir → status baru tampil
```

---

## 📁 Struktur File

```
📦 project-root/
├── Code.gs          # Logika server: routing, admin API, Classroom, Sheets
├── Admin.html       # UI panel admin (login + toggle status)
└── Formulir.html    # UI form pendataan mahasiswa
```

### Penjelasan Singkat Tiap File

| File | Isi |
|---|---|
| `Code.gs` | `doGet`, `adminLogin`, `adminSetStatus`, `isSurveyClosed`, `prosesFormMahasiswa`, helper token & config |
| `Admin.html` | Form login admin, tombol buka/tutup survey, timer sesi, auto-logout |
| `Formulir.html` | Form input mahasiswa, panggil `prosesFormMahasiswa` |

---

## 🧩 Prasyarat

Sebelum memulai, pastikan Anda punya:

1. **Akun Google** dengan akses ke **Google Classroom** (sebagai pengajar).
2. **Google Spreadsheet** baru (sebagai database).
3. **Google Apps Script** project yang terhubung ke spreadsheet tersebut.
4. **Classroom API** harus **diaktifkan** di Apps Script (lihat langkah di bawah).
5. Browser modern (Chrome/Edge/Firefox).

---

## 🚀 Langkah Instalasi (Build from Scratch)

### Langkah 1 — Buat Spreadsheet

1. Buka [sheets.new](https://sheets.new) → buat spreadsheet baru.
2. Beri nama, misal: **"Database Pendataan Mahasiswa"**.
3. (Opsional) Buat sheet kosong bernama `DataMahasiswa` dan `Config` — **tidak wajib**, akan dibuat otomatis oleh script.

### Langkah 2 — Buka Apps Script dari Spreadsheet

1. Di spreadsheet: menu **Extensions → Apps Script**.
2. Akan terbuka editor Apps Script baru.

### Langkah 3 — Aktifkan Classroom API

1. Di editor Apps Script, klik **Services (+)** di sidebar kiri.
2. Pilih **Classroom API** → klik **Add**.
3. (Jika diminta) aktifkan juga **Google Classroom API** di Google Cloud Console.
4. Ini wajib agar `Classroom.Courses.list()` bisa dipanggil.

### Langkah 4 — Buat File Script & HTML

Di editor Apps Script:

1. **File → New → Script** → beri nama `Code` → paste isi `Code.gs`.
2. **File → New → HTML** → beri nama `Admin` → paste isi `Admin.html`.
3. **File → New → HTML** → beri nama `Formulir` → paste isi `Formulir.html`.

> ⚠️ Nama file **harus persis** `Code`, `Admin`, `Formulir` (case-sensitive) karena dipanggil di `doGet`.

### Langkah 5 — Konfigurasi Akun Admin

**Ini langkah paling penting.** Lihat bagian [Konfigurasi Akun Admin](#-konfigurasi-akun-admin).

### Langkah 6 — Deploy Web App

1. Klik **Deploy → New deployment**.
2. Pilih tipe: **Web app**.
3. Isi:
   - **Description**: `v1 - initial deploy`
   - **Execute as**: **Me (email Anda)**
   - **Who has access**: **Anyone** (agar mahasiswa bisa akses tanpa login Google)
4. Klik **Deploy** → **Authorize access** → izinkan semua scope.
5. Copy **Web app URL** — inilah URL yang dibagikan ke mahasiswa.

### Langkah 7 — Uji Coba

| Aksi | URL |
|---|---|
| Buka form mahasiswa | `https://script.google.com/macros/s/XXXX/exec` |
| Buka panel admin | `https://script.google.com/macros/s/XXXX/exec?page=admin` |

---

## 🔐 Konfigurasi Akun Admin

Akun admin **TIDAK** disimpan di file `Code.gs` atau `Admin.html`. Disimpan di **Script Properties** — fitur bawaan Apps Script yang terpisah dari kode.

### Langkah Setup

1. Buka editor Apps Script.
2. Klik ikon **⚙️ Project Settings** di sidebar kiri.
3. Scroll ke bagian **Script Properties**.
4. Klik **Add script property** → tambahkan **dua** baris:

| Property | Value |
|---|---|
| `ADMIN_EMAIL` | `adeclintonsitepu.dosen@gmail.com` |
| `ADMIN_PASSWORD` | `<password-anda-yang-kuat>` |

5. Klik **Save script properties**.

### Kenapa di Script Properties?

- ✅ Tidak muncul di source code (aman dari orang yang buka editor).
- ✅ Bisa diganti **tanpa deploy ulang**.
- ✅ Hanya terlihat oleh **owner** project Apps Script.
- ✅ Terenkripsi di sisi Google.

---

## 🔑 Cara Mengganti Email / Password Admin

### Kapan Perlu Ganti?

- Password lama bocor / tidak aman.
- Ganti admin ke orang lain.
- Rotasi password rutin (best practice).

### Langkah Ganti Password

1. Buka spreadsheet → **Extensions → Apps Script**.
2. Klik **⚙️ Project Settings**.
3. Scroll ke **Script Properties**.
4. Cari baris `ADMIN_PASSWORD`.
5. Klik ikon **✏️ (edit)** di kanan baris tersebut.
6. Ubah nilainya, contoh: `admin1234` → `PasswordBaruKuat2025!`
7. Klik **Save script properties**.
8. **Selesai.** Tidak perlu deploy ulang.

### Langkah Ganti Email Admin

Sama seperti di atas, tapi edit baris `ADMIN_EMAIL`.

### Langkah Menambah Admin Kedua (Opsional)

Saat ini kode hanya mendukung **satu** admin. Jika ingin multi-admin, ubah `getAdminCredentials_()` di `Code.gs` menjadi array:

```javascript
function getAdminCredentials_() {
  var props = PropertiesService.getScriptProperties();
  return [
    { email: props.getProperty('ADMIN_EMAIL'),   password: props.getProperty('ADMIN_PASSWORD') },
    { email: props.getProperty('ADMIN2_EMAIL'), password: props.getProperty('ADMIN2_PASSWORD') }
  ];
}
```

Lalu di `adminLogin`, loop array tersebut.

### ⚠️ Yang Harus Dihindari

| ❌ JANGAN | ✅ SEBAIKNYA |
|---|---|
| `var ADMIN_PASSWORD = 'admin1234';` di `Code.gs` | Simpan di Script Properties |
| `<input value="admin1234" type="hidden">` di HTML | Form login, verifikasi di server |
| Password di `README.md` publik | Ganti dulu sebelum push ke repo publik |

> 💡 **Tips GitHub**: Jika repo Anda publik, **jangan** commit password asli. Ganti placeholder dulu, atau jadikan repo private.

---

## 🚢 Cara Deploy & Update Versi

### Deploy Pertama Kali

Lihat [Langkah 6 — Deploy Web App](#langkah-6--deploy-web-app).

### Update Kode (Setelah Edit File)

1. Edit file di Apps Script (misal ubah `Code.gs`).
2. Klik **Deploy → Manage deployments**.
3. Klik ikon **✏️ (edit)** pada deployment aktif.
4. Di dropdown **Version**, pilih **New version**.
5. Klik **Deploy**.
6. **URL tetap sama**, tidak perlu ganti link di manapun.

### Update Konfigurasi Admin (Tanpa Deploy)

Ganti email/password → cukup edit **Script Properties** → **tidak perlu deploy**.

### Rollback ke Versi Lama

1. **Deploy → Manage deployments** → edit.
2. Pilih **Version** lama dari dropdown.
3. Klik **Deploy**.

---

## 🖥 Cara Menggunakan Panel Admin

### Akses Panel

Buka: `https://script.google.com/macros/s/XXXX/exec?page=admin`

### Login

1. Masukkan **email admin** dan **password** sesuai Script Properties.
2. Klik **Login**.
3. Jika berhasil → muncul panel dengan status survey.

### Toggle Status Survey

| Tombol | Fungsi |
|---|---|
| 🟢 **Buka Survey** | Mahasiswa bisa submit form |
| 🔴 **Tutup Survey** | Form mahasiswa disembunyikan, tampil notice "Survey Ditutup" |

Status berubah **real-time** — mahasiswa yang me-refresh halaman formulir akan langsung melihat status baru.

### Timer Sesi

- Sesi admin aktif **30 menit** sejak login.
- Timer countdown tampil di bawah tombol.
- Setelah 30 menit → auto-logout, harus login ulang.
- Klik **Logout** untuk keluar lebih awal.

### Anti Brute Force

- Salah password **5x** → akun dikunci **15 menit**.
- Setelah 15 menit, bisa coba lagi.

---

## 📊 Struktur Data di Spreadsheet

### Sheet `DataMahasiswa`

Dibuat otomatis saat submit pertama.

| Kolom | Header | Keterangan |
|---|---|---|
| A | Timestamp | Waktu submit (`new Date()`) |
| B | Email Classroom | Email terverifikasi (lowercase) |
| C | NIM | NIM mahasiswa |
| D | Nama | Nama lengkap |
| E | Angkatan | Tahun masuk (2022–2026) |
| F | Jurusan | Nama jurusan |
| G | Kelas | Karyawan / Reguler |

### Sheet `Config`

Dibuat otomatis saat pertama kali cek status.

| Kolom | Header | Keterangan |
|---|---|---|
| A | Key | Nama konfigurasi |
| B | Value | Nilai konfigurasi |

Contoh isi:

| Key | Value |
|---|---|
| `SURVEY_IS_CLOSED` | `true` atau `false` |

> ⚠️ **Jangan edit manual** sheet `Config` kecuali dalam keadaan darurat. Gunakan panel admin agar konsisten.

---

## 🛡 Catatan Keamanan

| Aspek | Implementasi |
|---|---|
| **Password admin** | Disimpan di **Script Properties** (tidak di source code) |
| **Token sesi** | UUID random + `CacheService`, expire **30 menit** |
| **Brute force** | Kunci 15 menit setelah **5x gagal** |
| **Logout** | Revoke token di server (`adminLogout`) |
| **Akses admin** | Wajib login dengan email + password yang benar |
| **Validasi email mahasiswa** | Dicek ke Classroom API (bukan hanya format email) |
| **Anti-duplikat** | Scan kolom B sheet `DataMahasiswa` sebelum insert |

### Rekomendasi Tambahan

1. **Spreadsheet** hanya di-share ke owner (Anda) — jangan beri akses edit ke orang lain.
2. **Repo GitHub** — jika publik, ganti password placeholder di README.
3. **Rotasi password** secara berkala (3–6 bulan sekali).
4. **Audit log** — pantau Sheet `DataMahasiswa` untuk aktivitas mencurigakan.
5. **Backup** — duplikat spreadsheet secara berkala (File → Make a copy).

### Keterbatasan yang Diketahui

- Token disimpan di **memori JS** (hilang saat refresh) — ini **by design**, memaksa login ulang.
- `CacheService` punya limit **6 jam** maksimal — kita pakai 30 menit, aman.
- Jika Apps Script di-edit oleh orang lain, Script Properties **bisa dilihat** — pastikan tidak menambah kolaborator editor.

---

## 🔧 Troubleshooting

### ❌ "Terjadi kesalahan sistem: ..."

**Penyebab**: Error di server (`Code.gs`).

**Solusi**:
1. Buka Apps Script → **Executions** → lihat log error terakhir.
2. Cek apakah Classroom API sudah diaktifkan (**Services → Classroom API**).
3. Pastikan sheet `DataMahasiswa` dan `Config` tidak dihapus manual.

### ❌ "Akses Ditolak: Email tidak terdaftar di Google Classroom"

**Penyebab**: Email mahasiswa tidak ada di kelas aktif yang Anda ajar.

**Solusi**:
1. Cek di [classroom.google.com](https://classroom.google.com) — pastikan email mahasiswa sudah join kelas.
2. Pastikan status kelas **ACTIVE** (bukan archived).
3. Pastikan Anda login sebagai **guru** di kelas tersebut.

### ❌ "Konfigurasi admin belum diatur di Script Properties"

**Penyebab**: Script Properties `ADMIN_EMAIL` / `ADMIN_PASSWORD` belum diisi.

**Solusi**: Lihat [Konfigurasi Akun Admin](#-konfigurasi-akun-admin).

### ❌ "Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit."

**Penyebab**: Login gagal 5x.

**Solusi**: Tunggu 15 menit, atau (untuk reset paksa) buka Apps Script → jalankan fungsi manual:

```javascript
function resetLoginLock() {
  CacheService.getScriptCache().remove('login_fail_adeclintonsitepu.dosen@gmail.com');
}
```

### ❌ Halaman admin blank / error 404

**Penyebab**: Parameter URL salah atau file `Admin.html` belum dibuat.

**Solusi**:
1. Pastikan URL diakhiri `?page=admin` (bukan `&page=admin`).
2. Pastikan file HTML bernama persis `Admin` di Apps Script.

### ❌ Form mahasiswa tetap tampil padahal sudah ditutup

**Penyebab**: Cache browser.

**Solusi**: Hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`). Status dibaca saat halaman dimuat, bukan real-time push.

### ❌ Submit form sukses tapi data tidak muncul di sheet

**Penyebab**: Sheet `DataMahasiswa` dihapus/rename.

**Solusi**: Rename balik ke `DataMahasiswa`, atau hapus sheet-nya agar dibuat ulang otomatis saat submit berikutnya.

---

## ❓ FAQ

**Q: Apakah mahasiswa perlu login Google untuk mengisi form?**
A: **Tidak.** Deployment diatur `Execute as: Me` + `Who has access: Anyone`, jadi mahasiswa bisa akses tanpa login. Validasi tetap dilakukan terhadap email yang diinput vs daftar email Classroom.

**Q: Apakah bisa multi-admin?**
A: Belum secara default. Lihat [Langkah Menambah Admin Kedua](#langkah-menambah-admin-kedua-opsional) untuk modifikasi.

**Q: Apakah password admin bisa dilihat orang lain?**
A: Tidak, selama **hanya Anda** yang punya akses edit ke project Apps Script. Jika Anda menambah kolaborator editor, mereka bisa lihat Script Properties.

**Q: Bagaimana cara reset semua data mahasiswa?**
A: Buka spreadsheet → hapus isi sheet `DataMahasiswa` (sisakan header). Jangan hapus sheet-nya.

**Q: Bagaimana cara backup data?**
A: File → **Make a copy** di spreadsheet, atau **File → Download → Microsoft Excel (.xlsx)**.

**Q: Apakah token admin bisa dipakai di device lain?**
A: Token disimpan di memori JS browser, tidak di localStorage. Jadi **tidak bisa** dipindah ke device lain — ini fitur keamanan.

**Q: Bagaimana jika lupa password admin?**
A: Buka Apps Script → **Project Settings → Script Properties** → lihat/edit `ADMIN_PASSWORD`. Anda sebagai owner selalu bisa melihatnya.

**Q: Apakah bisa mengganti jurusan/angkatan yang ada di dropdown?**
A: Ya, edit `Formulir.html` bagian `<select id="jurusan">` atau `<select id="angkatan">`, lalu **deploy versi baru**.

**Q: Apakah data mahasiswa bisa diedit setelah submit?**
A: Tidak via form (karena anti-duplikat). Edit manual di spreadsheet jika perlu koreksi.

---

## 📝 Lisensi

Bebas digunakan untuk keperluan internal kampus/pendidikan.

---

## 👤 Author

**Ade Clinton Sitepu**
📧 adeclintonsitepu.dosen@gmail.com