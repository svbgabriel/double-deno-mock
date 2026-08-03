# Deno Mock Server

A customizable mock HTTP server built with Deno and Hono.

## Features

- **Static Mocks**: Fixed status, headers, and body.
- **Conditional Mocks**: Branching logic based on headers, query params, or JSON body fields.
- **Sequence Mocks**: Returns a sequence of responses across multiple calls (supports cycling or stopping at the end).
- **Script Mocks**: Write custom logic in JS to compute the response, executed in a sandboxed Worker.
- **Management UI**: Simple web interface at `/ui` to manage mocks.
- **Persistence**: Mocks are stored in SQLite (default) or PostgreSQL.

## Getting Started

### Prerequisites

- Deno installed.

### Run the server

```bash
deno task dev
```

The server will start on port 8000 by default. Access the UI at `http://localhost:8000/ui`.

### Environment Variables

- `PORT`: Server port (default: 8000).
- `DB_DRIVER`: `sqlite` (default) or `postgres`.
- `SQLITE_PATH`: Path to SQLite database file (default: `:memory:`).
- `POSTGRES_URL`: PostgreSQL connection URL.
- `SCRIPT_TIMEOUT_MS`: Script execution timeout in milliseconds (default: 2000).

> **Note**: Sandboxed script worker execution requires Deno's `--unstable-worker-options` flag, which is enabled in `deno.jsonc` tasks.

## Development

### Tasks

- `deno task start`: Start the server.
- `deno task dev`: Start the server with watch mode.
- `deno task test`: Run all tests.

### Test

```bash
deno task test
```

## How to define mocks

Mocks match incoming requests by **Method** and **Path Pattern** (supports `URLPattern` syntax like `/users/:id`). When
multiple mocks match, the one with the highest **Priority** is chosen.

### Script Mock Example

User scripts run in a sandboxed Worker and receive a global `context` object representing the incoming request:

- `context.method`: Request HTTP method (e.g. `'GET'`, `'POST'`).
- `context.path`: Request path (e.g. `'/users/42'`).
- `context.pathParams`: Object with named path parameters from `URLPattern` route matching (e.g. `{ id: '42' }` for `/users/:id`).
- `context.query`: Object with URL query parameters (e.g. `context.query.filter`).
- `context.headers`: Object with request headers in lowercase (e.g. `context.headers['content-type']`).
- `context.body`: Parsed JSON request body (if `Content-Type` is `application/json`), or `null`.

#### Example

For a route defined with path `/users/:id`:

```javascript
const userId = context.pathParams.id
const format = context.query.format || 'json'

return {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: userId,
    format: format,
    method: context.method,
    clientHeader: context.headers['x-client-id']
  })
}
```
