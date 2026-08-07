export interface FeedEntry {
  id: string
  timestamp: string
  method: string
  path: string
  matchedMockId: string | null
  matchedMockName: string | null
  status: number
  durationMs: number
}

const MAX_HISTORY = 100

export class LiveFeed {
  private history: FeedEntry[] = []
  private listeners: Set<(entry: FeedEntry) => void> = new Set()

  record(entry: Omit<FeedEntry, 'id' | 'timestamp'>): void {
    const fullEntry: FeedEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }

    this.history.push(fullEntry)
    if (this.history.length > MAX_HISTORY) {
      this.history.shift()
    }

    for (const listener of this.listeners) {
      listener(fullEntry)
    }
  }

  subscribe(cb: (entry: FeedEntry) => void): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  getHistory(): FeedEntry[] {
    return [...this.history]
  }
}

export const liveFeed = new LiveFeed()
