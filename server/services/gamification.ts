import { eq, and, sql, inArray } from 'drizzle-orm'
import { db, schema } from '../db'

export interface AttemptInfo {
  id: number
  quizId: number
  score: number
  startedAt: Date
  finishedAt: Date | null
}

export type BadgeTier = 'Easy' | 'Medium' | 'Hard' | 'Very Hard' | 'Super Hard'

const BADGE_DEFS: Array<{ code: string; name: string; description: string; icon: string; tier: BadgeTier }> = [
  { code: 'first_quiz', name: 'First Quiz', description: 'Complete your first quiz', icon: 'play', tier: 'Easy' },
  { code: 'perfect_score', name: 'Perfect Score', description: 'Get a perfect score', icon: 'trophy', tier: 'Easy' },
  { code: 'speed_runner', name: 'Speed Runner', description: 'Finish within half the time', icon: 'bolt', tier: 'Easy' },
  { code: 'streak_3', name: 'Consistent', description: '3-day streak', icon: 'check', tier: 'Easy' },
  { code: 'quiz_5', name: 'Apprentice', description: 'Complete 5 quizzes', icon: 'book', tier: 'Medium' },
  { code: 'explorer', name: 'Explorer', description: 'Try 2 different subjects', icon: 'globe', tier: 'Medium' },
  { code: 'accurate', name: 'Sharpshooter', description: '80%+ overall accuracy', icon: 'target', tier: 'Medium' },
  { code: 'streak_7', name: 'Dedicated', description: '7-day streak', icon: 'award', tier: 'Medium' },
  { code: 'quiz_10', name: 'Adept', description: 'Complete 10 quizzes', icon: 'layers', tier: 'Hard' },
  { code: 'points_500', name: 'Collector', description: 'Earn 500 points', icon: 'gem', tier: 'Hard' },
  { code: 'perfect_3', name: 'Flawless', description: '3 perfect scores', icon: 'diamond', tier: 'Hard' },
  { code: 'speed_3', name: 'Swift', description: '3 speed runs', icon: 'rocket', tier: 'Hard' },
  { code: 'quiz_20', name: 'Expert', description: 'Complete 20 quizzes', icon: 'cpu', tier: 'Very Hard' },
  { code: 'streak_14', name: 'Fortnight', description: '14-day streak', icon: 'flame', tier: 'Very Hard' },
  { code: 'points_1000', name: 'High Roller', description: 'Earn 1000 points', icon: 'crown', tier: 'Very Hard' },
  { code: 'boss_slayer', name: 'Boss Slayer', description: 'Perfect score on a Boss quiz', icon: 'shield', tier: 'Very Hard' },
  { code: 'quiz_30', name: 'Legend', description: 'Complete 30 quizzes', icon: 'star', tier: 'Super Hard' },
  { code: 'streak_30', name: 'Iron Will', description: '30-day streak', icon: 'mountain', tier: 'Super Hard' },
  { code: 'top_3', name: 'Top 3', description: 'Reach Top 3 ranking', icon: 'trophy', tier: 'Super Hard' },
  { code: 'perfectionist', name: 'Perfectionist', description: '10 perfect scores', icon: 'medal', tier: 'Super Hard' }
]

export async function ensureBadges() {
  for (const b of BADGE_DEFS) {
    const existing = await db.select().from(schema.badges).where(eq(schema.badges.code, b.code)).limit(1)
    if (!existing[0]) {
      await db.insert(schema.badges).values(b)
    }
  }
}

