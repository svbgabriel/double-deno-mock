import { assertEquals } from '@std/assert'
import app from '../src/server.ts'
import { store } from '../src/store/index.ts'
import { Mock } from '../src/mocks/types.ts'

Deno.test('Admin API - CRUD lifecycle', async () => {
  await store.init()

  // 1. Create a mock
  const createRes = await app.request('/__admin/mocks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'API Test',
      method: 'GET',
      path: '/api-test',
      type: 'static',
      response: { status: 200, body: 'ok' },
    }),
  })
  assertEquals(createRes.status, 201)
  const created = await createRes.json()
  const id = created.id

  // 2. List mocks
  const listRes = await app.request('/__admin/mocks')
  const list = await listRes.json()
  assertEquals(Array.isArray(list), true)
  assertEquals(list.some((m: Mock) => m.id === id), true)

  // 3. Update mock
  const updateRes = await app.request(`/__admin/mocks/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Updated API Test' }),
  })
  assertEquals(updateRes.status, 200)
  const updated = await updateRes.json()
  assertEquals(updated.name, 'Updated API Test')

  // 4. Delete mock
  const deleteRes = await app.request(`/__admin/mocks/${id}`, {
    method: 'DELETE',
  })
  assertEquals(deleteRes.status, 200)

  const getRes = await app.request(`/__admin/mocks/${id}`)
  assertEquals(getRes.status, 404)
})

Deno.test('Admin API - REST mock reset', async () => {
  await store.init()

  // 1. Create REST mock
  const createRes = await app.request('/__admin/mocks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'REST Reset Test',
      method: '*',
      path: '/api/reset-test',
      type: 'rest',
      restInitialState: [{ id: 1, name: 'Original' }],
    }),
  })
  assertEquals(createRes.status, 201)
  const created = await createRes.json()
  const id = created.id

  // 2. Mutate state via mock endpoint
  const mutateRes = await app.request('/api/reset-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Mutated' }),
  })
  assertEquals(mutateRes.status, 201)

  // Verify mutated state
  const getRes = await app.request('/api/reset-test')
  const items = await getRes.json()
  assertEquals(items.length, 2)
  assertEquals(items[1].name, 'Mutated')

  // 3. Reset mock
  const resetRes = await app.request(`/__admin/mocks/${id}/reset`, {
    method: 'POST',
  })
  assertEquals(resetRes.status, 200)

  // Verify reset state
  const getRes2 = await app.request('/api/reset-test')
  const items2 = await getRes2.json()
  assertEquals(items2.length, 1)
  assertEquals(items2[0].name, 'Original')

  // Cleanup
  await app.request(`/__admin/mocks/${id}`, { method: 'DELETE' })
})
