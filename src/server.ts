import { Hono } from '@hono'
import { serveStatic } from '@hono/deno'
import { MatchingEngine } from './mocks/engine.ts'
import { store } from './store/index.ts'
import adminApi from './admin/api.ts'
import { liveFeed } from './livefeed/log_bus.ts'

export const engine = new MatchingEngine(store)

const app = new Hono()

app.use(
  '/ui/*',
  serveStatic({
    root: './public',
    rewriteRequestPath: (path) => path.replace(/^\/ui/, ''),
  }),
)

app.get('/', (c) => c.redirect('/ui/index.html'))

app.route('/__admin', adminApi)

// Catch-all for mocks
app.all('*', async (c) => {
  const path = c.req.path

  // Skip admin and UI paths if they reach here
  if (path.startsWith('/__admin') || path === '/ui' || path.startsWith('/ui/')) {
    return c.notFound()
  }

  const startTime = performance.now()
  const res = await engine.handleRequest(c.req.raw)
  const durationMs = performance.now() - startTime
  const matchedMock = engine.getLastMatchedMock()

  if (!res) {
    liveFeed.record({
      method: c.req.method,
      path,
      matchedMockId: null,
      matchedMockName: null,
      status: 404,
      durationMs,
    })
    return c.json({
      error: 'Not Found',
      message: `No mock matched for ${c.req.method} ${path}`,
    }, 404)
  }

  const headers = new Headers(res.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', res.contentType || 'text/plain')
  }

  liveFeed.record({
    method: c.req.method,
    path,
    matchedMockId: matchedMock?.id ?? null,
    matchedMockName: matchedMock?.name ?? null,
    status: res.status,
    durationMs,
  })

  return new Response(res.body, {
    status: res.status,
    headers,
  })
})

export default app
