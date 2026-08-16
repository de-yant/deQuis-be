import { Router } from 'express'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { db, schema } from '../db'
import { requireStudent } from '../services/auth-guard'

const router = Router()

interface RankRow {
  studentId: number
  totalPoints: number
}

async function enrich(rows: RankRow[]) {
  const ids = rows.map((r) => r.studentId)
  const students = ids.length
    ? await db.select().from(schema.students).where(inArray(schema.students.id, ids))
    : []
  const classes = await db.select().from(schema.classes)
  const classMap = new Map(classes.map((c) => [c.id, c.name]))
  const stuMap = new Map(students.map((s) => [s.id, s]))
  return rows.map((r, i) => {
    const s = stuMap.get(r.studentId)
    return {
      rank: i + 1,
      studentId: r.studentId,
      nisn: s?.nisn ?? null,
      name: s?.name ?? null,
      nickname: s?.nickname ?? null,
      className: s ? classMap.get(s.classId) ?? null : null,
      totalPoints: Number(r.totalPoints)
    }
  })
}

async function getRanking(options: { classId?: number; subjectId?: number }) {
  const conditions = [
    eq(schema.quizAttempts.status, 'COMPLETED'),
    eq(schema.quizAttempts.counted, true),
    options.classId ? eq(schema.students.classId, options.classId) : undefined,
    options.subjectId ? eq(schema.quizzes.subjectId, options.subjectId) : undefined
  ]
  const rows = await db
    .select({
      studentId: schema.quizAttempts.studentId,
      totalPoints: sql<number>`sum(${schema.quizAttempts.points})`
    })
    .from(schema.quizAttempts)
    .innerJoin(schema.students, eq(schema.quizAttempts.studentId, schema.students.id))
    .innerJoin(schema.quizzes, eq(schema.quizAttempts.quizId, schema.quizzes.id))
    .where(and(...conditions))
    .groupBy(schema.quizAttempts.studentId)
    .orderBy(sql`sum(${schema.quizAttempts.points}) desc`)
  return enrich(rows)
}

router.get('/general', requireStudent, async (req, res) => {
  const subjectId = Number(req.query.subjectId) || undefined
  const ranking = await getRanking({ subjectId })
  return res.json({ ranking })
})

router.get('/class', requireStudent, async (req, res) => {
  const classId = Number(req.query.classId)
  if (!classId) return res.status(400).json({ error: 'classId wajib diisi' })
  const subjectId = Number(req.query.subjectId) || undefined
  const ranking = await getRanking({ classId, subjectId })
  return res.json({ ranking })
})

router.get('/subject/:subjectId', requireStudent, async (req, res) => {
  const subjectId = Number(req.params.subjectId)
  const subject = await db.select().from(schema.subjects).where(eq(schema.subjects.id, subjectId)).limit(1)
  if (!subject[0]) return res.status(404).json({ error: 'Mata pelajaran tidak ditemukan' })
  const ranking = await getRanking({ subjectId })
  return res.json({ subject: subject[0], ranking })
})

export { router as rankingRouter }
