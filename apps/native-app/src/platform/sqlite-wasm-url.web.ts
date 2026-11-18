/**
 * `@evolu/sqlite-wasm`'s `sqliteWasmUrl` on web, which metro.config.js swaps
 * in for the package's own: the binary as a Metro asset, so the export emits
 * it and the Db worker, which has no `import.meta.url`, gets its URL.
 */
// Metro resolves assets through require only.
const wasm: unknown = require("@evolu/sqlite-wasm/sqlite3.wasm")

export const sqliteWasmUrl = new URL(String(wasm), self.location.origin)
