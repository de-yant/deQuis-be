import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/schema.ts',
  out: './db/migrations',
  dbCredentials: {
    url: './data/dequis.db'
  },
  verbose: true,
  strict: true
})
