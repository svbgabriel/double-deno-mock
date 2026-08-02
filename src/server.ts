import { Hono } from '@hono'
import { serveStatic } from '@hono/deno'
import { MatchingEngine } from './mocks/engine.ts'
import { store } from './store/index.ts'
import adminApi from './admin/api.ts'

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

  const res = await engine.handleRequest(c.req.raw)

  if (!res) {
    return c.json({
      error: 'Not Found',
      message: `No mock matched for ${c.req.method} ${path}`,
    }, 404)
  }

  const headers = new Headers(res.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', res.contentType || 'text/plain')
  }

  return new Response(res.body, {
    status: res.status,
    headers,
  })
})

export default app
