import { MockResponse } from './types.ts'

export interface ScriptContext {
  method: string
  path: string
  pathParams: Record<string, string>
  headers: Record<string, string>
  query: Record<string, string>
  body: unknown
}

interface PendingRequest {
  resolve: (res: MockResponse) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let sharedWorker: Worker | null = null
const inFlightRequests = new Map<string, PendingRequest>()
let idCounter = 0

function terminateAndResetWorker(reason: string, timeoutReqId?: string) {
  if (sharedWorker) {
    try {
      sharedWorker.terminate()
    }
    catch {
      // ignore
    }
    sharedWorker = null
  }

  const requests = Array.from(inFlightRequests.entries())
  inFlightRequests.clear()

  for (const [id, pending] of requests) {
    clearTimeout(pending.timer)
    if (id === timeoutReqId) {
      pending.reject(new Error('Script execution timed out'))
    }
    else {
      pending.reject(new Error(`Worker terminated: ${reason}`))
    }
  }
}

function getWorker(): Worker {
  if (sharedWorker) {
    return sharedWorker
  }

  const workerUrl = new URL('./worker.ts', import.meta.url).href

  try {
    const worker = new Worker(workerUrl, {
      type: 'module',
      // @ts-ignore Deno only permission options
      deno: {
        permissions: 'none',
      },
    })

    worker.onmessage = (e) => {
      const { id, type, response, error } = e.data || {}
      if (!id) return

      const pending = inFlightRequests.get(id)
      if (!pending) return

      inFlightRequests.delete(id)
      clearTimeout(pending.timer)

      if (type === 'success') {
        pending.resolve(response)
      }
      else {
        pending.reject(new Error(error || 'Script execution failed'))
      }
    }

    worker.onerror = (e) => {
      const errMsg = e.message || 'Worker execution error'
      terminateAndResetWorker(`Worker error: ${errMsg}`)
    }

    sharedWorker = worker
    return sharedWorker
  }
  catch (err) {
    throw new Error(
      `Failed to create sandboxed worker: ${
        err instanceof Error ? err.message : String(err)
      }. Ensure Deno is run with --unstable-worker-options.`,
    )
  }
}

export async function runScript(script: string, context: ScriptContext, timeoutMs = 2000): Promise<MockResponse> {
  const worker = getWorker()
  const id = `${Date.now()}-${++idCounter}-${Math.random().toString(36).substring(2, 9)}`

  return new Promise<MockResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      terminateAndResetWorker('Script execution timed out', id)
    }, timeoutMs)

    inFlightRequests.set(id, { resolve, reject, timer })

    try {
      worker.postMessage({ id, script, context })
    }
    catch (err) {
      inFlightRequests.delete(id)
      clearTimeout(timer)
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}
