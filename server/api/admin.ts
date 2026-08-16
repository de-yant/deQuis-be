import { Router } from 'express'
import { eq, and, asc, inArray, sql, desc } from 'drizzle-orm'
import { db, schema } from '../db'
import { requireTeacher, requireSuperAdmin } from '../services/auth-guard'
import { hashPassword, verifyPassword } from '../auth/password'
import { getSettings, setSettings } from '../services/settings'
import { logAudit } from '../services/audit'

const router = Router()
router.use(requireTeacher)

router.get('/settings', async (_req, res) => {
  const settings = await getSettings()
  return res.json({ settings })
})

router.put('/settings', requireSuperAdmin, async (req, res) => {
  const { settings } = req.body ?? {}
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'settings wajib berupa objek' })
  }
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(settings)) {
    clean[k] = String(v)
  }
  await setSettings(clean)
  logAudit(req, 'UPDATE', 'settings', undefined, 'Memperbarui pengaturan')
  return res.json({ ok: true, settings: await getSettings() })
})

router.put('/account', async (req, res) => {
  const { id } = (req as Request & { teacher: { id: number } }).teacher
  const { name } = req.body ?? {}
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name wajib diisi' })
  const updated = await db.update(schema.users).set({ name }).where(eq(schema.users.id, id)).returning()
  const user = updated[0]
  return res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } })
})

router.put('/account/password', async (req, res) => {
  const { id } = (req as Request & { teacher: { id: number } }).teacher
  const { currentPassword, newPassword } = req.body ?? {}
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword dan newPassword wajib diisi' })
  }
  if (String(newPassword).length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter' })
  const found = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1)
  if (!found[0] || !verifyPassword(String(currentPassword), found[0].passwordHash)) {
    return res.status(401).json({ error: 'Password saat ini salah' })
  }
  await db.update(schema.users).set({ passwordHash: hashPassword(String(newPassword)) }).where(eq(schema.users.id, id))
  return res.json({ ok: true })
})

router.get('/teachers', requireSuperAdmin, async (_req, res) => {
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role })
    .from(schema.users)
    .orderBy(asc(schema.users.name))
  const allClasses = await db.select().from(schema.classes)
  const classMap = new Map(allClasses.map((c) => [c.id, c.name]))
  const assignments = await db.select().from(schema.teacherClasses)
  const byTeacher = new Map<number, number[]>()
  for (const a of assignments) {
    if (!byTeacher.has(a.teacherId)) byTeacher.set(a.teacherId, [])
    byTeacher.get(a.teacherId)!.push(a.classId)
  }
  return res.json(
    rows.map((u) => ({
      ...u,
      classIds: byTeacher.get(u.id) ?? [],
      classNames: (byTeacher.get(u.id) ?? []).map((id) => classMap.get(id) ?? null).filter(Boolean)
    }))
  )
})

router.put('/teachers/:id/classes', requireSuperAdmin, async (req, res) => {
  const teacherId = Number(req.params.id)
  const { classIds } = req.body ?? {}
  if (!Array.isArray(classIds)) return res.status(400).json({ error: 'classIds harus berupa array' })
  const teacher = await db.select().from(schema.users).where(eq(schema.users.id, teacherId)).limit(1)
  if (!teacher[0]) return res.status(404).json({ error: 'Guru tidak ditemukan' })

  await db.delete(schema.teacherClasses).where(eq(schema.teacherClasses.teacherId, teacherId))
  for (const cid of classIds) {
    await db
      .insert(schema.teacherClasses)
      .values({ teacherId, classId: Number(cid) })
      .onConflictDoNothing()
  }
  return res.json({ ok: true, teacherId, classIds })
})

router.get('/me/classes', async (req, res) => {
  const { id } = (req as Request & { teacher: { id: number } }).teacher
  const assignments = await db.select().from(schema.teacherClasses).where(eq(schema.teacherClasses.teacherId, id))
  const classIds = assignments.map((a) => a.classId)
  const classes = classIds.length
    ? await db.select().from(schema.classes).where(inArray(schema.classes.id, classIds))
    : []
  return res.json({ classes })
})

router.post('/teachers/invite', requireSuperAdmin, async (req, res) => {
  const { email, name, password } = req.body ?? {}
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name, dan password wajib diisi' })
  }
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1)
  if (existing[0]) return res.status(409).json({ error: 'Email sudah terdaftar' })
  const inserted = await db
    .insert(schema.users)
    .values({ email, name, passwordHash: hashPassword(password), role: 'TEACHER' })
    .returning({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
  logAudit(req, 'CREATE', 'teacher', inserted[0].id, `Mengundang guru ${email}`)
  return res.status(201).json({ user: inserted[0] })
})

