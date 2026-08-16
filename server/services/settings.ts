import { eq } from 'drizzle-orm'
import { db, schema } from '../db'

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(schema.settings)
  const out: Record<string, string> = {}
  for (const r of rows) out[r.key] = r.value
  return out
}

export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1)
  return row[0]?.value ?? fallback
}

export async function setSettings(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    const existing = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1)
    if (existing[0]) {
      await db.update(schema.settings).set({ value, updatedAt: new Date() }).where(eq(schema.settings.key, key))
    } else {
      await db.insert(schema.settings).values({ key, value })
    }
  }
}
