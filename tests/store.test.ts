import { assertEquals } from '@std/assert'
import { InMemoryMockStore } from '../src/store/memory.ts'
import { Mock } from '../src/mocks/types.ts'

Deno.test('InMemoryMockStore lifecycle', async () => {
  const store = new InMemoryMockStore()
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

Deno.test('InMemoryMockStore REST state', async () => {
  const store = new InMemoryMockStore()
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

Deno.test('InMemoryMockStore ordering', async () => {
  const store = new InMemoryMockStore()
  await store.init()

  const m1: Mock = {
    id: 'm1',
    name: 'M1',
    method: 'GET',
    path: '/1',
    type: 'static',
    priority: 10,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  const m2: Mock = {
    id: 'm2',
    name: 'M2',
    method: 'GET',
    path: '/2',
    type: 'static',
    priority: 5,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  }

  const m3: Mock = {
    id: 'm3',
    name: 'M3',
    method: 'GET',
    path: '/3',
    type: 'static',
    priority: 10,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  }

  // Add in random order
  await store.create(m2)
  await store.create(m1)
  await store.create(m3)

  const list = await store.list()
  // Should be ordered by priority DESC, then createdAt DESC
  // Expected order: m3 (p10, newer), m1 (p10, older), m2 (p5)
  assertEquals(list[0].id, 'm3')
  assertEquals(list[1].id, 'm1')
  assertEquals(list[2].id, 'm2')
})
