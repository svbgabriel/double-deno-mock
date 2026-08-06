import { assertEquals } from '@std/assert'
import { MatchingEngine } from '../src/mocks/engine.ts'
import { Mock, MockStore } from '../src/mocks/types.ts'

class MockStoreStub implements MockStore {
  init(): Promise<void> {
    return Promise.resolve()
  }
  list(): Promise<Mock[]> {
    return Promise.resolve([])
  }
  get(): Promise<Mock | null> {
    return Promise.resolve(null)
  }
  create(m: Mock): Promise<Mock> {
    return Promise.resolve(m)
  }
  update(_id: string, _m: Partial<Mock>): Promise<Mock> {
    return Promise.resolve({} as Mock)
  }
  delete(): Promise<void> {
    return Promise.resolve()
  }
}

Deno.test('MatchingEngine - priority matching', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const mock1: Mock = {
    id: '1',
    name: 'Low priority',
    method: 'GET',
    path: '/test',
    type: 'static',
    priority: 1,
    response: { status: 200, body: 'low' },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }
  const mock2: Mock = {
    id: '2',
    name: 'High priority',
    method: 'GET',
    path: '/test',
    type: 'static',
    priority: 10,
    response: { status: 200, body: 'high' },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock1, mock2])

  const req = new Request('http://localhost/test')
  const res = await engine.handleRequest(req)

  assertEquals(res?.body, 'high')
})

Deno.test('MatchingEngine - path pattern matching', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const mock: Mock = {
    id: '1',
    name: 'Pattern',
    method: 'GET',
    path: '/users/:id',
    type: 'static',
    priority: 1,
    response: { status: 200, body: 'user' },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  const req = new Request('http://localhost/users/123')
  const res = await engine.handleRequest(req)

  assertEquals(res?.body, 'user')
})

Deno.test('Conditional Responder', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const mock: Mock = {
    id: '1',
    name: 'Cond',
    method: 'GET',
    path: '/test',
    type: 'conditional',
    priority: 1,
    conditions: [
      { source: 'header', key: 'x-test', op: 'equals', value: 'secret', response: { status: 200, body: 'match' } },
    ],
    elseResponse: { status: 403, body: 'no-match' },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  // Case 1: Match
  const req1 = new Request('http://localhost/test', { headers: { 'x-test': 'secret' } })
  const res1 = await engine.handleRequest(req1)
  assertEquals(res1?.body, 'match')

  // Case 2: No match
  const req2 = new Request('http://localhost/test', { headers: { 'x-test': 'wrong' } })
  const res2 = await engine.handleRequest(req2)
  assertEquals(res2?.body, 'no-match')
  assertEquals(res2?.status, 403)
})
