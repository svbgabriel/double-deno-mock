import { Mock, MockResponse, MockStore } from '../types.ts'

export async function handleRest(
  mock: Mock,
  method: string,
  pathParams: Record<string, string>,
  body: unknown,
  store: MockStore,
): Promise<MockResponse> {
  if (!mock.state) {
    mock.state = []
  }
  const state = mock.state
  const idField = mock.restIdField || 'id'
  const itemId = pathParams['id']

  const isCollection = itemId === undefined
  const upperMethod = method.toUpperCase()

  if (isCollection) {
    switch (upperMethod) {
      case 'GET':
        return {
          status: 200,
          body: JSON.stringify(state),
          contentType: 'application/json',
        }

      case 'POST': {
        if (typeof body !== 'object' || body === null || Array.isArray(body)) {
          return { status: 400, body: 'POST body must be a JSON object' }
        }
        const newItem = { ...(body as Record<string, unknown>) }
        if (newItem[idField] === undefined) {
          newItem[idField] = crypto.randomUUID()
        }
        state.push(newItem)
        await store.updateState(mock.id, state)
        return {
          status: 201,
          body: JSON.stringify(newItem),
          contentType: 'application/json',
        }
      }

      case 'PUT': {
        if (!Array.isArray(body)) {
          return { status: 400, body: 'PUT collection body must be a JSON array' }
        }
        mock.state = [...body]
        await store.updateState(mock.id, mock.state)
        return {
          status: 200,
          body: JSON.stringify(mock.state),
          contentType: 'application/json',
        }
      }

      case 'DELETE': {
        mock.state = []
        await store.updateState(mock.id, mock.state)
        return { status: 204 }
      }

      default:
        return { status: 405, body: `Method ${upperMethod} not allowed on collection` }
    }
  } else {
    // Item operations
    const index = state.findIndex((item) => String((item as Record<string, unknown>)[idField]) === String(itemId))

    if (index === -1 && upperMethod !== 'POST') {
      return { status: 404, body: `Item with ${idField} ${itemId} not found` }
    }

    switch (upperMethod) {
      case 'GET':
        return {
          status: 200,
          body: JSON.stringify(state[index]),
          contentType: 'application/json',
        }

      case 'PUT': {
        if (typeof body !== 'object' || body === null || Array.isArray(body)) {
          return { status: 400, body: 'PUT body must be a JSON object' }
        }
        const updatedItem = { ...(body as Record<string, unknown>), [idField]: itemId }
        state[index] = updatedItem
        await store.updateState(mock.id, state)
        return {
          status: 200,
          body: JSON.stringify(updatedItem),
          contentType: 'application/json',
        }
      }

      case 'PATCH': {
        if (typeof body !== 'object' || body === null || Array.isArray(body)) {
          return { status: 400, body: 'PATCH body must be a JSON object' }
        }
        const existingItem = state[index] as Record<string, unknown>
        const updatedItem = { ...existingItem, ...(body as Record<string, unknown>), [idField]: itemId }
        state[index] = updatedItem
        await store.updateState(mock.id, state)
        return {
          status: 200,
          body: JSON.stringify(updatedItem),
          contentType: 'application/json',
        }
      }

      case 'DELETE': {
        state.splice(index, 1)
        await store.updateState(mock.id, state)
        return { status: 204 }
      }

      default:
        return { status: 405, body: `Method ${upperMethod} not allowed on item` }
    }
  }
}
