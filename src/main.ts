import { PORT } from './config.ts'
import { store } from './store/index.ts'
import app, { engine } from './server.ts'

async function main() {
  console.log('Initializing store...')
  await store.init()

  console.log('Loading mocks into engine...')
  await engine.loadMocks()

  console.log(`Server starting on port ${PORT}...`)
  Deno.serve({ port: PORT }, app.fetch)
}

if (import.meta.main) {
  main().catch((err) => {
    console.error('Failed to start server:', err)
    Deno.exit(1)
  })
}
