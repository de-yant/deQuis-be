import { pgTable, serial, integer, text, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

const now = () => new Date()

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull().default('TEACHER'),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(now)
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)]
)

export const classes = pgTable('classes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  academicYear: text('academic_year').notNull(),
  pin: text('pin'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(now)
})

export const students = pgTable(
  'students',
  {
    id: serial('id').primaryKey(),
    nisn: text('nisn').notNull(),
    name: text('name').notNull(),
    nickname: text('nickname'),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id),
    active: boolean('active').notNull().default(true),
    streak: integer('streak').notNull().default(0),
    lastStreakDate: text('last_streak_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(now)
  },
  (t) => [uniqueIndex('students_nisn_unique').on(t.nisn)]
)

export const subjects = pgTable(
  'subjects',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    accessCode: text('access_code'),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(now)
  },
  (t) => [uniqueIndex('subjects_code_unique').on(t.code)]
)

export const quizzes = pgTable(
  'quizzes',
  {
    id: serial('id').primaryKey(),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id),
    title: text('title').notNull(),
    topic: text('topic'),
    description: text('description'),
    orderNumber: integer('order_number').notNull().default(1),
    duration: integer('duration').notNull().default(30),
    points: integer('points').notNull().default(100),
    status: text('status').notNull().default('ACTIVE'),
    isFinal: boolean('is_final').notNull().default(false),
    scheduledStartAt: timestamp('scheduled_start_at', { withTimezone: true }),
    scheduledEndAt: timestamp('scheduled_end_at', { withTimezone: true }),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(now)
  },
  (t) => [
    index('quizzes_subject_idx').on(t.subjectId),
    index('quizzes_order_idx').on(t.subjectId, t.orderNumber)
  ]
)

export const questions = pgTable(
  'questions',
  {
    id: serial('id').primaryKey(),
    quizId: integer('quiz_id')
      .notNull()
      .references(() => quizzes.id),
    question: text('question').notNull(),
    optionA: text('option_a').notNull(),
    optionB: text('option_b').notNull(),
    optionC: text('option_c').notNull(),
    optionD: text('option_d').notNull(),
    correctAnswer: text('correct_answer').notNull(),
    points: integer('points').notNull().default(10),
    orderNumber: integer('order_number').notNull().default(1)
  },
  (t) => [index('questions_quiz_idx').on(t.quizId)]
)

export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: serial('id').primaryKey(),
    quizId: integer('quiz_id')
      .notNull()
      .references(() => quizzes.id),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().$defaultFn(now),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    score: integer('score').notNull().default(0),
    points: integer('points').notNull().default(0),
    counted: boolean('counted').notNull().default(true),
    status: text('status').notNull().default('STARTED')
  },
  (t) => [
    index('attempts_quiz_idx').on(t.quizId),
    index('attempts_student_idx').on(t.studentId)
  ]
)

export const answers = pgTable(
  'answers',
  {
    id: serial('id').primaryKey(),
    attemptId: integer('attempt_id')
      .notNull()
      .references(() => quizAttempts.id),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id),
    answer: text('answer'),
    isCorrect: boolean('is_correct').notNull().default(false),
    points: integer('points').notNull().default(0)
  },
  (t) => [
    index('answers_attempt_idx').on(t.attemptId),
    uniqueIndex('answers_attempt_question_unique').on(t.attemptId, t.questionId)
  ]
)

export const quizClasses = pgTable(
  'quiz_classes',
  {
    quizId: integer('quiz_id')
      .notNull()
      .references(() => quizzes.id),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id)
  },
  (t) => [uniqueIndex('quiz_classes_pk').on(t.quizId, t.classId)]
)

export const quizTeachers = pgTable(
  'quiz_teachers',
  {
    quizId: integer('quiz_id')
      .notNull()
      .references(() => quizzes.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id)
  },
  (t) => [uniqueIndex('quiz_teachers_pk').on(t.quizId, t.userId)]
)

export const teacherClasses = pgTable(
  'teacher_classes',
  {
    teacherId: integer('teacher_id')
      .notNull()
      .references(() => users.id),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id)
  },
  (t) => [uniqueIndex('teacher_classes_pk').on(t.teacherId, t.classId)]
)

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().$defaultFn(now)
})

export const themes = pgTable(
  'themes',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    tagline: text('tagline'),
    colorPrimary: text('color_primary').notNull().default('#6c8cff'),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(now)
  },
  (t) => [uniqueIndex('themes_code_unique').on(t.code)]
)

export const themeSubjects = pgTable(
  'theme_subjects',
  {
    themeId: integer('theme_id')
      .notNull()
      .references(() => themes.id),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id)
  },
  (t) => [uniqueIndex('theme_subjects_pk').on(t.themeId, t.subjectId)]
)

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    message: text('message').notNull(),
    type: text('type').notNull().default('info'),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(now)
  },
  (t) => [index('notifications_user_idx').on(t.userId)]
)

export const badges = pgTable(
  'badges',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon').notNull().default('award'),
    tier: text('tier').notNull().default('Easy'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(now)
  },
  (t) => [uniqueIndex('badges_code_unique').on(t.code)]
)

export const studentBadges = pgTable(
  'student_badges',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id),
    badgeId: integer('badge_id')
      .notNull()
      .references(() => badges.id),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().$defaultFn(now)
  },
  (t) => [uniqueIndex('student_badges_pk').on(t.studentId, t.badgeId)]
)

export const questionBank = pgTable(
  'question_bank',
  {
    id: serial('id').primaryKey(),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id),
    question: text('question').notNull(),
    optionA: text('option_a').notNull(),
    optionB: text('option_b').notNull(),
    optionC: text('option_c').notNull(),
    optionD: text('option_d').notNull(),
    correctAnswer: text('correct_answer').notNull(),
    points: integer('points').notNull().default(10),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(now)
  },
  (t) => [index('question_bank_subject_idx').on(t.subjectId)]
)

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  userName: text('user_name'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: integer('entity_id'),
  detail: text('detail'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(now)
})

export const usersRelations = relations(users, ({ many }) => ({
  quizzes: many(quizzes),
  subjects: many(subjects),
  quizTeachers: many(quizTeachers),
  teacherClasses: many(teacherClasses)
}))

export const classesRelations = relations(classes, ({ many }) => ({
  students: many(students),
  quizClasses: many(quizClasses),
  teacherClasses: many(teacherClasses)
}))

export const studentsRelations = relations(students, ({ one, many }) => ({
  classInfo: one(classes, { fields: [students.classId], references: [classes.id] }),
  attempts: many(quizAttempts)
}))

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  creator: one(users, { fields: [subjects.createdBy], references: [users.id] }),
  quizzes: many(quizzes)
}))

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  subject: one(subjects, { fields: [quizzes.subjectId], references: [subjects.id] }),
  creator: one(users, { fields: [quizzes.createdBy], references: [users.id] }),
  questions: many(questions),
  attempts: many(quizAttempts),
  quizClasses: many(quizClasses),
  quizTeachers: many(quizTeachers)
}))

export const questionsRelations = relations(questions, ({ one }) => ({
  quiz: one(quizzes, { fields: [questions.quizId], references: [quizzes.id] })
}))

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  quiz: one(quizzes, { fields: [quizAttempts.quizId], references: [quizzes.id] }),
  student: one(students, { fields: [quizAttempts.studentId], references: [students.id] }),
  answers: many(answers)
}))

export const answersRelations = relations(answers, ({ one }) => ({
  attempt: one(quizAttempts, { fields: [answers.attemptId], references: [quizAttempts.id] }),
  question: one(questions, { fields: [answers.questionId], references: [questions.id] })
}))
