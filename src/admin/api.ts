import { Hono } from '@hono'
import { store } from '../store/index.ts'
import { engine } from '../server.ts'
import {Mock, mockTypeArray} from '../mocks/types.ts'
import { resetSequence } from '../mocks/responders/sequence.ts'

const api = new Hono()

function validateMock(mock: Partial<Mock>): string | null {
  if (!mock.name) return 'Name is required'
  if (!mock.method) return 'Method is required'
  if (!mock.path) return 'Path is required'
  if (!mock.type) return 'Type is required'

  if (mock.path.startsWith('/__admin')) {
    return 'Cannot create mock with path starting with /__admin'
  }

  if (!mockTypeArray.includes(mock.type)) return `Invalid type: ${mock.type}`

  if (mock.type === 'static' && !mock.response) return 'Static mock requires a response'
  if (mock.type === 'conditional' && (!mock.conditions || mock.conditions.length === 0)) {
    return 'Conditional mock requires at least one condition'
  }
  if (mock.type === 'sequence' && (!mock.sequence || mock.sequence.length === 0)) {
    return 'Sequence mock requires at least one response in the sequence'
  }
  if (mock.type === 'script' && !mock.script) return 'Script mock requires a script'

  return null
}

api.get('/mocks', async (c) => {
  const mocks = await store.list()
  return c.json(mocks)
})

api.get('/mocks/:id', async (c) => {
  const mock = await store.get(c.req.param('id'))
  if (!mock) return c.json({ error: 'Not Found' }, 404)
  return c.json(mock)
})

api.post('/mocks', async (c) => {
  try {
    const body = await c.req.json()
    const error = validateMock(body)
    if (error) return c.json({ error }, 400)

    const mock: Mock = {
      ...body,
      id: body.id || crypto.randomUUID(),
      priority: body.priority ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const created = await store.create(mock)
    await engine.loadMocks()
    return c.json(created, 201)
  }
  catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400)
  }
})

api.put('/mocks/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()

    const existing = await store.get(id)
    if (!existing) return c.json({ error: 'Not Found' }, 404)

    const updated = await store.update(id, body)
    await engine.loadMocks()
    return c.json(updated)
  }
  catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400)
  }
})

api.delete('/mocks/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await store.get(id)
  if (!existing) return c.json({ error: 'Not Found' }, 404)

  await store.delete(id)
  await engine.loadMocks()
  return c.json({ success: true })
})

api.post('/mocks/:id/reset', async (c) => {
  const id = c.req.param('id')
  const existing = await store.get(id)
  if (!existing) return c.json({ error: 'Not Found' }, 404)

  resetSequence(id)
  return c.json({ success: true })
})

export default api
