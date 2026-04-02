# @emstack/request

Lightweight, fetch-based HTTP client for TypeScript projects with strict typing, composable adapters, and interceptor/hook pipelines.

## Highlights

- Zero runtime dependencies
- Strict TypeScript-first API
- Browser and Node.js support (via adapter resolution)
- Request and response interceptors
- Lifecycle hooks: `beforeRequest`, `afterResponse`, `beforeError`
- Built-in adapter decorators:
  - `RetryAdapter` (retry with fixed or exponential backoff)
  - `CacheAdapter` (TTL in-memory response cache)
  - `DedupeAdapter` (collapse concurrent identical requests)
- Query serialization with configurable array formats

## Installation

```bash
pnpm add @emstack/request
# or
npm install @emstack/request
```

## Quick Start

```ts
import { HttpClient } from '@emstack/request';

const client = new HttpClient({ baseURL: 'https://api.example.com' });

type User = { id: number; name: string; email: string };

const response = await client.get<User>('/users/1');
const user = await response.json();
```

## Core Concepts

### 1) Typed request/response flow

```ts
type CreateUserRequest = { name: string; email: string };
type CreateUserResponse = { id: number; name: string; email: string };

const response = await client.post<CreateUserResponse, CreateUserRequest>(
  '/users',
  { name: 'Ada', email: 'ada@example.com' },
);

const created = await response.json();
```

### 2) Interceptors

Request interceptors run in LIFO order. Response interceptors run in FIFO order.

```ts
client.interceptors.request.use((config) => ({
  ...config,
  headers: {
    ...config.headers,
    authorization: 'Bearer my-token',
  },
}));

client.interceptors.response.use((res) => res);
```

### 3) Lifecycle hooks

```ts
const hookedClient = new HttpClient({
  baseURL: 'https://api.example.com',
  hooks: {
    beforeRequest: [
      (config) => {
        console.log('Sending:', config.method, config.url);
      },
    ],
    afterResponse: [
      (response, config) => {
        console.log('Received:', response.status, config.url);
      },
    ],
    beforeError: [
      (error, config) => {
        console.error('Failed:', config.url, error.message);
      },
    ],
  },
});
```

### 4) Adapter composition

```ts
import {
  HttpClient,
  AdapterResolver,
  CacheAdapter,
  DedupeAdapter,
  RetryAdapter,
  BackoffStrategy,
} from '@emstack/request';

const adapter = new CacheAdapter(
  new DedupeAdapter(
    new RetryAdapter(AdapterResolver.resolve(), {
      maxRetries: 3,
      delay: 100,
      backoff: BackoffStrategy.exponential,
    }),
  ),
  { ttl: 60_000 },
);

const resilientClient = new HttpClient({ baseURL: 'https://api.example.com' }, adapter);
```

## Error Handling

```ts
import { HttpError, NetworkError, TimeoutError } from '@emstack/request';

try {
  await client.get('/health', { timeout: 3_000 });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else if (error instanceof NetworkError) {
    console.error('Network failure');
  } else if (error instanceof HttpError) {
    console.error('HTTP error:', error.status);
  }
}
```

## Available Exports

Main API includes:

- Core: `HttpClient`, `HttpRequest`, `HttpResponse`
- Adapters: `AdapterResolver`, `RetryAdapter`, `CacheAdapter`, `DedupeAdapter`, `MemoryCacheStore`
- Utilities: `QuerySerializer`
- Errors: `HttpError`, `NetworkError`, `TimeoutError`
- Types: `RequestConfig`, `HttpClientConfig`, `QueryParams`, `HttpMethod`, and related interfaces

See [src/index.ts](src/index.ts) for the full export surface.

## Development

### Requirements

- Node.js 18+
- pnpm 9+

### Scripts

```bash
pnpm dev            # Run Vite dev server
pnpm build          # Type-check and build library to dist/
pnpm test           # Run tests once
pnpm test:watch     # Run tests in watch mode
pnpm test:coverage  # Generate coverage report
pnpm lint           # Lint source files
pnpm lint:fix       # Auto-fix lint issues
pnpm format         # Format source and markdown files
```

### Local setup

```bash
pnpm install
pnpm test
pnpm build
```

## Example Application

A sample React app demonstrating practical usage is available in [examples/todo-app](examples/todo-app).

```bash
cd examples/todo-app
pnpm install
pnpm dev
```

## Testing and Quality

- Unit tests are located under [src/__tests__](src/__tests__)
- Coverage output is generated under [coverage](coverage)
- ESLint and Prettier are configured for consistent code quality

## Release and Commit Conventions

- Commit linting uses Conventional Commits
- `semantic-release` is configured for automated releases

For contribution workflow, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

No license file is currently included in this repository. Add a license before publishing publicly.
