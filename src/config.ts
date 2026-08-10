export const PORT = Number(Deno.env.get('PORT') || '8000')
export const DB_DRIVER = Deno.env.get('DB_DRIVER') ?? 'memory' // postgres or memory
export const POSTGRES_URL = Deno.env.get('POSTGRES_URL') ?? 'postgres://mock:mock@localhost:5432/mocks'
export const scriptTimeoutMs = Number(Deno.env.get('SCRIPT_TIMEOUT_MS') || '2000')
