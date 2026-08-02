import { DB_DRIVER } from '../config.ts'
import { MockStore } from '../mocks/types.ts'
import { SqliteMockStore } from './sqlite.ts'
import { PostgresMockStore } from './postgres.ts'

export function createStore(): MockStore {
  if (DB_DRIVER === 'postgres') {
    return new PostgresMockStore()
  }
  return new SqliteMockStore()
}

export const store = createStore()
