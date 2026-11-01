import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import packageJson from "../package.json" with { type: "json" }
import { releaseCommitSubject } from "./release-version.ts"

/**
 * What the web app's and the native app's builds both stamp into what they
 * ship: the version, and the repository snapshot the assistant reads.
 */

const repositoryRoot = path.resolve(import.meta.dirname, "..")

/**
 * The version the app shows and Sentry's `release`, which is what ties an
 * event to its source maps (`docs/releases.md`). The release commit
 * `bin/release.ts` makes builds as the `package.json` version itself; every
 * other commit — edge.payky.me, a local build — is that last release plus its
 * commit, so two edge builds never share a release. Without git (a source
 * tarball, a Docker build context) only the version is known.
 */
export function getAppVersion(): string {
  const { version } = packageJson
  try {
    const [sha, subject] = execFileSync(
      "git",
      ["log", "-1", "--format=%h%n%s"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    )
      .trim()
      .split("\n")
    return subject === releaseCommitSubject(version)
      ? version
      : `${version}-edge.${sha}`
  } catch {
    return version
  }
}

const repoSnapshotPaths = ["apps", "packages", "docs", "AGENTS.md"]

/**
 * The repository's text files the app assistant's tools read (ai/0003), as
 * `packages/core/src/integrations/repo-snapshot/repo-snapshot-client.ts` expects them.
 * Only files git tracks, so `.env` files and build output stay out.
 */
export function readRepoSnapshot(): string {
  // `-I` leaves binary files out; every text file matches the empty pattern.
  const paths = execFileSync(
    "git",
    ["grep", "-I", "-l", "-z", "-e", "", "--", ...repoSnapshotPaths],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
  )
    .split("\0")
    .filter((file) => file !== "")
  const files = Object.fromEntries(
    paths.map((file) => [
      file,
      readFileSync(path.join(repositoryRoot, file), "utf8"),
    ])
  )
  return JSON.stringify({ version: getAppVersion(), files })
}
