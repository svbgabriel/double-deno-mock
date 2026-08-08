import { Mock, MockResponse, MockStore } from './types.ts'
import { handleStatic } from './responders/static.ts'
import { handleConditional } from './responders/conditional.ts'
import { handleSequence } from './responders/sequence.ts'
import { handleScript } from './responders/script.ts'
import { handleRest } from './responders/rest.ts'

export class MatchingEngine {
  private mocks: Mock[] = []
  private compiledPatterns: Map<string, URLPattern | null> = new Map()
  private lastMatchedMock: { id: string; name: string } | null = null

  constructor(private store: MockStore) {}

  getLastMatchedMock(): { id: string; name: string } | null {
    return this.lastMatchedMock
  }

  async loadMocks() {
    this.mocks = await this.store.list()
    this.compilePatterns()
  }

  setMocks(mocks: Mock[]) {
    this.mocks = [...mocks]
    this.compilePatterns()
  }

  private compilePatterns() {
    this.compiledPatterns.clear()
    for (const mock of this.mocks) {
      try {
        this.compiledPatterns.set(mock.id, new URLPattern({ pathname: mock.path }))
      } catch {
        this.compiledPatterns.set(mock.id, null)
      }
    }
  }

  async handleRequest(req: Request): Promise<MockResponse | null> {
    const url = new URL(req.url)
    const method = req.method
    const path = url.pathname
    const headers = req.headers
    const query = Object.fromEntries(url.searchParams.entries())

    const candidates = this.mocks.filter((mock) => {
      const methodMatch = mock.method === '*' || mock.method.toUpperCase() === method.toUpperCase()
      if (!methodMatch) return false

      const pattern = this.compiledPatterns.get(mock.id)
      if (pattern) {
        return pattern.test({ pathname: path })
      }
      return mock.path === path
    })

    // Sort by priority (higher first) and then createdAt
    const sorted = candidates.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    const mock = sorted[0]
    if (!mock) {
      this.lastMatchedMock = null
      return null
    }
    this.lastMatchedMock = { id: mock.id, name: mock.name }

    const pathParams: Record<string, string> = {}
    const pattern = this.compiledPatterns.get(mock.id)
    if (pattern) {
      const match = pattern.exec({ pathname: path })
      if (match?.pathname.groups) {
        for (const [key, value] of Object.entries(match.pathname.groups)) {
          if (value !== undefined) {
            pathParams[key] = value
          }
        }
      }
    }

    let body: unknown = null
    if (mock.type === 'conditional' || mock.type === 'script' || mock.type === 'rest') {
      const contentType = headers.get('content-type')
      if (contentType?.includes('application/json')) {
        try {
          body = await req.json()
        } catch {
          // Ignore body parsing errors
        }
      }
    }

    switch (mock.type) {
      case 'static':
        return handleStatic(mock)
      case 'conditional':
        return handleConditional(mock, headers, query, body)
      case 'sequence':
        return handleSequence(mock)
      case 'script':
        return await handleScript(mock, method, path, pathParams, headers, query, body)
      case 'rest':
        return await handleRest(mock, method, pathParams, body, this.store)
      default:
        return { status: 500, body: `Unknown mock type: ${mock.type}` }
    }
  }
}
