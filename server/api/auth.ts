import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db'
import { verifyPassword } from '../auth/password'
import { signToken } from '../auth/token'

const router = Router()

router.post('/teacher/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  if (!email || !password) {
    return res.status(400).json({ error: 'email dan password wajib diisi' })
  }
  const found = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1)
  const user = found[0]
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Email atau password salah' })
  }
  const token = signToken({ type: 'teacher', id: user.id, role: user.role })
  return res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  })
})

export { router as authRouter }
