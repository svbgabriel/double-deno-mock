import { MockResponse } from './types.ts'

export interface ScriptContext {
  method: string
  path: string
  pathParams: Record<string, string>
  headers: Record<string, string>
  query: Record<string, string>
  body: unknown
}

export function runScript(script: string, context: ScriptContext, timeoutMs = 2000): Promise<MockResponse> {
  const workerUrl = new URL('./worker.ts', import.meta.url).href
  let worker: Worker | null = null

  try {
    worker = new Worker(workerUrl, {
      type: 'module',
      // @ts-ignore Deno only permission options
      deno: {
        permissions: 'none',
      },
    })
  }
  catch (err) {
    throw new Error(
      `Failed to create sandboxed worker: ${
        err instanceof Error ? err.message : String(err)
      }. Ensure Deno is run with --unstable-worker-options.`,
    )
  }

  const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

  return new Promise<MockResponse>((resolve, reject) => {
    const w = worker!
    const timer = setTimeout(() => {
      w.terminate()
      reject(new Error('Script execution timed out'))
    }, timeoutMs)

    w.onmessage = (e) => {
      const { type, response, error } = e.data || {}
      clearTimeout(timer)
      w.terminate()

      if (type === 'success') {
        resolve(response)
      }
      else {
        reject(new Error(error || 'Script execution failed'))
      }
    }

    w.onerror = (e) => {
      clearTimeout(timer)
      w.terminate()
      reject(new Error(e.message || 'Worker execution error'))
    }

    try {
      w.postMessage({ id, script, context })
    }
    catch (err) {
      clearTimeout(timer)
      w.terminate()
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}
