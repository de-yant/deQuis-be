import type { Request } from 'express'
import { db, schema } from '../db'

export async function logAudit(
  req: Request,
  action: string,
  entity: string,
  entityId?: number,
  detail?: string
) {
  try {
    const teacher = (req as Request & { teacher?: { id: number } }).teacher
    await db.insert(schema.auditLogs).values({
      userId: teacher?.id ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      detail: detail ?? null
    })
  } catch (e) {
    console.error('audit log error:', e)
  }
}
