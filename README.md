# Deno Mock Server

A customizable mock HTTP server built with Deno and Hono.

## Features

- **Static Mocks**: Fixed status, headers, and body.
- **Conditional Mocks**: Branching logic based on headers, query params, or JSON body fields.
- **Sequence Mocks**: Returns a sequence of responses across multiple calls (supports cycling or stopping at the end).
- **Script Mocks**: Write custom logic in JS to compute the response, executed in a sandboxed Worker.
- **REST Mocks**: Stateful REST API simulation with persistent resource collections and CRUD support.
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

### Static Mock Example

Retorna sempre a mesma resposta (status, headers e body fixos):

```json
{
  "method": "GET",
  "path": "/api-test",
  "type": "static",
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "body": "{\"message\":\"ok\"}"
  }
}
```

### Conditional Mock Example

Avalia uma lista de `conditions` em ordem e retorna a resposta da primeira que casar. Se nenhuma casar, retorna `elseResponse`:

```json
{
  "method": "GET",
  "path": "/cond-example",
  "type": "conditional",
  "conditions": [
    {
      "source": "header",
      "key": "x-api-key",
      "op": "equals",
      "value": "secret",
      "response": { "status": 200, "body": "authorized" }
    },
    {
      "source": "query",
      "key": "debug",
      "op": "exists",
      "response": { "status": 200, "body": "debug mode" }
    }
  ],
  "elseResponse": { "status": 401, "body": "unauthorized" }
}
```

### Sequence Mock Example

Retorna respostas em sequência a cada chamada. Com `sequenceMode: "cycle"` a sequência reinicia ao chegar ao fim; com `"stopAtEnd"` permanece na última resposta:

```json
{
  "method": "GET",
  "path": "/seq-example",
  "type": "sequence",
  "sequenceMode": "cycle",
  "sequence": [
    { "status": 200, "body": "first call" },
    { "status": 200, "body": "second call" },
    { "status": 500, "body": "third call fails" }
  ]
}
```

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

### REST Mock

The `rest` type simulates a full RESTful API for a collection of resources. It maintains a persistent state (a JSON array) in the database.

To use it effectively, define a path pattern that includes an optional `:id` parameter, such as `/api/users/:id?` or create two mocks if needed, but typically a single pattern like `/api/items/:id?` works if the engine matches it. 
*Note: The current implementation decides between collection and item operations based on whether the `:id` path parameter is present in the matched request.*

#### Supported Operations

| Path | Method | Action |
| :--- | :--- | :--- |
| Collection | `GET` | Returns the full array of resources. |
| Collection | `POST` | Appends a new item. Generates a UUID if the ID field is missing. |
| Collection | `PUT` | Replaces the entire collection with the provided array. |
| Collection | `DELETE` | Clears the collection. |
| Item (`/:id`) | `GET` | Returns the resource with the matching ID. |
| Item (`/:id`) | `PUT` | Replaces the matching resource. |
| Item (`/:id`) | `PATCH` | Performs a shallow merge on the matching resource. |
| Item (`/:id`) | `DELETE` | Removes the resource from the collection. |

#### Configuration

- **Initial State**: A JSON array of objects to seed the collection.
- **ID Field**: The property name used as the unique identifier (default: `id`).
- **Reset**: You can reset the state back to the Initial State via the Management UI.

#### Example

```json
{
  "method": "*",
  "path": "/api/items/:id?",
  "type": "rest",
  "restIdField": "id",
  "restInitialState": [
    { "id": 1, "name": "First item" },
    { "id": 2, "name": "Second item" }
  ]
}
```
