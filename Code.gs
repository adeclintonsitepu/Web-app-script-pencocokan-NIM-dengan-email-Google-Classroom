var SURVEY_IS_CLOSED = true;

function isSurveyClosed() {
  return SURVEY_IS_CLOSED === true;
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Formulir')
      .setTitle('Form Pendataan Mahasiswa - Google Classroom')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Fungsi untuk mengambil semua email siswa dari 3 kelas Classroom Anda
 */
function getDaftarEmailClassroom() {
  var listEmailClassroom = [];
  try {
    var response = Classroom.Courses.list({ teacherId: 'me', courseStates: ['ACTIVE'] });
    var courses = response.courses;
    
    if (courses && courses.length > 0) {
      for (var i = 0; i < courses.length; i++) {
        var courseId = courses[i].id;
        var pageToken = null;
        do {
          var studentsResponse = Classroom.Courses.Students.list(courseId, { pageToken: pageToken });
          var students = studentsResponse.students;
          
          if (students && students.length > 0) {
            for (var j = 0; j < students.length; j++) {
              var email = students[j].profile.emailAddress.toLowerCase();
              if (listEmailClassroom.indexOf(email) === -1) {
                listEmailClassroom.push(email);
              }
            }
          }
          pageToken = studentsResponse.nextPageToken;
        } while (pageToken);
      }
    }
  } catch (err) {
    Logger.log("Error Classroom: " + err.message);
  }
  return listEmailClassroom;
}

/**
 * Fungsi yang dipanggil dari halaman web saat mahasiswa menekan tombol Submit
 */
function prosesFormMahasiswa(data) {
  if (isSurveyClosed()) {
    return {
      status: 'error',
      pesan: 'Survey Pendataan Telah Ditutup. Pendaftaran sudah ditutup dan tidak dapat dilanjutkan.'
    };
  }

  var emailInput = String(data.email).trim().toLowerCase();
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DataMahasiswa");
  
  // Jika tab DataMahasiswa belum ada, buat otomatis
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("DataMahasiswa");
    sheet.appendRow(["Timestamp", "Email Classroom", "NIM", "Nama", "Angkatan", "Jurusan", "Kelas"]);
  }
  
  // 1. CEK APAKAH EMAIL SUDAH PERNAH TERCATAT SEBELUMNYA
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    // Ambil seluruh data di kolom B (Kolom ke-2 adalah Email Classroom) mulai baris 2
    var emailTerdaftarRange = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    
    for (var i = 0; i < emailTerdaftarRange.length; i++) {
      var emailLama = String(emailTerdaftarRange[i][0]).trim().toLowerCase();
      if (emailLama === emailInput) {
        return {
          status: "error",
          pesan: "Gagal: Email '" + emailInput + "' dan data ini sudah tercatat di database."
        };
      }
    }
  }
  
  // 2. Tarik data email dari Classroom untuk divalidasi keaktifannya
  var emailValid = getDaftarEmailClassroom();
  
  // 3. Cek apakah email ada di Classroom
  if (emailValid.indexOf(emailInput) === -1) {
    return {
      status: "error",
      pesan: "Akses Ditolak: Email '" + emailInput + "' tidak terdaftar di Google Classroom kelas saya. Gunakan email yang benar!"
    };
  }
  
  // 4. Jika valid dan belum pernah dikirim, simpan ke Google Sheets
  sheet.appendRow([
    new Date(),
    emailInput,
    data.nim,
    data.nama,
    data.angkatan,
    data.jurusan,
    data.kelas
  ]);
  
  return {
    status: "success",
    pesan: "Berhasil! Data Anda telah tersimpan dan email terverifikasi."
  };
}