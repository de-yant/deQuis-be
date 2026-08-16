import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import type { NextFunction, Request, Response } from 'express'
import { authRouter } from './api/auth'
import { studentRouter } from './api/student'
import { rankingRouter } from './api/ranking'
import { adminRouter } from './api/admin'

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', name: 'deQuis API', version: '1.0.0' })
})

app.use('/api/auth', authRouter)
app.use('/api/student', studentRouter)
app.use('/api/ranking', rankingRouter)
app.use('/api/admin', adminRouter)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Route tidak ditemukan' })
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = Number(process.env.PORT) || 3001

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`deQuis API running at http://localhost:${PORT}`)
  })
}

export default app
