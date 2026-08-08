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
  state: string | null,
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
        state TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `)
    try {
      this.db.exec('ALTER TABLE mocks ADD COLUMN state TEXT')
    } catch (_) {
      // ignore if column already exists
    }
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
      restIdField: m.restIdField,
      restInitialState: m.restInitialState,
    })
    const state = m.state ? JSON.stringify(m.state) : (m.restInitialState ? JSON.stringify(m.restInitialState) : null)

    this.db.prepare(
      `INSERT INTO mocks (id, name, method, path, type, priority, config, state, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(m.id, m.name, m.method, m.path, m.type, m.priority, config, state, m.createdAt, m.updatedAt)
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
      restIdField: updated.restIdField,
      restInitialState: updated.restInitialState,
    })
    const state = updated.state ? JSON.stringify(updated.state) : null

    this.db.prepare(
      `UPDATE mocks SET name = ?, method = ?, path = ?, type = ?, priority = ?, config = ?, state = ?, updatedAt = ?
       WHERE id = ?`,
    ).run(
      updated.name,
      updated.method,
      updated.path,
      updated.type,
      updated.priority,
      config,
      state,
      updated.updatedAt,
      id,
    )
    return updated
  }

  updateState(id: string, state: unknown[]): Promise<void> {
    this.db.prepare('UPDATE mocks SET state = ?, updatedAt = ? WHERE id = ?').run(
      JSON.stringify(state),
      new Date().toISOString(),
      id,
    )
    return Promise.resolve()
  }

  delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM mocks WHERE id = ?').run(id)
    return Promise.resolve()
  }

  private rowToMock(row: MockRow): Mock {
    const [id, name, method, path, type, priority, configStr, stateStr, createdAt, updatedAt] = row
    const config = JSON.parse(configStr)
    const state = stateStr ? JSON.parse(stateStr) : undefined
    return {
      id,
      name,
      method,
      path,
      type,
      priority,
      ...config,
      state,
      createdAt,
      updatedAt,
    }
  }
}
