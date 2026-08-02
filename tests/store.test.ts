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

  // Cleanup
  try {
    await Deno.remove('./mocks.db')
  }
  catch {}
})
