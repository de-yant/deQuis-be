import { eq, and, asc, inArray } from 'drizzle-orm'
import { db, schema } from '../db'
import { getSetting } from './settings'

export type RoadmapStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED'

export interface RoadmapItem {
  id: number
  title: string
  topic: string | null
  description: string | null
  orderNumber: number
  duration: number
  points: number
  isFinal: boolean
  scheduledStartAt: Date | null
  scheduledEndAt: Date | null
  status: RoadmapStatus
  attemptId: number | null
}

export async function getRoadmap(subjectId: number, studentId: number): Promise<RoadmapItem[]> {
  const sequentialUnlock = (await getSetting('sequential_unlock', 'true')) === 'true'

  const quizzes = await db
    .select()
    .from(schema.quizzes)
    .where(and(eq(schema.quizzes.subjectId, subjectId), eq(schema.quizzes.status, 'ACTIVE')))
    .orderBy(asc(schema.quizzes.orderNumber))

  const attempts = await db
    .select()
    .from(schema.quizAttempts)
    .where(
      and(
        eq(schema.quizAttempts.studentId, studentId),
        quizzes.length > 0
          ? inArray(
              schema.quizAttempts.quizId,
              quizzes.map((q) => q.id)
            )
          : eq(schema.quizAttempts.quizId, -1)
      )
    )

  const byQuiz = new Map(attempts.map((a) => [a.quizId, a]))

  return quizzes.map((quiz, index) => {
    const attempt = byQuiz.get(quiz.id)
    let status: RoadmapStatus
    if (attempt) {
      if (attempt.status === 'COMPLETED') {
        status = 'COMPLETED'
      } else if (attempt.status === 'STARTED') {
        status = 'IN_PROGRESS'
      } else {
        status = 'AVAILABLE'
      }
    } else {
      const prevCompleted =
        !sequentialUnlock ||
        index === 0 ||
        (() => {
          const prev = quizzes[index - 1]
          const prevAttempt = byQuiz.get(prev.id)
          return prevAttempt?.status === 'COMPLETED'
        })()
      status = prevCompleted ? 'AVAILABLE' : 'LOCKED'
    }

    if (status === 'AVAILABLE' && quiz.scheduledStartAt && Date.now() < new Date(quiz.scheduledStartAt).getTime()) {
      status = 'LOCKED'
    }
    return {
      id: quiz.id,
      title: quiz.title,
      topic: quiz.topic,
      description: quiz.description,
      orderNumber: quiz.orderNumber,
      duration: quiz.duration,
      points: quiz.points,
      isFinal: quiz.isFinal,
      scheduledStartAt: quiz.scheduledStartAt,
      scheduledEndAt: quiz.scheduledEndAt,
      status,
      attemptId: attempt?.id ?? null
    }
  })
}