router.get('/students', async (_req, res) => {
  const students = await db.select().from(schema.students).orderBy(asc(schema.students.name))
  const classes = await db.select().from(schema.classes)
  const classMap = new Map(classes.map((c) => [c.id, c.name]))
  return res.json({
    students: students.map((s) => ({ ...s, className: classMap.get(s.classId) ?? null }))
  })
})

router.post('/students', async (req, res) => {
  const { nisn, name, classId } = req.body ?? {}
  if (!nisn || !name || !classId) {
    return res.status(400).json({ error: 'nisn, name, dan classId wajib diisi' })
  }
  const existing = await db.select().from(schema.students).where(eq(schema.students.nisn, String(nisn))).limit(1)
  if (existing[0]) return res.status(409).json({ error: 'NISN sudah terdaftar' })
  const inserted = await db
    .insert(schema.students)
    .values({ nisn: String(nisn), name, classId: Number(classId) })
    .returning()
  logAudit(req, 'CREATE', 'student', inserted[0].id, `Tambah siswa ${nisn}`)
  return res.status(201).json({ student: inserted[0] })
})

router.post('/students/import', async (req, res) => {
  const { csv } = req.body ?? {}
  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: 'Kirim teks CSV: NISN,Nama,Kelas per baris' })
  }
  const classes = await db.select().from(schema.classes)
  const classMap = new Map(classes.map((c) => [c.name, c.id]))

  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const rows = lines.map((line) => {
    const [nisn, name, className] = line.split(',').map((p) => p.trim())
    return { nisn, name, className }
  })

  const result: { created: number; skipped: string[] } = { created: 0, skipped: [] }
  for (const row of rows) {
    if (!row.nisn || !row.name || !row.className) {
      result.skipped.push(`${row.nisn ?? '?'} — data tidak lengkap`)
      continue
    }
    const classId = classMap.get(row.className)
    if (!classId) {
      result.skipped.push(`${row.nisn} — kelas ${row.className} tidak ditemukan`)
      continue
    }
    const existing = await db.select().from(schema.students).where(eq(schema.students.nisn, row.nisn)).limit(1)
    if (existing[0]) {
      result.skipped.push(`${row.nisn} — sudah terdaftar`)
      continue
    }
    await db.insert(schema.students).values({ nisn: row.nisn, name: row.name, classId })
    result.created++
  }
  return res.status(201).json(result)
})

router.get('/classes', async (_req, res) => {
  const rows = await db.select().from(schema.classes).orderBy(asc(schema.classes.name))
  const students = await db.select().from(schema.students)
  const countByClass = new Map<number, number>()
  for (const s of students) {
    countByClass.set(s.classId, (countByClass.get(s.classId) ?? 0) + 1)
  }
  return res.json({
    classes: rows.map((c) => ({ ...c, studentCount: countByClass.get(c.id) ?? 0 }))
  })
})

router.post('/classes', async (req, res) => {
  const { name, academicYear, pin } = req.body ?? {}
  if (!name || !academicYear) return res.status(400).json({ error: 'name dan academicYear wajib diisi' })
  const inserted = await db.insert(schema.classes).values({ name, academicYear, pin: pin || null }).returning()
  logAudit(req, 'CREATE', 'class', inserted[0].id, `Tambah kelas ${name}`)
  return res.status(201).json({ class: inserted[0] })
})

router.put('/classes/:id', async (req, res) => {
  const classId = Number(req.params.id)
  const { name, academicYear, pin } = req.body ?? {}
  const cls = await db.select().from(schema.classes).where(eq(schema.classes.id, classId)).limit(1)
  if (!cls[0]) return res.status(404).json({ error: 'Kelas tidak ditemukan' })
  await db
    .update(schema.classes)
    .set({
      name: name ?? cls[0].name,
      academicYear: academicYear ?? cls[0].academicYear,
      pin: pin !== undefined ? pin : cls[0].pin
    })
    .where(eq(schema.classes.id, classId))
  logAudit(req, 'UPDATE', 'class', classId, `Ubah kelas ${cls[0].name}`)
  return res.json({ ok: true })
})

