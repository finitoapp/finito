import { chmodSync, closeSync, mkdirSync, openSync } from "node:fs"
import { join } from "node:path"
import { paykyBrand } from "@payky/app-shared/brand"
import { deriveAppOwner } from "@payky/core/evolu/client"
import {
  createDefaultEvoluTransportUrls,
  resolveTransportUrl,
} from "@payky/core/evolu/device-account"
import { mnemonicToMasterKey } from "@payky/core/modules/shared/key-derivation"
import {
  createNodeEvolu,
  type NodeEvoluAccount,
} from "@payky/core/runtime/node-evolu"
import { cliEnv } from "./cli-env.ts"

const databaseFile = "payky.db"

/**
 * The CLI's Evolu on `payky.db` in its data directory. Evolu's Node driver
 * opens a database only in the working directory, so the CLI moves there; its
 * own paths are absolute and do not depend on it.
 */
export const createCliEvolu = (
  dataDir = cliEnv.PAYKY_DATA_DIR,
  account?: NodeEvoluAccount
) => {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  process.chdir(dataDir)
  closeSync(openSync(databaseFile, "a", 0o600))
  chmodSync(databaseFile, 0o600)
  return createNodeEvolu("file", account)
}

export interface CliDataDirDep {
  readonly dataDir: string
}

export const createCliEvoluFromEnv = async () => {
  const mnemonic = cliEnv.PAYKY_RECOVERY_MNEMONIC
  if (mnemonic === undefined) {
    const dataDir = cliEnv.PAYKY_DATA_DIR
    return { ...(await createCliEvolu(dataDir)), dataDir }
  }

  const masterKey = await mnemonicToMasterKey(mnemonic)
  const appOwnerId = deriveAppOwner(masterKey).id
  const dataDir = join(cliEnv.PAYKY_DATA_DIR, appOwnerId)

  const cliEvolu = await createCliEvolu(dataDir, {
    masterKey,
    transports: createDefaultEvoluTransportUrls(
      paykyBrand.liveRelayHost
    ).flatMap((url) => {
      const resolved = resolveTransportUrl(url, appOwnerId)
      return resolved === null ? [] : [{ type: "WebSocket", url: resolved }]
    }),
  })
  return { ...cliEvolu, dataDir }
}
