import { Database } from '@db/sqlite'
import { SQLITE_PATH } from '../config.ts'
import { Mock, MockStore } from '../mocks/types.ts'

export class SqliteMockStore implements MockStore {
  private db!: Database

  async init(): Promise<void> {
    this.db = new Database(SQLITE_PATH)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mocks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL,
        priority INTEGER NOT NULL,
        config TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `)
  }

  async list(): Promise<Mock[]> {
    const rows = this.db.prepare('SELECT * FROM mocks ORDER BY priority DESC, createdAt DESC').values()
    return rows.map((row: any[]) => this.rowToMock(row))
  }

  async get(id: string): Promise<Mock | null> {
    const rows = this.db.prepare('SELECT * FROM mocks WHERE id = ?').values([id])
    if (rows.length === 0) return null
    return this.rowToMock(rows[0])
  }

  async create(m: Mock): Promise<Mock> {
    const config = JSON.stringify({
      response: m.response,
      conditions: m.conditions,
      elseResponse: m.elseResponse,
      sequence: m.sequence,
      sequenceMode: m.sequenceMode,
      script: m.script,
    })

    this.db.prepare(
      `INSERT INTO mocks (id, name, method, path, type, priority, config, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(m.id, m.name, m.method, m.path, m.type, m.priority, config, m.createdAt, m.updatedAt)
    return m
  }

  async update(id: string, m: Partial<Mock>): Promise<Mock> {
    const existing = await this.get(id)
    if (!existing) throw new Error(`Mock with id ${id} not found`)

    const updated = { ...existing, ...m, updatedAt: new Date().toISOString() }
    const config = JSON.stringify({
      response: updated.response,
      conditions: updated.conditions,
      elseResponse: updated.elseResponse,
      sequence: updated.sequence,
      sequenceMode: updated.sequenceMode,
      script: updated.script,
    })

    this.db.prepare(
      `UPDATE mocks SET name = ?, method = ?, path = ?, type = ?, priority = ?, config = ?, updatedAt = ?
       WHERE id = ?`,
    ).run(updated.name, updated.method, updated.path, updated.type, updated.priority, config, updated.updatedAt, id)
    return updated
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM mocks WHERE id = ?').run(id)
  }

  private rowToMock(row: any[]): Mock {
    const [id, name, method, path, type, priority, configStr, createdAt, updatedAt] = row
    const config = JSON.parse(configStr)
    return {
      id,
      name,
      method,
      path,
      type,
      priority,
      ...config,
      createdAt,
      updatedAt,
    }
  }
}