router.delete('/classes/:id', async (req, res) => {
  const classId = Number(req.params.id)
  const cls = await db.select().from(schema.classes).where(eq(schema.classes.id, classId)).limit(1)
  if (!cls[0]) return res.status(404).json({ error: 'Kelas tidak ditemukan' })
  const students = await db.select().from(schema.students).where(eq(schema.students.classId, classId)).limit(1)
  if (students[0]) return res.status(400).json({ error: 'Kelas masih memiliki siswa' })
  await db.delete(schema.teacherClasses).where(eq(schema.teacherClasses.classId, classId))
  await db.delete(schema.quizClasses).where(eq(schema.quizClasses.classId, classId))
  await db.delete(schema.classes).where(eq(schema.classes.id, classId))
  logAudit(req, 'DELETE', 'class', classId, `Hapus kelas ${cls[0].name}`)
  return res.json({ ok: true })
})

router.get('/subjects', async (_req, res) => {
  const rows = await db.select().from(schema.subjects).orderBy(asc(schema.subjects.name))
  return res.json({ subjects: rows })
})

router.post('/subjects', async (req, res) => {
  const { code, name } = req.body ?? {}
  if (!code || !name) return res.status(400).json({ error: 'code dan name wajib diisi' })
  const existing = await db.select().from(schema.subjects).where(eq(schema.subjects.code, String(code).toUpperCase())).limit(1)
  if (existing[0]) return res.status(409).json({ error: 'Kode subject sudah ada' })
  const inserted = await db
    .insert(schema.subjects)
    .values({ code: String(code).toUpperCase(), name })
    .returning()
  return res.status(201).json({ subject: inserted[0] })
})

router.get('/quizzes', async (_req, res) => {
  const quizzes = await db.select().from(schema.quizzes).orderBy(asc(schema.quizzes.subjectId), asc(schema.quizzes.orderNumber))
  const subjects = await db.select().from(schema.subjects)
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))
  return res.json({
    quizzes: quizzes.map((q) => ({ ...q, subject: subjectMap.get(q.subjectId) ?? null }))
  })
})

router.put('/quizzes/:id', async (req, res) => {
  const quizId = Number(req.params.id)
  const quiz = await db.select().from(schema.quizzes).where(eq(schema.quizzes.id, quizId)).limit(1)
  if (!quiz[0]) return res.status(404).json({ error: 'Kuis tidak ditemukan' })
  const { title, topic, description, orderNumber, duration, points, status, isFinal, scheduledStartAt, scheduledEndAt } = req.body ?? {}
  await db
    .update(schema.quizzes)
    .set({
      title: title ?? quiz[0].title,
      topic: topic !== undefined ? topic : quiz[0].topic,
      description: description !== undefined ? description : quiz[0].description,
      orderNumber: orderNumber !== undefined ? Number(orderNumber) : quiz[0].orderNumber,
      duration: duration !== undefined ? Number(duration) : quiz[0].duration,
      points: points !== undefined ? Number(points) : quiz[0].points,
      status: status !== undefined ? status : quiz[0].status,
      isFinal: isFinal !== undefined ? isFinal : quiz[0].isFinal,
      scheduledStartAt: scheduledStartAt !== undefined ? (scheduledStartAt ? new Date(scheduledStartAt) : null) : quiz[0].scheduledStartAt,
      scheduledEndAt: scheduledEndAt !== undefined ? (scheduledEndAt ? new Date(scheduledEndAt) : null) : quiz[0].scheduledEndAt
    })
    .where(eq(schema.quizzes.id, quizId))
  logAudit(req, 'UPDATE', 'quiz', quizId, `Ubah kuis ${quiz[0].title}`)
  return res.json({ ok: true })
})

router.get('/results', async (req, res) => {
  const subjectId = Number(req.query.subjectId) || undefined
  const attempts = await db.select().from(schema.quizAttempts).orderBy(asc(schema.quizAttempts.startedAt))
  const students = await db.select().from(schema.students)
  const quizzes = await db.select().from(schema.quizzes)
  const subjects = await db.select().from(schema.subjects)
  const studentMap = new Map(students.map((s) => [s.id, s]))
  const quizMap = new Map(quizzes.map((q) => [q.id, q]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))

  const rows = attempts
    .map((a) => {
      const quiz = quizMap.get(a.quizId)
      const subject = quiz ? subjectMap.get(quiz.subjectId) : undefined
      return {
        ...a,
        studentName: studentMap.get(a.studentId)?.name ?? null,
        studentNisn: studentMap.get(a.studentId)?.nisn ?? null,
        quizTitle: quiz?.title ?? null,
        subjectName: subject?.name ?? null,
        subjectId: quiz?.subjectId ?? null
      }
    })
    .filter((a) => (subjectId ? a.subjectId === subjectId : true))

  return res.json({ attempts: rows })
})

