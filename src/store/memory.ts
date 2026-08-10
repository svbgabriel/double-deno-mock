import { Mock, MockStore } from '../mocks/types.ts'

export class InMemoryMockStore implements MockStore {
  private mocks = new Map<string, Mock>()

  init(): Promise<void> {
    return Promise.resolve()
  }

  list(): Promise<Mock[]> {
    const list = Array.from(this.mocks.values()).map((m) => this.clone(m))
    list.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority
      }
      return b.createdAt.localeCompare(a.createdAt)
    })
    return Promise.resolve(list)
  }

  get(id: string): Promise<Mock | null> {
    const mock = this.mocks.get(id)
    return Promise.resolve(mock ? this.clone(mock) : null)
  }

  create(m: Mock): Promise<Mock> {
    const cloned = this.clone(m)
    if (!cloned.state && cloned.restInitialState) {
      cloned.state = this.clone(cloned.restInitialState)
    }
    this.mocks.set(m.id, cloned)
    return Promise.resolve(this.clone(cloned))
  }

  async update(id: string, m: Partial<Mock>): Promise<Mock> {
    const existing = await this.get(id)
    if (!existing) {
      throw new Error(`Mock with id ${id} not found`)
    }

    const updated: Mock = {
      ...existing,
      ...m,
      id, // ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    }
    this.mocks.set(id, this.clone(updated))
    return this.clone(updated)
  }

  updateState(id: string, state: unknown[]): Promise<void> {
    const existing = this.mocks.get(id)
    if (existing) {
      existing.state = this.clone(state)
      existing.updatedAt = new Date().toISOString()
    }
    return Promise.resolve()
  }

  delete(id: string): Promise<void> {
    this.mocks.delete(id)
    return Promise.resolve()
  }

  private clone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj))
  }
}
