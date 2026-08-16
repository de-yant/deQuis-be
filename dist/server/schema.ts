import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['SUPER_ADMIN', 'TEACHER'] }).notNull().default('TEACHER'),
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)]
)

export const classes = sqliteTable('classes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  academicYear: text('academic_year').notNull(),
  pin: text('pin'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

export const students = sqliteTable(
  'students',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nisn: text('nisn').notNull(),
    name: text('name').notNull(),
    nickname: text('nickname'),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    streak: integer('streak').notNull().default(0),
    lastStreakDate: text('last_streak_date'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
  },
  (t) => [uniqueIndex('students_nisn_unique').on(t.nisn)]
)

export const subjects = sqliteTable(
  'subjects',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    accessCode: text('access_code'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
  },
  (t) => [uniqueIndex('subjects_code_unique').on(t.code)]
)

export const quizzes = sqliteTable(
  'quizzes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id),
    title: text('title').notNull(),
    topic: text('topic'),
    description: text('description'),
    orderNumber: integer('order_number').notNull().default(1),
    duration: integer('duration').notNull().default(30),
    points: integer('points').notNull().default(100),
    status: text('status', { enum: ['ACTIVE', 'INACTIVE'] }).notNull().default('ACTIVE'),
    isFinal: integer('is_final', { mode: 'boolean' }).notNull().default(false),
    scheduledStartAt: integer('scheduled_start_at', { mode: 'timestamp' }),
    scheduledEndAt: integer('scheduled_end_at', { mode: 'timestamp' }),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
  },
  (t) => [
    index('quizzes_subject_idx').on(t.subjectId),
    index('quizzes_order_idx').on(t.subjectId, t.orderNumber)
  ]
)

export const questions = sqliteTable(
  'questions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    quizId: integer('quiz_id')
      .notNull()
      .references(() => quizzes.id),
    question: text('question').notNull(),
    optionA: text('option_a').notNull(),
    optionB: text('option_b').notNull(),
    optionC: text('option_c').notNull(),
    optionD: text('option_d').notNull(),
    correctAnswer: text('correct_answer', { enum: ['A', 'B', 'C', 'D'] }).notNull(),
    points: integer('points').notNull().default(10),
    orderNumber: integer('order_number').notNull().default(1)
  },
  (t) => [index('questions_quiz_idx').on(t.quizId)]
)

export const quizAttempts = sqliteTable(
  'quiz_attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    quizId: integer('quiz_id')
      .notNull()
      .references(() => quizzes.id),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id),
    startedAt: integer('started_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    finishedAt: integer('finished_at', { mode: 'timestamp' }),
    score: integer('score').notNull().default(0),
    points: integer('points').notNull().default(0),
    counted: integer('counted', { mode: 'boolean' }).notNull().default(true),
    status: text('status', {
      enum: ['STARTED', 'COMPLETED', 'EXPIRED', 'CANCELLED']
    })
      .notNull()
      .default('STARTED')
  },
  (t) => [
    index('attempts_quiz_idx').on(t.quizId),
    index('attempts_student_idx').on(t.studentId)
  ]
)

export const answers = sqliteTable(
  'answers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    attemptId: integer('attempt_id')
      .notNull()
      .references(() => quizAttempts.id),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id),
    answer: text('answer', { enum: ['A', 'B', 'C', 'D'] }),
    isCorrect: integer('is_correct', { mode: 'boolean' }).notNull().default(false),
    points: integer('points').notNull().default(0)
  },
  (t) => [
    index('answers_attempt_idx').on(t.attemptId),
    uniqueIndex('answers_attempt_question_unique').on(t.attemptId, t.questionId)
  ]
)

export const quizClasses = sqliteTable(
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

export const quizTeachers = sqliteTable(
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

export const teacherClasses = sqliteTable(
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

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

export const themes = sqliteTable(
  'themes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    tagline: text('tagline'),
    colorPrimary: text('color_primary').notNull().default('#6c8cff'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
  },
  (t) => [uniqueIndex('themes_code_unique').on(t.code)]
)

export const themeSubjects = sqliteTable(
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

export const notifications = sqliteTable(
  'notifications',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    message: text('message').notNull(),
    type: text('type').notNull().default('info'),
    read: integer('read', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
  },
  (t) => [index('notifications_user_idx').on(t.userId)]
)

export const badges = sqliteTable('badges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon').notNull().default('award'),
    tier: text('tier').notNull().default('Easy'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

export const studentBadges = sqliteTable(
  'student_badges',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id),
    badgeId: integer('badge_id')
      .notNull()
      .references(() => badges.id),
    earnedAt: integer('earned_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
  },
  (t) => [uniqueIndex('student_badges_pk').on(t.studentId, t.badgeId)]
)

export const questionBank = sqliteTable(
  'question_bank',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id),
    question: text('question').notNull(),
    optionA: text('option_a').notNull(),
    optionB: text('option_b').notNull(),
    optionC: text('option_c').notNull(),
    optionD: text('option_d').notNull(),
    correctAnswer: text('correct_answer', { enum: ['A', 'B', 'C', 'D'] }).notNull(),
    points: integer('points').notNull().default(10),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
  },
  (t) => [index('question_bank_subject_idx').on(t.subjectId)]
)

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  userName: text('user_name'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: integer('entity_id'),
  detail: text('detail'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
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