router.get('/themes', async (_req, res) => {
  const rows = await db.select().from(schema.themes).orderBy(asc(schema.themes.name))
  const links = await db.select().from(schema.themeSubjects)
  const subjects = await db.select().from(schema.subjects)
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]))
  const byTheme = new Map<number, number[]>()
  for (const l of links) {
    if (!byTheme.has(l.themeId)) byTheme.set(l.themeId, [])
    byTheme.get(l.themeId)!.push(l.subjectId)
  }
  return res.json(
    rows.map((t) => ({
      ...t,
      subjectIds: byTheme.get(t.id) ?? [],
      subjectNames: (byTheme.get(t.id) ?? []).map((id) => subjectMap.get(id) ?? null).filter(Boolean)
    }))
  )
})

router.post('/themes', async (req, res) => {
  const { code, name, tagline, colorPrimary, subjectIds } = req.body ?? {}
  if (!code || !name) return res.status(400).json({ error: 'code dan name wajib diisi' })
  const existing = await db.select().from(schema.themes).where(eq(schema.themes.code, String(code).toUpperCase())).limit(1)
  if (existing[0]) return res.status(409).json({ error: 'Kode tema sudah ada' })
  const { id } = (req as Request & { teacher: { id: number } }).teacher
  const inserted = await db
    .insert(schema.themes)
    .values({
      code: String(code).toUpperCase(),
      name,
      tagline: tagline || null,
      colorPrimary: colorPrimary || '#6c8cff',
      createdBy: id
    })
    .returning()
  const themeId = inserted[0].id
  for (const sid of subjectIds ?? []) {
    await db.insert(schema.themeSubjects).values({ themeId, subjectId: Number(sid) }).onConflictDoNothing()
  }
  return res.status(201).json({ theme: inserted[0] })
})

router.put('/themes/:id', async (req, res) => {
  const themeId = Number(req.params.id)
  const theme = await db.select().from(schema.themes).where(eq(schema.themes.id, themeId)).limit(1)
  if (!theme[0]) return res.status(404).json({ error: 'Tema tidak ditemukan' })
  const { code, name, tagline, colorPrimary, isActive, subjectIds } = req.body ?? {}
  await db
    .update(schema.themes)
    .set({
      code: code ? String(code).toUpperCase() : theme[0].code,
      name: name ?? theme[0].name,
      tagline: tagline !== undefined ? tagline : theme[0].tagline,
      colorPrimary: colorPrimary || theme[0].colorPrimary,
      isActive: isActive !== undefined ? isActive : theme[0].isActive
    })
    .where(eq(schema.themes.id, themeId))
  await db.delete(schema.themeSubjects).where(eq(schema.themeSubjects.themeId, themeId))
  for (const sid of subjectIds ?? []) {
    await db.insert(schema.themeSubjects).values({ themeId, subjectId: Number(sid) }).onConflictDoNothing()
  }
  return res.json({ ok: true })
})

router.delete('/themes/:id', async (req, res) => {
  const themeId = Number(req.params.id)
  await db.delete(schema.themeSubjects).where(eq(schema.themeSubjects.themeId, themeId))
  await db.delete(schema.themes).where(eq(schema.themes.id, themeId))
  return res.json({ ok: true })
})

router.get('/notifications', async (req, res) => {
  const { id } = (req as Request & { teacher: { id: number } }).teacher
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, id))
    .orderBy(sql`${schema.notifications.createdAt} desc`)
    .limit(50)
  const unread = rows.filter((r) => !r.read).length
  return res.json({ notifications: rows, unread })
})

router.put('/notifications/read-all', async (req, res) => {
  const { id } = (req as Request & { teacher: { id: number } }).teacher
  await db.update(schema.notifications).set({ read: true }).where(eq(schema.notifications.userId, id))
  return res.json({ ok: true })
})

router.put('/notifications/:id/read', async (req, res) => {
  const { id } = (req as Request & { teacher: { id: number } }).teacher
  const notifId = Number(req.params.id)
  await db
    .update(schema.notifications)
    .set({ read: true })
    .where(and(eq(schema.notifications.id, notifId), eq(schema.notifications.userId, id)))
  return res.json({ ok: true })
})

// ===== Audit Logs =====
router.get('/audit-logs', async (req, res) => {
  const rows = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(200)
  return res.json({ logs: rows })
})

