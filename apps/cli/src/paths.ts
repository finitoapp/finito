import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const repositoryRoot = fileURLToPath(
  new URL("../../..", import.meta.url)
)

/**
 * The directory the CLI keeps its database in, `payky.db`: `value` resolved
 * against the caller's working directory, `.data` in the repository by default.
 */
export const resolveDataDir = (
  value: string | undefined,
  cwd: string
): string =>
  value === undefined ? resolve(repositoryRoot, ".data") : resolve(cwd, value)
