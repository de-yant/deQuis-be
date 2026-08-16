import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db, schema } from '../server/db'
import { hashPassword } from '../server/auth/password'

async function main() {
  console.log('Seeding deQuis...')

  const admin = await db
    .insert(schema.users)
    .values({
      email: 'admin@haryantolabs.com',
      passwordHash: hashPassword('admin123'),
      name: 'Super Admin',
      role: 'SUPER_ADMIN'
    })
    .onConflictDoNothing()
    .returning()
  const adminId = admin[0]?.id

  const teacher = await db
    .insert(schema.users)
    .values({
      email: 'guru@haryantolabs.com',
      passwordHash: hashPassword('guru123'),
      name: 'Guru Informatika',
      role: 'TEACHER'
    })
    .onConflictDoNothing()
    .returning()
  let teacherId = teacher[0]?.id
  if (!teacherId) {
    const found = await db.select().from(schema.users).where(sql`${schema.users.email} = 'guru@haryantolabs.com'`).limit(1)
    teacherId = found[0]?.id
  }

  const classRows = await db.select().from(schema.classes)
  if (classRows.length === 0) {
    await db
      .insert(schema.classes)
      .values([
        { name: 'XII RPL 1', academicYear: '2026/2027' },
        { name: 'XII RPL 2', academicYear: '2026/2027' },
        { name: 'XII TKJ 1', academicYear: '2026/2027' }
      ])
    classRows.push(...(await db.select().from(schema.classes)))
  }
  const classById = new Map(classRows.map((c) => [c.name, c.id]))

  if (teacherId) {
    for (const c of classRows) {
      await db.insert(schema.teacherClasses).values({ teacherId, classId: c.id }).onConflictDoNothing()
    }
  }

  let subjects = await db
    .insert(schema.subjects)
    .values([
      { code: 'INF', name: 'Informatika', accessCode: 'INF2026', createdBy: adminId },
      { code: 'MTK', name: 'Matematika', accessCode: 'MTK2026', createdBy: adminId },
      { code: 'FIS', name: 'Fisika', accessCode: 'FIS2026', createdBy: adminId }
    ])
    .onConflictDoNothing()
    .returning()
  if (subjects.length === 0) {
    subjects = await db.select().from(schema.subjects)
  }
  const subjectById = new Map(subjects.map((s) => [s.code, s.id]))

  const sampleStudents = [
    { nisn: '0012345678', name: 'Ahmad Fauzan', cls: 'XII RPL 1' },
    { nisn: '0012345679', name: 'Budi Santoso', cls: 'XII RPL 1' },
    { nisn: '0012345680', name: 'Citra Lestari', cls: 'XII RPL 1' },
    { nisn: '0012345681', name: 'Dewi Anggraini', cls: 'XII RPL 2' },
    { nisn: '0012345682', name: 'Eko Prasetyo', cls: 'XII RPL 2' },
    { nisn: '0012345683', name: 'Fitri Handayani', cls: 'XII TKJ 1' }
  ]

  const studentIds: number[] = []
  for (const s of sampleStudents) {
    const classId = classById.get(s.cls)
    if (!classId) continue
    const inserted = await db
      .insert(schema.students)
      .values({ nisn: s.nisn, name: s.name, classId })
      .onConflictDoNothing()
      .returning()
    if (inserted[0]) {
      studentIds.push(inserted[0].id)
    } else {
      const found = await db.select().from(schema.students).where(sql`${schema.students.nisn} = ${s.nisn}`).limit(1)
      if (found[0]) studentIds.push(found[0].id)
    }
  }

  const quizData: Array<{
    code: string
    title: string
    topic: string
    order: number
    isFinal?: boolean
    questions: Array<[string, string, string, string, string, string, number]>
  }> = [
    {
      code: 'INF',
      title: 'Algoritma Dasar',
      topic: 'Algoritma & Pemrograman',
      order: 1,
      questions: [
        ['Algoritma adalah ...', 'Urutan langkah logis untuk menyelesaikan masalah', 'Nama lain dari program', 'Bahasa pemrograman', 'Perangkat keras komputer', 'A', 10],
        ['Struktur data LIFO (Last In First Out) disebut ...', 'Queue', 'Stack', 'Array', 'Tree', 'B', 10],
        ['Bahasa pemrograman untuk web yang berjalan di browser adalah ...', 'Python', 'Java', 'JavaScript', 'C++', 'C', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Jaringan Komputer',
      topic: 'Jaringan',
      order: 2,
      questions: [
        ['Kepanjangan LAN adalah ...', 'Local Area Network', 'Large Area Network', 'Local Access Network', 'Line Area Network', 'A', 10],
        ['Alat yang digunakan untuk menghubungkan beberapa komputer dalam LAN adalah ...', 'Router', 'Switch', 'Modem', 'Server', 'B', 10],
        ['Protokol yang mengamankan komunikasi web adalah ...', 'HTTP', 'HTTPS', 'FTP', 'SMTP', 'B', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Sistem Operasi',
      topic: 'Sistem Operasi',
      order: 3,
      questions: [
        ['Contoh sistem operasi berbasis Linux adalah ...', 'Windows', 'macOS', 'Ubuntu', 'Android', 'C', 10],
        ['Fungsi utama kernel adalah ...', 'Mengelola perangkat keras', 'Menampilkan GUI', 'Membuat dokumen', 'Browsing internet', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Basis Data',
      topic: 'Database',
      order: 4,
      questions: [
        ['Perintah SQL untuk mengambil data adalah ...', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'A', 10],
        ['Primary key berfungsi untuk ...', 'Menghapus data', 'Mengidentifikasi baris secara unik', 'Menggabungkan tabel', 'Menambah kolom', 'B', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Keamanan Siber',
      topic: 'Keamanan',
      order: 5,
      questions: [
        ['Serangan yang mengirim banyak permintaan untuk membanjiri server adalah ...', 'Phishing', 'DDoS', 'Malware', 'SQL Injection', 'B', 10],
        ['Cara aman menyimpan password pengguna adalah ...', 'Plaintext', 'Hash', 'Base64', 'Teks biasa', 'B', 10],
        ['Contoh otentikasi dua faktor adalah ...', 'Password + OTP', 'Hanya password', 'Hanya username', 'Kode negara', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Web Development',
      topic: 'Web',
      order: 6,
      questions: [
        ['HTML digunakan untuk ...', 'Membuat struktur halaman web', 'Menata warna', 'Mengolah data', 'Menghubungkan server', 'A', 10],
        ['CSS digunakan untuk ...', 'Menata tampilan halaman web', 'Membuat database', 'Memproses data', 'Menjalankan server', 'A', 10],
        ['Tag HTML untuk membuat tautan adalah ...', '<a>', '<p>', '<h1>', '<img>', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Pemrograman Berorientasi Objek',
      topic: 'OOP',
      order: 7,
      questions: [
        ['Konsep membungkus data dan method dalam satu unit disebut ...', 'Encapsulation', 'Inheritance', 'Polymorphism', 'Abstraction', 'A', 10],
        ['Pewarisan sifat antar kelas disebut ...', 'Inheritance', 'Encapsulation', 'Interface', 'Instance', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Struktur Data Lanjutan',
      topic: 'Struktur Data',
      order: 8,
      questions: [
        ['Struktur data yang bersifat FIFO disebut ...', 'Queue', 'Stack', 'Tree', 'Graph', 'A', 10],
        ['HashMap menyimpan data dalam bentuk ...', 'Key-value', 'Antrian', 'Graf', 'Pohon', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Basis Data Lanjutan',
      topic: 'Database',
      order: 9,
      questions: [
        ['Perintah untuk menggabungkan dua tabel adalah ...', 'JOIN', 'MERGE', 'UNION ALL', 'SELECT *', 'A', 10],
        ['Indeks pada database berfungsi untuk ...', 'Mempercepat pencarian', 'Memperlambat query', 'Menghapus data', 'Menambah kolom', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Cloud Computing',
      topic: 'Cloud',
      order: 10,
      questions: [
        ['Layanan cloud untuk penyimpanan file adalah ...', 'IaaS', 'SaaS', 'PaaS', 'BaaS', 'B', 10],
        ['Contoh penyedia cloud adalah ...', 'AWS', 'Windows', 'Linux', 'MySQL', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Kecerdasan Buatan',
      topic: 'AI',
      order: 11,
      questions: [
        ['Cabang AI yang mempelajari data untuk memprediksi adalah ...', 'Machine Learning', 'Networking', 'Database', 'UI Design', 'A', 10],
        ['Contoh aplikasi AI adalah ...', 'Chatbot', 'Kalkulator', 'Text editor', 'Browser', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Internet of Things',
      topic: 'IoT',
      order: 12,
      questions: [
        ['IoT singkatan dari ...', 'Internet of Things', 'Input Output Tool', 'Internet Over Time', 'Intelligent Object Tech', 'A', 10],
        ['Contoh perangkat IoT adalah ...', 'Smart lamp', 'Kalkulator', 'Mouse', 'Headset', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Debugging',
      topic: 'Debugging',
      order: 13,
      questions: [
        ['Proses mencari dan memperbaiki bug disebut ...', 'Debugging', 'Compiling', 'Uploading', 'Formatting', 'A', 10],
        ['Pesan error yang muncul saat program salah disebut ...', 'Exception', 'Variable', 'Function', 'Module', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Version Control',
      topic: 'Git',
      order: 14,
      questions: [
        ['Perintah Git untuk menyimpan perubahan adalah ...', 'git commit', 'git push', 'git pull', 'git clone', 'A', 10],
        ['Perintah Git untuk mengunggah ke remote adalah ...', 'git push', 'git commit', 'git init', 'git status', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'UI/UX Design',
      topic: 'UI/UX',
      order: 15,
      questions: [
        ['UX adalah singkatan dari ...', 'User Experience', 'User Exchange', 'Universal Extra', 'Unit Extension', 'A', 10],
        ['UI adalah singkatan dari ...', 'User Interface', 'User Internet', 'Universal Input', 'Unit Index', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Software Testing',
      topic: 'Testing',
      order: 16,
      questions: [
        ['Pengujian yang dilakukan oleh pengembang disebut ...', 'Unit test', 'Beta test', 'User test', 'A/B test', 'A', 10],
        ['Bug yang menyebabkan program berhenti disebut ...', 'Crash', 'Warning', 'Log', 'Feature', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Mobile Apps',
      topic: 'Mobile',
      order: 17,
      questions: [
        ['Bahasa untuk pengembangan Android adalah ...', 'Kotlin', 'Python', 'PHP', 'Cobol', 'A', 10],
        ['Framework mobile dari Google adalah ...', 'Flutter', 'React', 'Django', 'Laravel', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Keamanan Jaringan',
      topic: 'Network Security',
      order: 18,
      questions: [
        ['Perangkat yang menyaring lalu lintas jaringan adalah ...', 'Firewall', 'Hub', 'Switch', 'Repeater', 'A', 10],
        ['VPN digunakan untuk ...', 'Koneksi terenkripsi', 'Mempercepat koneksi', 'Menambah bandwidth', 'Mengurangi ping', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Data Science',
      topic: 'Data',
      order: 19,
      questions: [
        ['Proses membersihkan data disebut ...', 'Data cleaning', 'Data mining', 'Data upload', 'Data delete', 'A', 10],
        ['Visualisasi data biasanya menggunakan ...', 'Grafik', 'Audio', 'Video', 'Animasi', 'A', 10]
      ]
    },
    {
      code: 'INF',
      title: 'Proyek Akhir',
      topic: 'Boss - Capstone',
      order: 20,
      isFinal: true,
      questions: [
        ['Tahap pertama dalam siklus pengembangan perangkat lunak adalah ...', 'Analisis kebutuhan', 'Coding', 'Testing', 'Deploy', 'A', 10],
        ['SDLC singkatan dari ...', 'Software Development Life Cycle', 'System Data Logic Control', 'Secure Digital Link Code', 'Software Deploy Local Cloud', 'A', 10],
        ['Metode pengembangan yang berulang dan bertahap disebut ...', 'Agile', 'Waterfall', 'Monolith', 'Spaghetti', 'A', 10]
      ]
    },
    {
      code: 'MTK',
      title: 'Aljabar',
      topic: 'Aljabar Dasar',
      order: 1,
      questions: [
        ['Nilai dari 2x + 5 = 15 adalah ...', 'x = 5', 'x = 10', 'x = 3', 'x = 20', 'A', 10],
        ['Hasil dari (a+b)(a-b) adalah ...', 'a2 + b2', 'a2 - b2', 'a2 + 2ab + b2', '2a - 2b', 'B', 10],
        ['Nilai dari 3x - 7 = 8 adalah ...', 'x = 5', 'x = 3', 'x = 15', 'x = 1', 'A', 10]
      ]
    },
    {
      code: 'MTK',
      title: 'Geometri',
      topic: 'Geometri',
      order: 2,
      questions: [
        ['Luas lingkaran dengan jari-jari 7 adalah ...', '154', '22', '44', '308', 'A', 10],
        ['Jumlah sudut dalam segitiga adalah ...', '90 derajat', '180 derajat', '360 derajat', '270 derajat', 'B', 10]
      ]
    },
    {
      code: 'MTK',
      title: 'Trigonometri',
      topic: 'Trigonometri',
      order: 3,
      questions: [
        ['Nilai dari sin 30 derajat adalah ...', '0.5', '1', '0', '2', 'A', 10],
        ['Nilai dari cos 60 derajat adalah ...', '1', '0.5', '0', '-1', 'B', 10]
      ]
    },
    {
      code: 'MTK',
      title: 'Kalkulus',
      topic: 'Boss - Kalkulus',
      order: 4,
      isFinal: true,
      questions: [
        ['Turunan dari f(x) = x^2 adalah ...', '2x', 'x', 'x^2', '2', 'A', 10],
        ['Integral dari 2x adalah ...', 'x^2 + C', '2x + C', 'x + C', '0', 'A', 10]
      ]
    },
    {
      code: 'FIS',
      title: 'Gerak Lurus',
      topic: 'Kinematika',
      order: 1,
      questions: [
        ['Satuan SI dari kecepatan adalah ...', 'm/s', 'm/s2', 'km/jam', 'm', 'A', 10],
        ['Rumus kecepatan adalah ...', 'v = s/t', 'v = s x t', 'v = m/a', 'v = t/s', 'A', 10]
      ]
    },
    {
      code: 'FIS',
      title: 'Hukum Newton',
      topic: 'Dinamika',
      order: 2,
      questions: [
        ['Hukum Newton I dikenal sebagai hukum ...', 'Kelembaman', 'Aksi-reaksi', 'Gravitasi', 'Usaha', 'A', 10],
        ['Satuan gaya adalah ...', 'Newton', 'Joule', 'Watt', 'Pascal', 'A', 10]
      ]
    },
    {
      code: 'FIS',
      title: 'Energi & Usaha',
      topic: 'Energi',
      order: 3,
      questions: [
        ['Energi yang dimiliki benda karena ketinggiannya adalah ...', 'Energi kinetik', 'Energi potensial', 'Energi panas', 'Energi bunyi', 'B', 10],
        ['Satuan usaha adalah ...', 'Joule', 'Newton', 'Watt', 'Ampere', 'A', 10]
      ]
    },
    {
      code: 'FIS',
      title: 'Listrik',
      topic: 'Boss - Listrik',
      order: 4,
      isFinal: true,
      questions: [
        ['Satuan arus listrik adalah ...', 'Ampere', 'Volt', 'Ohm', 'Watt', 'A', 10],
        ['Hukum Ohm menyatakan V = ...', 'I x R', 'I / R', 'R / I', 'I + R', 'A', 10],
        ['Alat untuk mengukur tegangan listrik adalah ...', 'Voltmeter', 'Ammeter', 'Ohmmeter', 'Termometer', 'A', 10]
      ]
    }
  ]

  for (const q of quizData) {
    const subjectId = subjectById.get(q.code)
    if (!subjectId) continue
    const existingQuiz = await db
      .select()
      .from(schema.quizzes)
      .where(sql`${schema.quizzes.subjectId} = ${subjectId} AND ${schema.quizzes.title} = ${q.title}`)
      .limit(1)
    if (existingQuiz[0]) continue

    const quiz = await db
      .insert(schema.quizzes)
      .values({
        subjectId,
        title: q.title,
        topic: q.topic,
        orderNumber: q.order,
        duration: 15,
        points: q.questions.length * 10,
        status: 'ACTIVE',
        isFinal: !!q.isFinal,
        createdBy: teacherId
      })
      .returning()
    const quizId = quiz[0]?.id
    if (!quizId) continue

    for (let i = 0; i < q.questions.length; i++) {
      const [question, a, b, c, d, correct, points] = q.questions[i]
      await db.insert(schema.questions).values({
        quizId,
        question,
        optionA: a,
        optionB: b,
        optionC: c,
        optionD: d,
        correctAnswer: correct as 'A' | 'B' | 'C' | 'D',
        points,
        orderNumber: i + 1
      })
    }

    for (const studentId of studentIds) {
      await db.insert(schema.quizClasses).values({ quizId, classId: 1 }).onConflictDoNothing()
    }
  }

  const counts = {
    users: (await db.select().from(schema.users)).length,
    classes: (await db.select().from(schema.classes)).length,
    students: (await db.select().from(schema.students)).length,
    subjects: (await db.select().from(schema.subjects)).length,
    quizzes: (await db.select().from(schema.quizzes)).length,
    questions: (await db.select().from(schema.questions)).length
  }

  const defaultSettings: Record<string, string> = {
    app_name: 'deQuis',
    tagline: 'Quiz. Challenge. Rank.',
    retake_policy: 'OFF',
    sequential_unlock: 'true',
    tie_break: 'points'
  }
  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = await db.select().from(schema.settings).where(sql`${schema.settings.key} = ${key}`).limit(1)
    if (!existing[0]) await db.insert(schema.settings).values({ key, value })
  }

  const counts = {
    users: (await db.select().from(schema.users)).length,
    classes: (await db.select().from(schema.classes)).length,
    students: (await db.select().from(schema.students)).length,
    subjects: (await db.select().from(schema.subjects)).length,
    quizzes: (await db.select().from(schema.quizzes)).length,
    questions: (await db.select().from(schema.questions)).length
  }

  // Add a test quiz attempt with STARTED status for testing in-progress feature
  const firstQuiz = await db.select().from(schema.quizzes).limit(1)
  const firstStudent = await db.select().from(schema.students).limit(1)
  if (firstQuiz[0] && firstStudent[0]) {
    const existingAttempt = await db.select()
      .from(schema.quizAttempts)
      .where(
        and(
          eq(schema.quizAttempts.quizId, firstQuiz[0].id),
          eq(schema.quizAttempts.studentId, firstStudent[0].id),
          eq(schema.quizAttempts.status, 'STARTED')
        )
      )
      .limit(1)
    if (!existingAttempt[0]) {
      await db.insert(schema.quizAttempts).values({
        quizId: firstQuiz[0].id,
        studentId: firstStudent[0].id,
        status: 'STARTED',
        score: 0,
        points: 0
      })
      console.log('Created test quiz attempt with STARTED status')
    }
  }

  console.log('Seed selesai:', counts)
}

main().catch((err) => {
  console.error('Seed gagal:', err)
  process.exit(1)
})
