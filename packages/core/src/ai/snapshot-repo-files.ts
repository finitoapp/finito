import type { Run } from "@evolu/common"
import type { FetchDep } from "../deps.ts"
import {
  fetchRepoSnapshot,
  type RepoSnapshot,
} from "../integrations/repo-snapshot/repo-snapshot-client.ts"
import type { RepoFiles } from "./repo-ai-tools.ts"

/** The repository files of a snapshot, noting when it is not the app's code. */
export const snapshotRepoFiles = (
  { version, files }: RepoSnapshot,
  appVersion: string
): RepoFiles => ({
  paths: Object.keys(files),
  read: async (path) =>
    Object.hasOwn(files, path) ? (files[path] ?? null) : null,
  note:
    version === appVersion
      ? null
      : `Note: this is the code of version ${version}, while the app runs ${appVersion}.`,
})

let loaded: Promise<RepoFiles> | null = null

/**
 * The repository files for the assistant's tools, downloaded on their first
 * use and kept while the app runs. A failed download is tried again next time.
 */
export const createSnapshotRepoFilesLoader =
  (
    run: Run<FetchDep>,
    {
      snapshotUrl,
      appVersion,
    }: {
      /** Where the deployment serves `repo-snapshot.json`. */
      readonly snapshotUrl: string
      readonly appVersion: string
    }
  ) =>
  (): Promise<RepoFiles> => {
    loaded ??= (async () => {
      try {
        const snapshot = await run.orThrow(fetchRepoSnapshot(snapshotUrl))
        return snapshotRepoFiles(snapshot, appVersion)
      } catch (error) {
        loaded = null
        // The tool fails with it, and the model reads that it failed.
        throw error
      }
    })()
    return loaded
  }