// ===== Analytics =====
router.get('/analytics/overview', async (_req, res) => {
  const [students, attempts, quizzes, subjects] = await Promise.all([
    db.select().from(schema.students),
    db.select().from(schema.quizAttempts).where(eq(schema.quizAttempts.status, 'COMPLETED')),
    db.select().from(schema.quizzes),
    db.select().from(schema.subjects)
  ])
  const totalScore = attempts.reduce((s, a) => s + a.score, 0)
  const avgScore = attempts.length ? Math.round(totalScore / attempts.length) : 0
  const byQuiz = await db
    .select({
      quizId: schema.quizAttempts.quizId,
      count: sql<number>`count(*)`,
      avg: sql<number>`avg(${schema.quizAttempts.score})`
    })
    .from(schema.quizAttempts)
    .where(eq(schema.quizAttempts.status, 'COMPLETED'))
    .groupBy(schema.quizAttempts.quizId)
  const quizMap = new Map(quizzes.map((q) => [q.id, q]))
  return res.json({
    stats: {
      students: students.length,
      attempts: attempts.length,
      quizzes: quizzes.length,
      subjects: subjects.length,
      avgScore
    },
    perQuiz: byQuiz.map((r) => ({
      quizId: r.quizId,
      title: quizMap.get(r.quizId)?.title ?? '?',
      count: Number(r.count),
      avg: Math.round(Number(r.avg))
    }))
  })
})

router.get('/analytics/questions', async (_req, res) => {
  const answers = await db.select().from(schema.answers)
  const questions = await db.select().from(schema.questions)
  const byQuestion = new Map<number, { total: number; correct: number }>()
  for (const a of answers) {
    const cur = byQuestion.get(a.questionId) ?? { total: 0, correct: 0 }
    cur.total += 1
    if (a.isCorrect) cur.correct += 1
    byQuestion.set(a.questionId, cur)
  }
  const qMap = new Map(questions.map((q) => [q.id, q]))
  return res.json({
    perQuestion: [...byQuestion.entries()].map(([id, v]) => {
      const q = qMap.get(id)
      return {
        questionId: id,
        question: q?.question ?? '?',
        total: v.total,
        correct: v.correct,
        accuracy: v.total ? Math.round((v.correct / v.total) * 100) : 0
      }
    })
  })
})

// ===== Kolaborasi Guru =====
router.get('/quizzes/:id/teachers', async (req, res) => {
  const quizId = Number(req.params.id)
  const links = await db.select().from(schema.quizTeachers).where(eq(schema.quizTeachers.quizId, quizId))
  const ids = links.map((l) => l.userId)
  const users = ids.length ? await db.select().from(schema.users).where(inArray(schema.users.id, ids)) : []
  return res.json({ teachers: users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })) })
})

router.put('/quizzes/:id/teachers', async (req, res) => {
  const quizId = Number(req.params.id)
  const { userIds } = req.body ?? {}
  if (!Array.isArray(userIds)) return res.status(400).json({ error: 'userIds wajib berupa array' })
  await db.delete(schema.quizTeachers).where(eq(schema.quizTeachers.quizId, quizId))
  for (const uid of userIds) {
    await db.insert(schema.quizTeachers).values({ quizId, userId: Number(uid) }).onConflictDoNothing()
  }
  logAudit(req, 'UPDATE', 'quiz_teachers', quizId, 'Memperbarui kolaborator kuis')
  return res.json({ ok: true })
})

// ===== Question Bank =====
router.get('/question-bank', async (req, res) => {
  const subjectId = Number(req.query.subjectId) || undefined
  const rows = subjectId
    ? await db.select().from(schema.questionBank).where(eq(schema.questionBank.subjectId, subjectId)).orderBy(desc(schema.questionBank.createdAt))
    : await db.select().from(schema.questionBank).orderBy(desc(schema.questionBank.createdAt))
  const subjects = await db.select().from(schema.subjects)
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]))
  return res.json({ items: rows.map((r) => ({ ...r, subjectName: subjectMap.get(r.subjectId) ?? null })) })
})

router.post('/question-bank', async (req, res) => {
  const { subjectId, question, optionA, optionB, optionC, optionD, correctAnswer, points } = req.body ?? {}
  if (!subjectId || !question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
    return res.status(400).json({ error: 'Data soal bank tidak lengkap' })
  }
  const { id } = (req as Request & { teacher: { id: number } }).teacher
  const inserted = await db
    .insert(schema.questionBank)
    .values({ subjectId: Number(subjectId), question, optionA, optionB, optionC, optionD, correctAnswer, points: Number(points) || 10, createdBy: id })
    .returning()
  logAudit(req, 'CREATE', 'question_bank', inserted[0].id)
  return res.status(201).json({ item: inserted[0] })
})

