import { Mock, MockResponse } from '../types.ts'

export async function handleConditional(
  mock: Mock,
  headers: Headers,
  query: Record<string, string>,
  body: unknown,
): Promise<MockResponse> {
  const conditions = mock.conditions ?? []

  for (const condition of conditions) {
    let valueToCompare: string | undefined

    if (condition.source === 'header') {
      valueToCompare = headers.get(condition.key) || undefined
    }
    else if (condition.source === 'query') {
      valueToCompare = query[condition.key]
    }
    else if (condition.source === 'body') {
      // Basic JSON body field access. For deeper fields, a more complex logic would be needed.
      if (typeof body === 'object' && body !== null && condition.key in body) {
        valueToCompare = (body as Record<string, string>)?.toString()
      } else {
        valueToCompare = undefined
      }
    }

    let matched = false
    switch (condition.op) {
      case 'exists':
        matched = valueToCompare !== undefined
        break
      case 'notExists':
        matched = valueToCompare === undefined
        break
      case 'equals':
        matched = valueToCompare === condition.value
        break
      case 'notEquals':
        matched = valueToCompare !== condition.value
        break
    }

    if (matched) {
      return condition.response
    }
  }

  return mock.elseResponse ?? { status: 404, body: 'No condition matched and no else response configured' }
}
