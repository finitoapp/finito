import { jsonCodec } from "@payky/core/zod-utils"
import { atomWithStorage } from "jotai/utils"
import { z } from "zod"
import { kvStore } from "./kv-store"

/**
 * Per-device view state that must not sync and is harmless to lose, as web's
 * `useLocalStorageState` (AGENTS.md's localStorage exception), kept in
 * an MMKV store under web's keys (`kv-store.ts`). It is read synchronously
 * when the atom is created (at module load), so the stored value shows on
 * the first frame; a missing, corrupted or stale entry, or a failing store,
 * falls back to `initial`, and a failed write is dropped.
 */
export function viewStateAtom<T>(
  key: string,
  schema: z.ZodType<T>,
  initial: T
) {
  const codec = jsonCodec(schema)
  return atomWithStorage<T>(
    key,
    initial,
    {
      getItem: (itemKey, fallback) => {
        try {
          const raw = kvStore.getItemSync(itemKey)
          if (raw === null) return fallback
          const parsed = z.safeDecode(codec, raw)
          return parsed.success ? parsed.data : fallback
        } catch {
          return fallback
        }
      },
      setItem: (itemKey, value) => {
        try {
          kvStore.setItemSync(itemKey, z.encode(codec, value))
        } catch {}
      },
      removeItem: (itemKey) => {
        try {
          kvStore.removeItemSync(itemKey)
        } catch {}
      },
    },
    { getOnInit: true }
  )
}
