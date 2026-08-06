import { Database } from '@db/sqlite'
import { SQLITE_PATH } from '../config.ts'
import { Mock, MockStore, MockType } from '../mocks/types.ts'

type MockRow = [
  id: string,
  name: string,
  method: string,
  path: string,
  type: MockType,
  priority: number,
  config: string,
  createdAt: string,
  updatedAt: string,
]

export class SqliteMockStore implements MockStore {
  private db!: Database

  init(): Promise<void> {
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
    return Promise.resolve()
  }

  list(): Promise<Mock[]> {
    const rows = this.db.prepare('SELECT * FROM mocks ORDER BY priority DESC, createdAt DESC').values<MockRow>()
    return Promise.resolve(rows.map((row) => this.rowToMock(row)))
  }

  get(id: string): Promise<Mock | null> {
    const rows = this.db.prepare('SELECT * FROM mocks WHERE id = ?').values<MockRow>([id])
    if (rows.length === 0) return Promise.resolve(null)
    return Promise.resolve(this.rowToMock(rows[0]))
  }

  create(m: Mock): Promise<Mock> {
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
    return Promise.resolve(m)
  }

  async update(id: string, m: Partial<Mock>): Promise<Mock> {
    const existing = await this.get(id)
    if (!existing) throw new Error(`Mock with id ${id} not found`)

    const updated = { ...existing, ...m, id, updatedAt: new Date().toISOString() }
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

  delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM mocks WHERE id = ?').run(id)
    return Promise.resolve()
  }

  private rowToMock(row: MockRow): Mock {
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
