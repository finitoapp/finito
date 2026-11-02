import { mkdirSync } from "node:fs"
import { createNodeEvolu } from "@payky/core/runtime/node-evolu"
import { cliEnv } from "./cli-env.ts"

/**
 * The CLI's Evolu on `payky.db` in its data directory. Evolu's Node driver
 * opens a database only in the working directory, so the CLI moves there; its
 * own paths are absolute and do not depend on it.
 */
export const createCliEvolu = (dataDir = cliEnv.PAYKY_DATA_DIR) => {
  mkdirSync(dataDir, { recursive: true })
  process.chdir(dataDir)
  return createNodeEvolu("file")
}
