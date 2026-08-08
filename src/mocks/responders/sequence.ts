import { Mock, MockResponse } from '../types.ts'

const sequenceStates = new Map<string, number>()

export function handleSequence(mock: Mock): MockResponse {
  const sequence = mock.sequence ?? []
  if (sequence.length === 0) {
    return { status: 500, body: 'Sequence mock missing responses' }
  }

  const currentIndex = sequenceStates.get(mock.id) ?? 0
  const response = sequence[currentIndex]

  let nextIndex = currentIndex + 1
  if (nextIndex >= sequence.length) {
    if (mock.sequenceMode === 'stopAtEnd') {
      nextIndex = sequence.length - 1
    } else {
      nextIndex = 0 // cycle by default
    }
  }

  sequenceStates.set(mock.id, nextIndex)
  return response
}

export function resetSequence(mockId: string) {
  sequenceStates.set(mockId, 0)
}
