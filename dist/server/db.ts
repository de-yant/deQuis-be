import 'dotenv/config'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schemaSqlite from './schema'
import * as schemaPg from './schema-pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const raw = process.env.DATABASE_URL || 'sqlite://data/dequis.db'

const isPostgres = raw.startsWith('postgres://') || raw.startsWith('postgresql://')

export const isPostgresDb = isPostgres

let db: any
let schema: any

if (isPostgres) {
  const cleanUrl = raw.replace(/\?.*$/, '')
  const client = postgres(cleanUrl, {
    prepare: false,
    ssl: cleanUrl.includes('neon.tech') ? 'require' : false
  })
  db = drizzlePg(client, { schema: schemaPg })
  schema = schemaPg
} else {
  const file = raw.startsWith('sqlite://') ? raw.replace('sqlite://', '') : raw
  const dbPath = resolve(__dirname, '..', file)
  mkdirSync(dirname(dbPath), { recursive: true })
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  db = drizzleSqlite(sqlite, { schema: schemaSqlite })
  schema = schemaSqlite
}

export { db, schema }
