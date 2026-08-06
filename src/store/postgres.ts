import { Client } from '@db/postgres'
import { POSTGRES_URL } from '../config.ts'
import { Mock, MockStore, MockType } from '../mocks/types.ts'

interface MockRow {
  id: string
  name: string
  method: string
  path: string
  type: MockType
  priority: number
  config: string | Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export class PostgresMockStore implements MockStore {
  private client!: Client

  async init(): Promise<void> {
    this.client = new Client(POSTGRES_URL)
    await this.client.connect()
    await this.client.queryArray(`
      CREATE TABLE IF NOT EXISTS mocks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL,
        priority INTEGER NOT NULL,
        config JSONB NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `)
  }

  async list(): Promise<Mock[]> {
    const result = await this.client.queryObject<MockRow>(
      'SELECT * FROM mocks ORDER BY priority DESC, createdAt DESC',
    )
    return result.rows.map((row) => this.rowToMock(row))
  }

  async get(id: string): Promise<Mock | null> {
    const result = await this.client.queryObject<MockRow>(
      'SELECT * FROM mocks WHERE id = $1',
      [id],
    )
    if (result.rows.length === 0) return null
    return this.rowToMock(result.rows[0])
  }

  async create(mock: Mock): Promise<Mock> {
    const config = {
      response: mock.response,
      conditions: mock.conditions,
      elseResponse: mock.elseResponse,
      sequence: mock.sequence,
      sequenceMode: mock.sequenceMode,
      script: mock.script,
    }

    await this.client.queryArray(
      `INSERT INTO mocks (id, name, method, path, type, priority, config, createdAt, updatedAt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [mock.id, mock.name, mock.method, mock.path, mock.type, mock.priority, JSON.stringify(config), mock.createdAt, mock.updatedAt],
    )
    return mock
  }

  async update(id: string, mock: Partial<Mock>): Promise<Mock> {
    const existing = await this.get(id)
    if (!existing) throw new Error(`Mock with id ${id} not found`)

    const updated = { ...existing, ...mock, id, updatedAt: new Date().toISOString() }
    const config = {
      response: updated.response,
      conditions: updated.conditions,
      elseResponse: updated.elseResponse,
      sequence: updated.sequence,
      sequenceMode: updated.sequenceMode,
      script: updated.script,
    }

    await this.client.queryArray(
      `UPDATE mocks SET name = $1, method = $2, path = $3, type = $4, priority = $5, config = $6, updatedAt = $7
       WHERE id = $8`,
      [
        updated.name,
        updated.method,
        updated.path,
        updated.type,
        updated.priority,
        JSON.stringify(config),
        updated.updatedAt,
        id,
      ],
    )
    return updated
  }

  async delete(id: string): Promise<void> {
    await this.client.queryArray('DELETE FROM mocks WHERE id = $1', [id])
  }

  private rowToMock(row: MockRow): Mock {
    const { id, name, method, path, type, priority, config, createdAt, updatedAt } = row
    return {
      id,
      name,
      method,
      path,
      type,
      priority,
      ...(typeof config === 'string' ? JSON.parse(config) : config),
      createdAt,
      updatedAt,
    }
  }
}
