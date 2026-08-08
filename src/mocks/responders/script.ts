import { Mock, MockResponse } from '../types.ts'
import { runScript, ScriptContext } from '../script_runner.ts'
import { scriptTimeoutMs } from '../../config.ts'

export async function handleScript(
  mock: Mock,
  requestMethod: string,
  requestPath: string,
  pathParams: Record<string, string>,
  headers: Headers,
  query: Record<string, string>,
  body: unknown,
): Promise<MockResponse> {
  if (!mock.script) {
    return { status: 500, body: 'Script mock missing script configuration' }
  }

  const context: ScriptContext = {
    method: requestMethod,
    path: requestPath,
    pathParams,
    headers: Object.fromEntries(headers.entries()),
    query,
    body,
  }

  const timeout = mock.scriptTimeoutMs ?? scriptTimeoutMs

  try {
    return await runScript(mock.script, context, timeout)
  }
  catch (err) {
    return {
      status: 500,
      body: `Script error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
