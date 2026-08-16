import { Router } from 'express'
import { eq, and, asc, sql } from 'drizzle-orm'
import { db, schema } from '../db'
import { signToken } from '../auth/token'
import { requireStudent } from '../services/auth-guard'
import { getRoadmap } from '../services/roadmap'
import { getSetting } from '../services/settings'
import { awardOnSubmit, getStudentGamification } from '../services/gamification'

const router = Router()

router.post('/login', async (req, res) => {
  const { nisn, pin } = req.body ?? {}
  if (!nisn) return res.status(400).json({ error: 'NISN wajib diisi' })
  const found = await db
    .select()
    .from(schema.students)
    .where(and(eq(schema.students.nisn, String(nisn).trim()), eq(schema.students.active, true)))
    .limit(1)
  const student = found[0]
  if (!student) return res.status(404).json({ error: 'Siswa tidak ditemukan' })

  const classInfo = await db.select().from(schema.classes).where(eq(schema.classes.id, student.classId)).limit(1)
  if (classInfo[0]?.pin) {
    if (!pin) return res.status(400).json({ requiresPin: true, error: 'Kelas ini memerlukan PIN' })
    if (String(pin) !== classInfo[0].pin) return res.status(401).json({ error: 'PIN kelas salah' })
  }

  const token = signToken({ type: 'student', studentId: student.id })
  return res.json({
    token,
    student: {
      id: student.id,
      nisn: student.nisn,
      name: student.name,
      nickname: student.nickname,
      classId: student.classId,
      className: classInfo[0]?.name ?? null,
      streak: student.streak
    }
  })
})

router.get('/profile', requireStudent, async (req, res) => {
  const { studentId } = (req as Request & { student: { studentId: number } }).student
  const student = await db.select().from(schema.students).where(eq(schema.students.id, studentId)).limit(1)
  if (!student[0]) return res.status(404).json({ error: 'Siswa tidak ditemukan' })
  const classInfo = await db.select().from(schema.classes).where(eq(schema.classes.id, student[0].classId)).limit(1)
  return res.json({
    student: {
      id: student[0].id,
      nisn: student[0].nisn,
      name: student[0].name,
      nickname: student[0].nickname,
      classId: student[0].classId,
      className: classInfo[0]?.name ?? null,
      streak: student[0].streak
    }
  })
})

router.get('/badges', requireStudent, async (req, res) => {
  const { studentId } = (req as Request & { student: { studentId: number } }).student
  const data = await getStudentGamification(studentId)
  return res.json(data)
})

router.put('/profile/nickname', requireStudent, async (req, res) => {
  const { studentId } = (req as Request & { student: { studentId: number } }).student
  const { nickname } = req.body ?? {}
  const value = nickname ? String(nickname).trim() : null
  if (value && [...value].length > 30) return res.status(400).json({ error: 'Nama samaran maksimal 30 karakter' })
  await db.update(schema.students).set({ nickname: value }).where(eq(schema.students.id, studentId))
  const updated = await db.select().from(schema.students).where(eq(schema.students.id, studentId)).limit(1)
  return res.json({ nickname: updated[0].nickname })
})

router.get('/subjects', requireStudent, async (_req, res) => {
  const rows = await db.select().from(schema.subjects).where(eq(schema.subjects.isActive, true)).orderBy(asc(schema.subjects.name))
  return res.json({ subjects: rows })
})

router.post('/subjects/:id/validate-code', requireStudent, async (req, res) => {
  const subjectId = Number(req.params.id)
  const { code } = req.body ?? {}
  if (!code) return res.status(400).json({ error: 'Kode wajib diisi' })
  const subject = await db.select().from(schema.subjects).where(and(eq(schema.subjects.id, subjectId), eq(schema.subjects.isActive, true))).limit(1)
  if (!subject[0]) return res.status(404).json({ error: 'Mata pelajaran tidak ditemukan' })
  if (!subject[0].accessCode) return res.status(400).json({ error: 'Mata pelajaran ini tidak memiliki kode akses' })
  const input = String(code).trim().toUpperCase()
  const actual = subject[0].accessCode.toUpperCase()
  if (actual !== input) return res.status(401).json({ error: 'Kode mata pelajaran salah' })
  return res.json({ ok: true })
})

router.get('/roadmap', requireStudent, async (req, res) => {
  const { studentId } = (req as Request & { student: { studentId: number } }).student
  const subjectId = Number(req.query.subjectId)
  if (!subjectId) return res.status(400).json({ error: 'subjectId wajib diisi' })
  const subject = await db.select().from(schema.subjects).where(eq(schema.subjects.id, subjectId)).limit(1)
  if (!subject[0]) return res.status(404).json({ error: 'Mata pelajaran tidak ditemukan' })
  const roadmap = await getRoadmap(subjectId, studentId)
  return res.json({ subject: subject[0], roadmap })
})

