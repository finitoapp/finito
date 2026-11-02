import { createEvoluDeps, createRun, lockManager } from "@evolu/react-native"

/**
 * The Evolu platform half the composition root picks per platform: Evolu's
 * own native SQLite, which opens the databases expo-sqlite's SQLCipher wrote
 * for earlier builds in place, and an in-memory lock manager here,
 * `evolu-runtime.web.ts` on web.
 */
export { createEvoluDeps, createRun, lockManager }
