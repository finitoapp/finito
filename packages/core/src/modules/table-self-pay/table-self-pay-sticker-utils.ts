import { equalBytes } from "@noble/curves/utils.js"

import { deriveTableSelfPayKeys } from "../shared/key-derivation.ts"
import type { WssUrl } from "../shared/schema.ts"
import { parseTableSelfPayAddress } from "./table-self-pay-address-utils.ts"
import { hasSameRelays } from "./table-self-pay-relay-utils.ts"

export type TableSelfPayStickerCheck =
  | { readonly kind: "notTableCode" }
  | { readonly kind: "foreign" }
  | {
      readonly kind: "current" | "earlier" | "relaysChanged"
      readonly tableName: string
    }

export const checkTableSelfPaySticker = ({
  scanned,
  origins,
  addressRelays,
  tables,
  root,
}: {
  readonly scanned: string
  readonly origins: ReadonlyArray<string>
  readonly addressRelays: ReadonlyArray<WssUrl>
  readonly tables: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly selfPayEpoch: number | null
  }>
  readonly root: Uint8Array
}): TableSelfPayStickerCheck => {
  const sticker = parseTableSelfPayAddress(scanned)
  if (sticker === null) return { kind: "notTableCode" }
  const scannedOrigin = new URL(scanned).origin
  if (!origins.some((origin) => new URL(origin).origin === scannedOrigin)) {
    return { kind: "foreign" }
  }

  for (const table of tables) {
    const currentEpoch = table.selfPayEpoch ?? 0
    for (let epoch = currentEpoch; epoch >= 0; epoch--) {
      const keys = deriveTableSelfPayKeys(root, table.id, epoch)
      if (
        equalBytes(keys.publicKey, sticker.publicKey) &&
        equalBytes(keys.viewKey, sticker.viewKey)
      ) {
        if (epoch !== currentEpoch) {
          return { kind: "earlier", tableName: table.name }
        }
        return {
          kind: hasSameRelays(sticker.relays, addressRelays)
            ? "current"
            : "relaysChanged",
          tableName: table.name,
        }
      }
    }
  }
  return { kind: "foreign" }
}
