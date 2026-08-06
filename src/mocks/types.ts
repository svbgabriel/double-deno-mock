export const mockTypeArray = ['static', 'conditional', 'sequence', 'script', 'rest'] as const
export type MockType = (typeof mockTypeArray)[number]

export interface MockResponse {
  status: number
  headers?: Record<string, string>
  body?: string
  contentType?: string
}

export interface Condition {
  source: 'header' | 'query' | 'body'
  key: string
  op: 'exists' | 'equals' | 'notEquals' | 'notExists'
  value?: string
  response: MockResponse
}

export interface Mock {
  id: string
  name: string
  method: string // GET, POST, * ...
  path: string // /users/:id
  type: MockType
  priority: number
  // type-specific config:
  response?: MockResponse // static
  conditions?: Condition[]
  elseResponse?: MockResponse // conditional
  sequence?: MockResponse[]
  sequenceMode?: 'cycle' | 'stopAtEnd' // sequence
  script?: string // script (JS source)
  scriptTimeoutMs?: number // optional per-mock timeout override in ms
  // rest
  restIdField?: string
  restInitialState?: unknown[]
  state?: unknown[]
  createdAt: string
  updatedAt: string
}

export interface MockStore {
  init(): Promise<void>
  list(): Promise<Mock[]>
  get(id: string): Promise<Mock | null>
  create(mock: Mock): Promise<Mock>
  update(id: string, mock: Partial<Mock>): Promise<Mock>
  updateState(id: string, state: unknown[]): Promise<void>
  delete(id: string): Promise<void>
}
