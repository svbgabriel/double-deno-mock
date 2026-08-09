import { DB_DRIVER } from '../config.ts'
import { MockStore } from '../mocks/types.ts'
import { PostgresMockStore } from './postgres.ts'
import { InMemoryMockStore } from './memory.ts'

export function createStore(): MockStore {
  if (DB_DRIVER === 'postgres') {
    return new PostgresMockStore()
  }

  return new InMemoryMockStore()
}

export const store = createStore()
