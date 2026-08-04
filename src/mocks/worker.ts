import { MockResponse } from './types.ts'

export function validateAndNormalizeResponse(raw: unknown): MockResponse {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Script must return an object with response properties (status, body, headers, contentType).')
  }

  const r = raw as Record<string, unknown>

  if (typeof r.status !== 'number' || !Number.isInteger(r.status) || r.status < 100 || r.status > 599) {
    throw new Error('Script response status must be an integer between 100 and 599.')
  }

  let headers: Record<string, string> | undefined
  if (r.headers !== undefined && r.headers !== null) {
    if (typeof r.headers !== 'object' || Array.isArray(r.headers)) {
      throw new Error('Script response headers must be an object.')
    }
    headers = {}
    for (const [k, v] of Object.entries(r.headers)) {
      if (typeof v !== 'string') {
        throw new Error(`Script response header '${k}' must be a string.`)
      }
      headers[k] = v
    }
  }

  let contentType: string | undefined
  if (r.contentType !== undefined && r.contentType !== null) {
    if (typeof r.contentType !== 'string') {
      throw new Error('Script response contentType must be a string.')
    }
    contentType = r.contentType
  }

  let body: string | undefined
  if (r.body !== undefined && r.body !== null) {
    if (typeof r.body === 'string') {
      body = r.body
    }
    else if (typeof r.body === 'object') {
      body = JSON.stringify(r.body)
      if (!contentType) {
        contentType = 'application/json'
      }
    }
    else {
      body = String(r.body)
    }
  }

  const result: MockResponse = {
    status: r.status,
  }
  if (headers !== undefined) result.headers = headers
  if (body !== undefined) result.body = body
  if (contentType !== undefined) result.contentType = contentType

  return result
}

// Cache for compiled user scripts to improve performance
// deno-lint-ignore ban-types
const scriptCache = new Map<string, Function>()

// Worker for running user scripts in isolation
self.onmessage = async (e) => {
  const { id, script, context } = e.data

  try {
    let userFn = scriptCache.get(script)
    if (!userFn) {
      userFn = new Function(
        'context',
        `
        return (async () => {
          ${script}
        })();
      `,
      )
      scriptCache.set(script, userFn)
    }

    const rawResponse = await userFn(context)
    const response = validateAndNormalizeResponse(rawResponse)

    self.postMessage({ id, type: 'success', response })
  }
  catch (err) {
    let errorMsg: string
    if (err instanceof Error) {
      const prefix = err.name && err.name !== 'Error' ? `${err.name}: ` : ''
      errorMsg = `${prefix}${err.message}`
    }
    else {
      errorMsg = String(err)
    }
    self.postMessage({ id, type: 'error', error: errorMsg })
  }
}