router.get('/quizzes/:id', requireStudent, async (req, res) => {
  const quizId = Number(req.params.id)
  const quiz = await db.select().from(schema.quizzes).where(eq(schema.quizzes.id, quizId)).limit(1)
  if (!quiz[0]) return res.status(404).json({ error: 'Kuis tidak ditemukan' })
  const questions = await db
    .select({
      id: schema.questions.id,
      quizId: schema.questions.quizId,
      question: schema.questions.question,
      optionA: schema.questions.optionA,
      optionB: schema.questions.optionB,
      optionC: schema.questions.optionC,
      optionD: schema.questions.optionD,
      points: schema.questions.points,
      orderNumber: schema.questions.orderNumber
    })
    .from(schema.questions)
    .where(eq(schema.questions.quizId, quizId))
    .orderBy(asc(schema.questions.orderNumber))
  const randomize = (await getSetting('randomize_questions', 'true')) === 'true'
  if (randomize) {
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[questions[i], questions[j]] = [questions[j], questions[i]]
    }
  }
  return res.json({ quiz: quiz[0], questions })
})

router.post('/quizzes/:id/start', requireStudent, async (req, res) => {
  const { studentId } = (req as Request & { student: { studentId: number } }).student
  const quizId = Number(req.params.id)
  const quiz = await db.select().from(schema.quizzes).where(eq(schema.quizzes.id, quizId)).limit(1)
  if (!quiz[0]) return res.status(404).json({ error: 'Kuis tidak ditemukan' })
  if (quiz[0].status !== 'ACTIVE') return res.status(403).json({ error: 'Kuis tidak aktif' })

  const now = Date.now()
  if (quiz[0].scheduledStartAt && now < new Date(quiz[0].scheduledStartAt).getTime()) {
    return res.status(403).json({ error: 'Kuis belum dibuka (terjadwal)' })
  }
  if (quiz[0].scheduledEndAt && now > new Date(quiz[0].scheduledEndAt).getTime()) {
    return res.status(403).json({ error: 'Kuis sudah ditutup (terjadwal)' })
  }

  const started = await db
    .select()
    .from(schema.quizAttempts)
    .where(
      and(
        eq(schema.quizAttempts.quizId, quizId),
        eq(schema.quizAttempts.studentId, studentId),
        eq(schema.quizAttempts.status, 'STARTED')
      )
    )
    .limit(1)
  if (started[0]) {
    const deadline = new Date(started[0].startedAt).getTime() + quiz[0].duration * 60 * 1000
    if (Date.now() < deadline) {
      return res.json({ attempt: started[0], resuming: true })
    }
    // Deadline passed without a submit (e.g. closed tab, no answers) — close it so retake starts fresh
    await db
      .update(schema.quizAttempts)
      .set({ status: 'AVAILABLE' })
      .where(eq(schema.quizAttempts.id, started[0].id))
  }

  const completed = await db
    .select()
    .from(schema.quizAttempts)
    .where(
      and(
        eq(schema.quizAttempts.quizId, quizId),
        eq(schema.quizAttempts.studentId, studentId),
        eq(schema.quizAttempts.status, 'COMPLETED')
      )
    )
    .limit(1)
  if (completed[0]) {
    const retakePolicy = await getSetting('retake_policy', 'ON')
    if (retakePolicy === 'OFF') return res.status(409).json({ error: 'Kuis sudah dikerjakan (retake OFF)' })
  }

  const inserted = await db
    .insert(schema.quizAttempts)
    .values({ quizId, studentId, status: 'STARTED' })
    .returning()
  return res.status(201).json({ attempt: inserted[0], resuming: false })
})

router.post('/attempts/:id/answer', requireStudent, async (req, res) => {
  const { studentId } = (req as Request & { student: { studentId: number } }).student
  const attemptId = Number(req.params.id)
  const { questionId, answer } = req.body ?? {}
  if (!questionId || !answer) return res.status(400).json({ error: 'questionId dan answer wajib diisi' })

  const attempt = await db.select().from(schema.quizAttempts).where(eq(schema.quizAttempts.id, attemptId)).limit(1)
  if (!attempt[0] || attempt[0].studentId !== studentId) return res.status(404).json({ error: 'Attempt tidak ditemukan' })
  if (attempt[0].status !== 'STARTED') return res.status(409).json({ error: 'Attempt tidak dalam status STARTED' })

  const question = await db.select().from(schema.questions).where(eq(schema.questions.id, questionId)).limit(1)
  if (!question[0] || question[0].quizId !== attempt[0].quizId) {
    return res.status(404).json({ error: 'Soal tidak ditemukan dalam kuis ini' })
  }

  const isCorrect = question[0].correctAnswer === answer
  const points = isCorrect ? question[0].points : 0

  const existing = await db
    .select()
    .from(schema.answers)
    .where(and(eq(schema.answers.attemptId, attemptId), eq(schema.answers.questionId, questionId)))
    .limit(1)

  if (existing[0]) {
    await db
      .update(schema.answers)
      .set({ answer, isCorrect, points })
      .where(eq(schema.answers.id, existing[0].id))
  } else {
    await db.insert(schema.answers).values({ attemptId, questionId, answer, isCorrect, points })
  }

  return res.json({ saved: true, isCorrect, points })
})

