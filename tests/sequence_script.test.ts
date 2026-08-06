import { assertEquals, assertStringIncludes } from '@std/assert'
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
  updateState(_id: string, _state: unknown[]): Promise<void> {
    return Promise.resolve()
  }
  delete(): Promise<void> {
    return Promise.resolve()
  }
}

Deno.test('Sequence Responder - cycle mode', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const mock: Mock = {
    id: 'seq-1',
    name: 'Seq',
    method: 'GET',
    path: '/seq',
    type: 'sequence',
    priority: 1,
    sequence: [
      { status: 200, body: 'one' },
      { status: 200, body: 'two' },
    ],
    sequenceMode: 'cycle',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  const req = new Request('http://localhost/seq')

  assertEquals((await engine.handleRequest(req))?.body, 'one')
  assertEquals((await engine.handleRequest(req))?.body, 'two')
  assertEquals((await engine.handleRequest(req))?.body, 'one') // cycle
})

Deno.test('Script Responder - dynamic response', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const mock: Mock = {
    id: 'script-1',
    name: 'Script',
    method: 'POST',
    path: '/script',
    type: 'script',
    priority: 1,
    script: `
      const name = context.body.name || 'world';
      return { status: 200, body: 'hello ' + name };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  const req = new Request('http://localhost/script', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Junie' }),
  })

  const res = await engine.handleRequest(req)
  assertEquals(res?.body, 'hello Junie')
})

Deno.test('Script Responder - timeout', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const mock: Mock = {
    id: 'script-2',
    name: 'Slow Script',
    method: 'GET',
    path: '/slow',
    type: 'script',
    priority: 1,
    script: `
      await new Promise(r => setTimeout(r, 5000));
      return { status: 200, body: 'done' };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  const req = new Request('http://localhost/slow')
  const res = await engine.handleRequest(req)

  assertEquals(res?.status, 500)
  assertStringIncludes(res?.body || '', 'timed out')
})

Deno.test('Script Responder - object body auto-serialization', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const mock: Mock = {
    id: 'script-obj',
    name: 'Object Body Script',
    method: 'GET',
    path: '/json-obj',
    type: 'script',
    priority: 1,
    script: `
      return { status: 200, body: { greeting: 'hello', count: 42 } };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  const req = new Request('http://localhost/json-obj')
  const res = await engine.handleRequest(req)

  assertEquals(res?.status, 200)
  assertEquals(res?.body, JSON.stringify({ greeting: 'hello', count: 42 }))
  assertEquals(res?.contentType, 'application/json')
})

Deno.test('Script Responder - primitive body coercion', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const mock: Mock = {
    id: 'script-prim',
    name: 'Primitive Body Script',
    method: 'GET',
    path: '/prim',
    type: 'script',
    priority: 1,
    script: `
      return { status: 201, body: 12345 };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  const req = new Request('http://localhost/prim')
  const res = await engine.handleRequest(req)

  assertEquals(res?.status, 201)
  assertEquals(res?.body, '12345')
})

Deno.test('Script Responder - invalid or missing status', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const mockMissing: Mock = {
    id: 'script-no-status',
    name: 'Missing Status Script',
    method: 'GET',
    path: '/no-status',
    type: 'script',
    priority: 1,
    script: `
      return { body: 'no status property' };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mockMissing])

  const res = await engine.handleRequest(new Request('http://localhost/no-status'))
  assertEquals(res?.status, 500)
  assertStringIncludes(res?.body || '', 'Script error:')

  const mockInvalid: Mock = {
    id: 'script-invalid-status',
    name: 'Invalid Status Script',
    method: 'GET',
    path: '/invalid-status',
    type: 'script',
    priority: 1,
    script: `
      return { status: 999, body: 'bad status' };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mockInvalid])
  const res2 = await engine.handleRequest(new Request('http://localhost/invalid-status'))
  assertEquals(res2?.status, 500)
  assertStringIncludes(res2?.body || '', 'Script error:')
})

Deno.test('Script Responder - malformed headers', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const mock: Mock = {
    id: 'script-bad-headers',
    name: 'Bad Headers Script',
    method: 'GET',
    path: '/bad-headers',
    type: 'script',
    priority: 1,
    script: `
      return { status: 200, headers: 'invalid-header-type' };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  const res = await engine.handleRequest(new Request('http://localhost/bad-headers'))
  assertEquals(res?.status, 500)
  assertStringIncludes(res?.body || '', 'Script error:')
})

Deno.test('Script Responder - non-JSON request body', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const mock: Mock = {
    id: 'script-non-json',
    name: 'Non JSON Script',
    method: 'POST',
    path: '/non-json',
    type: 'script',
    priority: 1,
    script: `
      if (!context.body) {
        return { status: 200, body: 'null body handled' };
      }
      return { status: 200, body: 'has body' };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  const req = new Request('http://localhost/non-json', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'plain text body',
  })

  const res = await engine.handleRequest(req)
  assertEquals(res?.status, 200)
  assertEquals(res?.body, 'null body handled')
})