router.put('/question-bank/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { question, optionA, optionB, optionC, optionD, correctAnswer, points } = req.body ?? {}
  await db
    .update(schema.questionBank)
    .set({ question, optionA, optionB, optionC, optionD, correctAnswer, points: Number(points) || 10 })
    .where(eq(schema.questionBank.id, id))
  logAudit(req, 'UPDATE', 'question_bank', id)
  return res.json({ ok: true })
})

router.delete('/question-bank/:id', async (req, res) => {
  const id = Number(req.params.id)
  await db.delete(schema.questionBank).where(eq(schema.questionBank.id, id))
  logAudit(req, 'DELETE', 'question_bank', id)
  return res.json({ ok: true })
})

router.post('/quizzes/:id/bank-questions', async (req, res) => {
  const quizId = Number(req.params.id)
  const { ids } = req.body ?? {}
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids wajib berupa array' })
  const quiz = await db.select().from(schema.quizzes).where(eq(schema.quizzes.id, quizId)).limit(1)
  if (!quiz[0]) return res.status(404).json({ error: 'Kuis tidak ditemukan' })
  const bankItems = ids.length ? await db.select().from(schema.questionBank).where(inArray(schema.questionBank.id, ids)) : []
  let added = 0
  for (const b of bankItems) {
    const maxOrder = await db
      .select({ m: sql<number>`coalesce(max(${schema.questions.orderNumber}), 0)` })
      .from(schema.questions)
      .where(eq(schema.questions.quizId, quizId))
    const order = Number(maxOrder[0]?.m ?? 0) + 1 + added
    await db.insert(schema.questions).values({
      quizId,
      question: b.question,
      optionA: b.optionA,
      optionB: b.optionB,
      optionC: b.optionC,
      optionD: b.optionD,
      correctAnswer: b.correctAnswer,
      points: b.points,
      orderNumber: order
    })
    added++
  }
  logAudit(req, 'UPDATE', 'quiz_questions', quizId, `Menambahkan ${added} soal dari bank`)
  return res.json({ added })
})

// ===== Badges =====
router.get('/badges', async (_req, res) => {
  const badges = await db.select().from(schema.badges).orderBy(asc(schema.badges.tier), asc(schema.badges.id))
  const earned = await db.select().from(schema.studentBadges)
  const countByBadge = new Map<number, number>()
  for (const e of earned) countByBadge.set(e.badgeId, (countByBadge.get(e.badgeId) ?? 0) + 1)
  return res.json({
    badges: badges.map((b) => ({ ...b, earnedCount: countByBadge.get(b.id) ?? 0 }))
  })
})

router.post('/badges', requireSuperAdmin, async (req, res) => {
  const { code, name, description, icon, tier } = req.body ?? {}
  if (!code || !name) return res.status(400).json({ error: 'code and name are required' })
  const inserted = await db
    .insert(schema.badges)
    .values({ code, name, description: description || null, icon: icon || 'award', tier: tier || 'Easy' })
    .returning()
  logAudit(req, 'CREATE', 'badge', inserted[0].id)
  return res.status(201).json({ badge: inserted[0] })
})

router.put('/badges/:id', requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const badge = await db.select().from(schema.badges).where(eq(schema.badges.id, id)).limit(1)
  if (!badge[0]) return res.status(404).json({ error: 'Badge not found' })
  const { code, name, description, icon, tier } = req.body ?? {}
  await db
    .update(schema.badges)
    .set({
      code: code ?? badge[0].code,
      name: name ?? badge[0].name,
      description: description !== undefined ? description : badge[0].description,
      icon: icon || badge[0].icon,
      tier: tier || badge[0].tier
    })
    .where(eq(schema.badges.id, id))
  logAudit(req, 'UPDATE', 'badge', id)
  return res.json({ ok: true })
})

router.delete('/badges/:id', requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id)
  await db.delete(schema.studentBadges).where(eq(schema.studentBadges.badgeId, id))
  await db.delete(schema.badges).where(eq(schema.badges.id, id))
  logAudit(req, 'DELETE', 'badge', id)
  return res.json({ ok: true })
})

export { router as adminRouter }