router.post('/attempts/:id/submit', requireStudent, async (req, res) => {
  const { studentId } = (req as Request & { student: { studentId: number } }).student
  const attemptId = Number(req.params.id)
  const attempt = await db.select().from(schema.quizAttempts).where(eq(schema.quizAttempts.id, attemptId)).limit(1)
  if (!attempt[0] || attempt[0].studentId !== studentId) return res.status(404).json({ error: 'Attempt tidak ditemukan' })
  if (attempt[0].status !== 'STARTED') return res.status(409).json({ error: 'Attempt sudah disubmit' })

  const answers = await db.select().from(schema.answers).where(eq(schema.answers.attemptId, attemptId))
  const hasAnswers = answers.length > 0
  const score = answers.reduce((sum, a) => sum + a.points, 0)

  // If no answers were submitted (user ran out of time or closed tab), don't count as completed
  if (!hasAnswers) {
    await db
      .update(schema.quizAttempts)
      .set({ status: 'AVAILABLE' })
      .where(eq(schema.quizAttempts.id, attemptId))
    return res.json({ attempt: { ...attempt[0], status: 'AVAILABLE' }, answers, reverted: true })
  }

  const prevCompleted = await db
    .select()
    .from(schema.quizAttempts)
    .where(
      and(
        eq(schema.quizAttempts.quizId, attempt[0].quizId),
        eq(schema.quizAttempts.studentId, studentId),
        eq(schema.quizAttempts.status, 'COMPLETED')
      )
    )
    .limit(1)
  const counted = !prevCompleted[0]

  await db
    .update(schema.quizAttempts)
    .set({ status: 'COMPLETED', finishedAt: new Date(), score, points: score, counted })
    .where(eq(schema.quizAttempts.id, attemptId))

  const quiz = await db.select().from(schema.quizzes).where(eq(schema.quizzes.id, attempt[0].quizId)).limit(1)
  const student = await db.select().from(schema.students).where(eq(schema.students.id, studentId)).limit(1)
  if (quiz[0]?.createdBy && student[0]) {
    await db.insert(schema.notifications).values({
      userId: quiz[0].createdBy,
      message: `Siswa ${student[0].name} menyelesaikan "${quiz[0].title}" dengan skor ${score}`,
      type: 'submit'
    })
  }

  awardOnSubmit(studentId, {
    id: attemptId,
    quizId: attempt[0].quizId,
    score,
    startedAt: attempt[0].startedAt,
    finishedAt: new Date()
  }).catch((e) => console.error('gamification error:', e))

  const updated = await db.select().from(schema.quizAttempts).where(eq(schema.quizAttempts.id, attemptId)).limit(1)
  return res.json({ attempt: updated[0], answers })
})

router.get('/attempts/:id/result', requireStudent, async (req, res) => {
  const { studentId } = (req as Request & { student: { studentId: number } }).student
  const attemptId = Number(req.params.id)
  const attempt = await db.select().from(schema.quizAttempts).where(eq(schema.quizAttempts.id, attemptId)).limit(1)
  if (!attempt[0] || attempt[0].studentId !== studentId) return res.status(404).json({ error: 'Attempt tidak ditemukan' })

  const quiz = await db.select().from(schema.quizzes).where(eq(schema.quizzes.id, attempt[0].quizId)).limit(1)
  const answers = await db.select().from(schema.answers).where(eq(schema.answers.attemptId, attemptId))
  const questions = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.quizId, attempt[0].quizId))
    .orderBy(asc(schema.questions.orderNumber))

  // Calculate attempt number (1-based)
  const previousAttempts = await db
    .select()
    .from(schema.quizAttempts)
    .where(
      and(
        eq(schema.quizAttempts.quizId, attempt[0].quizId),
        eq(schema.quizAttempts.studentId, studentId),
        eq(schema.quizAttempts.status, 'COMPLETED')
      )
    )
    .orderBy(asc(schema.quizAttempts.startedAt))
  const attemptNumber = previousAttempts.length + 1
  const isRetake = attemptNumber > 1

  return res.json({
    attempt: { ...attempt[0], attemptNumber, isRetake },
    quiz: quiz[0],
    answers,
    questions
  })
})

export { router as studentRouter }
