import { assertEquals } from '@std/assert'
import app from '../src/server.ts'

Deno.test('Favicon static serving', async () => {
  // Test /ui/favicon.svg
  const svgUiRes = await app.request('/ui/favicon.svg')
  assertEquals(svgUiRes.status, 200)

  // Test /ui/favicon.ico
  const icoUiRes = await app.request('/ui/favicon.ico')
  assertEquals(icoUiRes.status, 200)

  // Test root /favicon.ico
  const icoRootRes = await app.request('/favicon.ico')
  assertEquals(icoRootRes.status, 200)

  // Test root /favicon.svg
  const svgRootRes = await app.request('/favicon.svg')
  assertEquals(svgRootRes.status, 200)
})

Deno.test('HTML includes favicon link tags', async () => {
  const htmlRes = await app.request('/ui/index.html')
  assertEquals(htmlRes.status, 200)
  const htmlText = await htmlRes.text()
  assertEquals(htmlText.includes('rel="icon"'), true)
  assertEquals(htmlText.includes('/ui/favicon.svg'), true)
  assertEquals(htmlText.includes('/ui/favicon.ico'), true)
})
