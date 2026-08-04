import { assertEquals } from '@std/assert'
import app from '../src/server.ts'
import { store } from '../src/store/index.ts'

Deno.test('Content-Type logic', async (t) => {
  await store.init()

  await t.step('Default Content-Type should be text/plain', async () => {
    await app.request('/__admin/mocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Default Test',
        method: 'GET',
        path: '/default-ct',
        type: 'static',
        response: { status: 200, body: 'ok' },
      }),
    })

    const res = await app.request('/default-ct')
    assertEquals(res.headers.get('Content-Type'), 'text/plain')
  })

  await t.step('Explicit contentType should be respected', async () => {
    await app.request('/__admin/mocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'JSON Test',
        method: 'GET',
        path: '/json-ct',
        type: 'static',
        response: { status: 200, body: '{"ok":true}', contentType: 'application/json' },
      }),
    })

    const res = await app.request('/json-ct')
    assertEquals(res.headers.get('Content-Type'), 'application/json')
  })

  await t.step('Custom contentType should be respected', async () => {
    await app.request('/__admin/mocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'YAML Test',
        method: 'GET',
        path: '/yaml-ct',
        type: 'static',
        response: { status: 200, body: 'ok: true', contentType: 'application/x-yaml' },
      }),
    })

    const res = await app.request('/yaml-ct')
    assertEquals(res.headers.get('Content-Type'), 'application/x-yaml')
  })

  await t.step('Header override should take precedence over contentType', async () => {
    await app.request('/__admin/mocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Override Test',
        method: 'GET',
        path: '/override-ct',
        type: 'static',
        response: {
          status: 200,
          body: '<html></html>',
          contentType: 'text/plain',
          headers: { 'Content-Type': 'text/html' },
        },
      }),
    })

    const res = await app.request('/override-ct')
    assertEquals(res.headers.get('Content-Type'), 'text/html')
  })

  await t.step('Admin API should persist contentType', async () => {
    const createRes = await app.request('/__admin/mocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Persist Test',
        method: 'GET',
        path: '/persist-ct',
        type: 'static',
        response: { status: 200, body: 'ok', contentType: 'application/json' },
      }),
    })
    const created = await createRes.json()
    const id = created.id

    const getRes = await app.request(`/__admin/mocks/${id}`)
    const got = await getRes.json()
    assertEquals(got.response.contentType, 'application/json')

    const res = await app.request('/persist-ct')
    assertEquals(res.headers.get('Content-Type'), 'application/json')
  })

  await t.step('Conditional elseResponse should respect contentType', async () => {
    const createRes = await app.request('/__admin/mocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Conditional Else Test',
        method: 'GET',
        path: '/cond-else',
        type: 'conditional',
        conditions: [
          {
            source: 'header',
            key: 'x-never',
            op: 'equals',
            value: 'ever',
            response: { status: 200, body: 'never' },
          },
        ],
        elseResponse: { status: 404, contentType: 'text/html', body: '<h1>Not Found</h1>' },
      }),
    })
    assertEquals(createRes.status, 201)

    const res = await app.request('/cond-else')
    assertEquals(res.status, 404)
    assertEquals(res.headers.get('Content-Type'), 'text/html')
  })

  await t.step('Conditional condition response should respect contentType', async () => {
    await app.request('/__admin/mocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Conditional Match Test',
        method: 'GET',
        path: '/cond-match',
        type: 'conditional',
        conditions: [
          {
            source: 'header',
            key: 'x-type',
            op: 'equals',
            value: 'json',
            response: { status: 200, contentType: 'application/json', body: '{"ok":true}' },
          },
        ],
        elseResponse: { status: 200, contentType: 'text/plain', body: 'default' },
      }),
    })

    const res = await app.request('/cond-match', {
      headers: { 'x-type': 'json' },
    })
    assertEquals(res.headers.get('Content-Type'), 'application/json')
  })
})
