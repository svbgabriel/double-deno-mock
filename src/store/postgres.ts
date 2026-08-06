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
  state?: unknown[] | string
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
        state JSONB,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `)
    await this.client.queryArray(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mocks' AND column_name='state') THEN
          ALTER TABLE mocks ADD COLUMN state JSONB;
        END IF;
      END
      $$;
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
      restIdField: mock.restIdField,
      restInitialState: mock.restInitialState,
    }
    const state = mock.state || mock.restInitialState || null

    await this.client.queryArray(
      `INSERT INTO mocks (id, name, method, path, type, priority, config, state, createdAt, updatedAt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        mock.id,
        mock.name,
        mock.method,
        mock.path,
        mock.type,
        mock.priority,
        JSON.stringify(config),
        state ? JSON.stringify(state) : null,
        mock.createdAt,
        mock.updatedAt,
      ],
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
      restIdField: updated.restIdField,
      restInitialState: updated.restInitialState,
    }
    const state = updated.state || null

    await this.client.queryArray(
      `UPDATE mocks SET name = $1, method = $2, path = $3, type = $4, priority = $5, config = $6, state = $7, updatedAt = $8
       WHERE id = $9`,
      [
        updated.name,
        updated.method,
        updated.path,
        updated.type,
        updated.priority,
        JSON.stringify(config),
        state ? JSON.stringify(state) : null,
        updated.updatedAt,
        id,
      ],
    )
    return updated
  }

  async updateState(id: string, state: unknown[]): Promise<void> {
    await this.client.queryArray(
      'UPDATE mocks SET state = $1, updatedAt = $2 WHERE id = $3',
      [JSON.stringify(state), new Date().toISOString(), id],
    )
  }

  async delete(id: string): Promise<void> {
    await this.client.queryArray('DELETE FROM mocks WHERE id = $1', [id])
  }

  private rowToMock(row: MockRow): Mock {
    const { id, name, method, path, type, priority, config, state, createdAt, updatedAt } = row
    return {
      id,
      name,
      method,
      path,
      type,
      priority,
      ...(typeof config === 'string' ? JSON.parse(config) : config),
      state: typeof state === 'string' ? JSON.parse(state) : state,
      createdAt,
      updatedAt,
    }
  }
}
