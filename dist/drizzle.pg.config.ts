import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/schema-pg.ts',
  out: './db/migrations-pg',
  dbCredentials: {
    url: process.env.DATABASE_URL || ''
  }
})
