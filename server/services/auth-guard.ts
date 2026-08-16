import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../auth/token'

function extractToken(req: Request): string | null {
  const header = req.headers.authorization
  if (!header) return null
  const [scheme, token] = header.split(' ')
  return scheme === 'Bearer' && token ? token : null
}

export interface TeacherSession {
  type: 'teacher'
  id: number
  role: 'SUPER_ADMIN' | 'TEACHER'
}

export interface StudentSession {
  type: 'student'
  studentId: number
}

export function requireTeacher(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const payload = verifyToken(token)
  if (!payload || payload.type !== 'teacher') {
    return res.status(401).json({ error: 'Token tidak valid' })
  }
  ;(req as Request & { teacher: TeacherSession }).teacher = payload as TeacherSession
  next()
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  requireTeacher(req, res, () => {
    const teacher = (req as Request & { teacher: TeacherSession }).teacher
    if (teacher.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' })
    next()
  })
}

export function requireStudent(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const payload = verifyToken(token)
  if (!payload || payload.type !== 'student') {
    return res.status(401).json({ error: 'Token siswa tidak valid' })
  }
  ;(req as Request & { student: StudentSession }).student = payload as StudentSession
  next()
}
