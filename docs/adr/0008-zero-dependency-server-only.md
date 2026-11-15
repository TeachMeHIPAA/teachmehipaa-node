# Zero runtime dependencies, server-only

`teachmehipaa-node` has no runtime dependencies. It uses the platform `fetch`,
Web Crypto and `node:crypto`, and ships ESM and CJS from one TypeScript
source. It doesn't support browsers: the API's CORS policy never allows
partner origins, and a browser bundle would expose the client secret. Bun and
Deno work through the same `fetch` path.
