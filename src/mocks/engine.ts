import { Mock, MockResponse, MockStore } from './types.ts'
import { handleStatic } from './responders/static.ts'
import { handleConditional } from './responders/conditional.ts'
import { handleSequence } from './responders/sequence.ts'
import { handleScript } from './responders/script.ts'

export class MatchingEngine {
  private mocks: Mock[] = []

  constructor(private store: MockStore) {}

  async loadMocks() {
    this.mocks = await this.store.list()
  }

  setMocks(mocks: Mock[]) {
    this.mocks = [...mocks]
  }

  async handleRequest(req: Request): Promise<MockResponse | null> {
    const url = new URL(req.url)
    const method = req.method
    const path = url.pathname
    const headers = req.headers
    const query = Object.fromEntries(url.searchParams.entries())

    let body: unknown = null
    const contentType = headers.get('content-type')
    if (contentType?.includes('application/json')) {
      try {
        // Clone request to avoid consuming body if needed elsewhere
        body = await req.clone().json()
      }
      catch {
        // Ignore body parsing errors
      }
    }

    const candidates = this.mocks.filter((mock) => {
      const methodMatch = mock.method === '*' || mock.method.toUpperCase() === method.toUpperCase()

      // Handle simple path or pattern
      try {
        const pattern = new URLPattern({ pathname: mock.path })
        return methodMatch && pattern.test({ pathname: path })
      }
      catch {
        // Fallback for non-pattern paths
        return methodMatch && mock.path === path
      }
    })

    // Sort by priority (higher first) and then createdAt
    const sorted = candidates.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    const mock = sorted[0]
    if (!mock) return null

    const pathParams: Record<string, string> = {}
    try {
      const pattern = new URLPattern({ pathname: mock.path })
      const match = pattern.exec({ pathname: path })
      if (match?.pathname.groups) {
        for (const [key, value] of Object.entries(match.pathname.groups)) {
          if (value !== undefined) {
            pathParams[key] = value
          }
        }
      }
    }
    catch {
      // Ignore errors if mock.path is not a valid pattern
    }

    switch (mock.type) {
      case 'static':
        return handleStatic(mock)
      case 'conditional':
        return await handleConditional(mock, headers, query, body)
      case 'sequence':
        return handleSequence(mock)
      case 'script':
        return await handleScript(mock, method, path, pathParams, headers, query, body)
      default:
        return { status: 500, body: `Unknown mock type: ${mock.type}` }
    }
  }
}
