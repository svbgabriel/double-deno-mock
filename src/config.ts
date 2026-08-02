export const PORT = Number(Deno.env.get('PORT') || '8000')
export const DB_DRIVER = Deno.env.get('DB_DRIVER') ?? 'sqlite' // sqlite or postgres
export const SQLITE_PATH = Deno.env.get('SQLITE_PATH') ?? ':memory:'
export const POSTGRES_URL = Deno.env.get('POSTGRES_URL') ?? 'postgres://postgres:postgres@localhost:5432/mocks'
export const scriptTimeoutMs = Number(Deno.env.get('SCRIPT_TIMEOUT_MS') || '2000')
