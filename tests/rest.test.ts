import { assertArrayIncludes, assertEquals, assertExists } from '@std/assert'
import { MatchingEngine } from '../src/mocks/engine.ts'
import { Mock, MockStore } from '../src/mocks/types.ts'

class MockStoreStub implements MockStore {
  public lastUpdatedState: unknown[] | null = null
  public lastUpdatedId: string | null = null

  init(): Promise<void> { return Promise.resolve() }
  list(): Promise<Mock[]> { return Promise.resolve([]) }
  get(): Promise<Mock | null> { return Promise.resolve(null) }
  create(m: Mock): Promise<Mock> { return Promise.resolve(m) }
  update(_id: string, _m: Partial<Mock>): Promise<Mock> { return Promise.resolve({} as Mock) }
  delete(): Promise<void> { return Promise.resolve() }
  updateState(id: string, state: unknown[]): Promise<void> {
    this.lastUpdatedId = id
    this.lastUpdatedState = state
    return Promise.resolve()
  }
}

Deno.test('REST Responder - Collection GET', async () => {
  const store = new MockStoreStub()
  const engine = new MatchingEngine(store)

  const mock: Mock = {
    id: 'rest-1',
    name: 'REST',
    method: '*',
    path: '/items',
    type: 'rest',
    priority: 1,
    state: [{ id: '1', name: 'Item 1' }],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  const res = await engine.handleRequest(new Request('http://localhost/items'))
  assertEquals(res?.status, 200)
  assertEquals(JSON.parse(res?.body || '[]'), [{ id: '1', name: 'Item 1' }])
})

Deno.test('REST Responder - Collection POST', async () => {
  const store = new MockStoreStub()
  const engine = new MatchingEngine(store)

  const mock: Mock = {
    id: 'rest-1',
    name: 'REST',
    method: '*',
    path: '/items',
    type: 'rest',
    priority: 1,
    state: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  const res = await engine.handleRequest(new Request('http://localhost/items', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'New Item' })
  }))

  assertEquals(res?.status, 201)
  const body = JSON.parse(res?.body || '{}')
  assertEquals(body.name, 'New Item')
  assertEquals(typeof body.id, 'string')
  
  // Verify persistence
  assertEquals(store.lastUpdatedId, 'rest-1')
  assertEquals(store.lastUpdatedState?.length, 1)
  assertExists(store.lastUpdatedState)
  assertArrayIncludes(store.lastUpdatedState, [{ id: body.id, name: body.name }])
})

Deno.test('REST Responder - Item GET/PUT/PATCH/DELETE', async () => {
  const store = new MockStoreStub()
  const engine = new MatchingEngine(store)

  const mock: Mock = {
    id: 'rest-1',
    name: 'REST',
    method: '*',
    path: '/items/:id',
    type: 'rest',
    priority: 1,
    state: [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  // GET
  const resGet = await engine.handleRequest(new Request('http://localhost/items/1'))
  assertEquals(resGet?.status, 200)
  assertEquals(JSON.parse(resGet?.body || '{}').name, 'Item 1')

  // GET 404
  const resGet404 = await engine.handleRequest(new Request('http://localhost/items/3'))
  assertEquals(resGet404?.status, 404)

  // PUT
  const resPut = await engine.handleRequest(new Request('http://localhost/items/1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Updated 1' })
  }))
  assertEquals(resPut?.status, 200)
  const putBody = JSON.parse(resPut?.body || '{}')
  assertEquals(putBody.name, 'Updated 1')
  assertEquals(putBody.id, '1')
  assertExists(store.lastUpdatedState)
  assertArrayIncludes(store.lastUpdatedState, [{ id: putBody.id, name: putBody.name }])

  // PATCH
  const resPatch = await engine.handleRequest(new Request('http://localhost/items/2', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ description: 'New field' })
  }))
  assertEquals(resPatch?.status, 200)
  const patchBody = JSON.parse(resPatch?.body || '{}')
  assertEquals(patchBody.name, 'Item 2')
  assertEquals(patchBody.description, 'New field')
  assertExists(store.lastUpdatedState)
  assertArrayIncludes(store.lastUpdatedState, [{ id: patchBody.id, description: patchBody.description, name: patchBody.name }])

  // DELETE
  const resDelete = await engine.handleRequest(new Request('http://localhost/items/1', {
    method: 'DELETE'
  }))
  assertEquals(resDelete?.status, 204)
  assertEquals(store.lastUpdatedState?.length, 1)
  assertArrayIncludes(store.lastUpdatedState, [{ id: '2', name: 'Item 2', description: 'New field' }])
})

Deno.test('REST Responder - Custom id field', async () => {
  const store = new MockStoreStub()
  const engine = new MatchingEngine(store)

  const mock: Mock = {
    id: 'rest-sku',
    name: 'REST SKU',
    method: '*',
    path: '/products/:id',
    type: 'rest',
    priority: 1,
    restIdField: 'sku',
    state: [{ sku: 'ABC', price: 100 }],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  const res = await engine.handleRequest(new Request('http://localhost/products/ABC'))
  assertEquals(res?.status, 200)
  assertEquals(JSON.parse(res?.body || '{}').price, 100)
})
