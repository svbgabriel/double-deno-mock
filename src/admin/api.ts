import { Hono } from '@hono'
import { streamSSE } from '@hono/streaming'
import { store } from '../store/index.ts'
import { engine } from '../server.ts'
import { Mock, mockTypeArray } from '../mocks/types.ts'
import { resetSequence } from '../mocks/responders/sequence.ts'
import { liveFeed } from '../livefeed/log_bus.ts'

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
  if (mock.type === 'rest' && mock.restInitialState && !Array.isArray(mock.restInitialState)) {
    return 'REST mock initial state must be an array'
  }

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
    console.error('[Admin API] Error creating mock:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

api.put('/mocks/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()

    const existing = await store.get(id)
    if (!existing) return c.json({ error: 'Not Found' }, 404)

    const error = validateMock({ ...existing, ...body })
    if (error) return c.json({ error }, 400)

    const updated = await store.update(id, body)
    resetSequence(id)
    await engine.loadMocks()
    return c.json(updated)
  }
  catch (err) {
    console.error('[Admin API] Error updating mock:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

api.delete('/mocks/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const existing = await store.get(id)
    if (!existing) return c.json({ error: 'Not Found' }, 404)

    await store.delete(id)
    resetSequence(id)
    await engine.loadMocks()
    return c.json({ success: true })
  }
  catch (err) {
    console.error('[Admin API] Error deleting mock:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

api.post('/mocks/:id/reset', async (c) => {
  const id = c.req.param('id')
  const existing = await store.get(id)
  if (!existing) return c.json({ error: 'Not Found' }, 404)

  resetSequence(id)
  if (existing.type === 'rest') {
    await store.updateState(id, existing.restInitialState || [])
    await engine.loadMocks()
  }
  return c.json({ success: true })
})

api.get('/livefeed', (c) => {
  return streamSSE(c, async (stream) => {
    for (const entry of liveFeed.getHistory()) {
      await stream.writeSSE({
        data: JSON.stringify(entry),
        event: 'message',
        id: entry.id,
      })
    }

    let closed = false
    const unsubscribe = liveFeed.subscribe((entry) => {
      if (closed) return
      stream.writeSSE({
        data: JSON.stringify(entry),
        event: 'message',
        id: entry.id,
      }).catch(() => {})
    })

    stream.onAbort(() => {
      closed = true
      unsubscribe()
    })

    while (!closed) {
      await stream.sleep(1000)
    }
  })
})

export default api
