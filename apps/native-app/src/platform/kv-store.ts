import { createMMKV } from "react-native-mmkv"

/** The synchronous key-value store `viewStateAtom` keeps view state in. */
export interface KvStore {
  readonly getItemSync: (key: string) => string | null
  readonly setItemSync: (key: string, value: string) => void
  readonly removeItemSync: (key: string) => void
}

const storage = createMMKV({ id: "view-state" })

export const kvStore: KvStore = {
  getItemSync: (key) => storage.getString(key) ?? null,
  setItemSync: (key, value) => storage.set(key, value),
  removeItemSync: (key) => {
    storage.remove(key)
  },
}
