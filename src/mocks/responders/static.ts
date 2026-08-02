import { Mock, MockResponse } from '../types.ts'

export function handleStatic(mock: Mock): MockResponse {
  if (!mock.response) {
    return { status: 500, body: 'Static mock missing response configuration' }
  }
  return mock.response
}