async function awardBadge(studentId: number, code: string) {
  const badge = await db.select().from(schema.badges).where(eq(schema.badges.code, code)).limit(1)
  if (badge[0]) {
    await db.insert(schema.studentBadges).values({ studentId, badgeId: badge[0].id }).onConflictDoNothing()
  }
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yesterdayStr(): string {
  const d = new Date(Date.now() - 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function updateStreak(studentId: number) {
  const student = await db.select().from(schema.students).where(eq(schema.students.id, studentId)).limit(1)
  if (!student[0]) return 0
  const today = todayStr()
  const last = student[0].lastStreakDate
  let streak = student[0].streak || 0
  if (last === today) {
    // already today
  } else if (last === yesterdayStr()) {
    streak += 1
  } else {
    streak = 1
  }
  await db.update(schema.students).set({ streak, lastStreakDate: today }).where(eq(schema.students.id, studentId))
  return streak
}

export async function awardOnSubmit(studentId: number, attempt: AttemptInfo) {
  await ensureBadges()

  const quiz = await db.select().from(schema.quizzes).where(eq(schema.quizzes.id, attempt.quizId)).limit(1)
  const totalPoints = quiz[0]?.points ?? 0

  const streak = await updateStreak(studentId)

  const completed = await db
    .select()
    .from(schema.quizAttempts)
    .where(and(eq(schema.quizAttempts.studentId, studentId), eq(schema.quizAttempts.status, 'COMPLETED')))
  const completedCount = completed.length
  const totalPointsEarned = completed.filter((a) => a.counted).reduce((s, a) => s + a.points, 0)

  const quizIds = [...new Set(completed.map((a) => a.quizId))]
  const quizzes = quizIds.length ? await db.select().from(schema.quizzes).where(inArray(schema.quizzes.id, quizIds)) : []
  const pointsMap = new Map(quizzes.map((q) => [q.id, q.points]))
  const durationsMap = new Map(quizzes.map((q) => [q.id, q.duration]))
  const subjectSet = new Set(quizzes.map((q) => q.subjectId))
  const distinctSubjects = subjectSet.size

  const perfectCount = completed.filter(
    (a) => (pointsMap.get(a.quizId) || 0) > 0 && a.score >= (pointsMap.get(a.quizId) || 0)
  ).length

  const speedCount = completed.filter((a) => {
    const dur = durationsMap.get(a.quizId)
    if (!dur || !a.finishedAt) return false
    return a.finishedAt.getTime() - a.startedAt.getTime() <= dur * 60 * 1000 * 0.5
  }).length

  const answerRows = await db
    .select()
    .from(schema.answers)
    .innerJoin(schema.quizAttempts, eq(schema.answers.attemptId, schema.quizAttempts.id))
    .where(and(eq(schema.quizAttempts.studentId, studentId), eq(schema.quizAttempts.status, 'COMPLETED')))
  const totalAnswered = answerRows.length
  const correct = answerRows.filter((r) => r.answers.isCorrect).length
  const accuracy = totalAnswered ? correct / totalAnswered : 0

  const speedNow =
    !!quiz[0]?.duration && !!attempt.finishedAt &&
    attempt.finishedAt.getTime() - attempt.startedAt.getTime() <= quiz[0].duration * 60 * 1000 * 0.5
  const perfectNow = totalPoints > 0 && attempt.score >= totalPoints
  const bossPerfect = !!quiz[0]?.isFinal && perfectNow

  const rules: Array<[string, boolean]> = [
    ['first_quiz', completedCount >= 1],
    ['perfect_score', perfectNow],
    ['speed_runner', speedNow],
    ['streak_3', streak >= 3],
    ['quiz_5', completedCount >= 5],
    ['explorer', distinctSubjects >= 2],
    ['accurate', accuracy >= 0.8],
    ['streak_7', streak >= 7],
    ['quiz_10', completedCount >= 10],
    ['points_500', totalPointsEarned >= 500],
    ['perfect_3', perfectCount >= 3],
    ['speed_3', speedCount >= 3],
    ['quiz_20', completedCount >= 20],
    ['streak_14', streak >= 14],
    ['points_1000', totalPointsEarned >= 1000],
    ['boss_slayer', bossPerfect],
    ['quiz_30', completedCount >= 30],
    ['streak_30', streak >= 30],
    ['perfectionist', perfectCount >= 10]
  ]

  for (const [code, ok] of rules) if (ok) await awardBadge(studentId, code)
}

export async function getStudentGamification(studentId: number) {
  await ensureBadges()
  const student = await db.select().from(schema.students).where(eq(schema.students.id, studentId)).limit(1)
  const badges = await db.select().from(schema.badges)
  const earned = await db
    .select({ badgeId: schema.studentBadges.badgeId })
    .from(schema.studentBadges)
    .where(eq(schema.studentBadges.studentId, studentId))
  const earnedIds = new Set(earned.map((e) => e.badgeId))

  const top3 = await db
    .select({ studentId: schema.quizAttempts.studentId, total: sql<number>`sum(${schema.quizAttempts.points})` })
    .from(schema.quizAttempts)
    .where(and(eq(schema.quizAttempts.status, 'COMPLETED'), eq(schema.quizAttempts.counted, true)))
    .groupBy(schema.quizAttempts.studentId)
    .orderBy(sql`sum(${schema.quizAttempts.points}) desc`)
    .limit(3)
  const inTop3 = top3.some((t) => t.studentId === studentId)
  const top3Badge = badges.find((b) => b.code === 'top_3')

  return {
    streak: student[0]?.streak ?? 0,
    total: badges.length,
    badges: badges.map((b) => ({
      ...b,
      earned: b.code === 'top_3' ? inTop3 : earnedIds.has(b.id)
    }))
  }
}