Deno.test('Script Responder - per-mock timeout override and recovery', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const slowMock: Mock = {
    id: 'script-override-timeout',
    name: 'Override Timeout Script',
    method: 'GET',
    path: '/override-timeout',
    type: 'script',
    priority: 1,
    scriptTimeoutMs: 200,
    script: `
      await new Promise(r => setTimeout(r, 1000));
      return { status: 200, body: 'done' };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  const fastMock: Mock = {
    id: 'script-fast',
    name: 'Fast Script',
    method: 'GET',
    path: '/fast',
    type: 'script',
    priority: 1,
    script: `
      return { status: 200, body: 'fast ok' };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([slowMock, fastMock])

  // 1. Slow request times out due to the per-mock 200ms limit
  const res1 = await engine.handleRequest(new Request('http://localhost/override-timeout'))
  assertEquals(res1?.status, 500)
  assertStringIncludes(res1?.body || '', 'timed out')

  // 2. Subsequent fast request recovers and succeeds
  const res2 = await engine.handleRequest(new Request('http://localhost/fast'))
  assertEquals(res2?.status, 200)
  assertEquals(res2?.body, 'fast ok')
})

Deno.test('Script Responder - concurrent requests ID correlation', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const mock: Mock = {
    id: 'script-concurrent',
    name: 'Concurrent Script',
    method: 'GET',
    path: '/concurrent',
    type: 'script',
    priority: 1,
    script: `
      const id = context.query.id || 'none';
      return { status: 200, body: 'item-' + id };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  const requests = [1, 2, 3, 4, 5].map((id) =>
    engine.handleRequest(new Request(`http://localhost/concurrent?id=${id}`))
  )

  const responses = await Promise.all(requests)

  responses.forEach((res, index) => {
    assertEquals(res?.status, 200)
    assertEquals(res?.body, `item-${index + 1}`)
  })
})

Deno.test('Script Responder - path parameters access', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const mockUser: Mock = {
    id: 'script-user-id',
    name: 'User By ID',
    method: 'GET',
    path: '/users/:id',
    type: 'script',
    priority: 1,
    script: `
      return {
        status: 200,
        body: JSON.stringify({ userId: context.pathParams.id })
      };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  const mockMulti: Mock = {
    id: 'script-multi-param',
    name: 'Multi Param',
    method: 'GET',
    path: '/orgs/:org/users/:id',
    type: 'script',
    priority: 1,
    script: `
      return {
        status: 200,
        body: JSON.stringify({ org: context.pathParams.org, user: context.pathParams.id })
      };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  const mockNoParam: Mock = {
    id: 'script-no-param',
    name: 'No Param',
    method: 'GET',
    path: '/no-params',
    type: 'script',
    priority: 1,
    script: `
      return {
        status: 200,
        body: JSON.stringify(context.pathParams)
      };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mockUser, mockMulti, mockNoParam])

  // Single param
  const resUser = await engine.handleRequest(new Request('http://localhost/users/42'))
  assertEquals(resUser?.status, 200)
  assertEquals(JSON.parse(resUser?.body || '{}'), { userId: '42' })

  // Multi-segment param
  const resMulti = await engine.handleRequest(new Request('http://localhost/orgs/acme/users/99'))
  assertEquals(resMulti?.status, 200)
  assertEquals(JSON.parse(resMulti?.body || '{}'), { org: 'acme', user: '99' })

  // No params
  const resNoParam = await engine.handleRequest(new Request('http://localhost/no-params'))
  assertEquals(resNoParam?.status, 200)
  assertEquals(JSON.parse(resNoParam?.body || 'null'), {})
})

Deno.test('Script Responder - full request context access', async () => {
  const engine = new MatchingEngine(new MockStoreStub())

  const mock: Mock = {
    id: 'script-full-context',
    name: 'Full Context',
    method: 'POST',
    path: '/api/v1/:section/items',
    type: 'script',
    priority: 1,
    script: `
      return {
        status: 201,
        body: JSON.stringify({
          method: context.method,
          path: context.path,
          section: context.pathParams.section,
          page: context.query.page,
          apiKey: context.headers['x-api-key'],
          itemTitle: context.body.title
        })
      };
    `,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }

  engine.setMocks([mock])

  const req = new Request('http://localhost/api/v1/inventory/items?page=2', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': 'secret-123',
    },
    body: JSON.stringify({ title: 'Widget A' }),
  })

  const res = await engine.handleRequest(req)
  assertEquals(res?.status, 201)
  assertEquals(JSON.parse(res?.body || '{}'), {
    method: 'POST',
    path: '/api/v1/inventory/items',
    section: 'inventory',
    page: '2',
    apiKey: 'secret-123',
    itemTitle: 'Widget A',
  })
})
