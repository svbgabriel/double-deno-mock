import { assertEquals } from '@std/assert'
import { SqliteMockStore } from '../src/store/sqlite.ts'
import { Mock } from '../src/mocks/types.ts'

Deno.test('SqliteMockStore lifecycle', async () => {
  const store = new SqliteMockStore()
  await store.init()

  const mock: Mock = {
    id: 'test-1',
    name: 'Test Mock',
    method: 'GET',
    path: '/test',
    type: 'static',
    priority: 0,
    response: { status: 200, body: 'hello' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await store.create(mock)

  const fetched = await store.get('test-1')
  assertEquals(fetched?.name, 'Test Mock')
  assertEquals(fetched?.response?.body, 'hello')

  await store.update('test-1', { name: 'Updated Name' })
  const updated = await store.get('test-1')
  assertEquals(updated?.name, 'Updated Name')

  const list = await store.list()
  assertEquals(list.length, 1)

  await store.delete('test-1')
  const deleted = await store.get('test-1')
  assertEquals(deleted, null)
})

Deno.test('SqliteMockStore REST state', async () => {
  const store = new SqliteMockStore()
  await store.init()

  const restMock: Mock = {
    id: 'rest-1',
    name: 'REST Mock',
    method: '*',
    path: '/api/items',
    type: 'rest',
    priority: 0,
    restIdField: 'id',
    restInitialState: [{ id: 1, name: 'Item 1' }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await store.create(restMock)

  const fetched = await store.get('rest-1')
  assertEquals(fetched?.state, [{ id: 1, name: 'Item 1' }])
  assertEquals(fetched?.restInitialState, [{ id: 1, name: 'Item 1' }])

  await store.updateState('rest-1', [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }])
  const updated = await store.get('rest-1')
  assertEquals(updated?.state, [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }])

  await store.delete('rest-1')
})
