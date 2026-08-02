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
