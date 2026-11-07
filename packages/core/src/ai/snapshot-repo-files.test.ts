import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { FetchDep } from "../deps.ts"
import {
  createSnapshotRepoFilesLoader,
  snapshotRepoFiles,
} from "./snapshot-repo-files.ts"

const snapshot = {
  version: "abc1234",
  files: { "apps/web-app/src/app.ts": "export {}" },
}

describe("snapshotRepoFiles", () => {
  test("reads the snapshot's files and nothing else", async () => {
    const files = snapshotRepoFiles(snapshot, "abc1234")
    expect(files.paths).toEqual(["apps/web-app/src/app.ts"])
    expect(await files.read("apps/web-app/src/app.ts")).toBe("export {}")
    expect(await files.read("toString")).toBeNull()
    expect(files.note).toBeNull()
  })

  test("notes when the snapshot is of another version than the app", () => {
    expect(snapshotRepoFiles(snapshot, "def5678").note).toBe(
      "Note: this is the code of version abc1234, while the app runs def5678."
    )
  })
})

describe("createSnapshotRepoFilesLoader", () => {
  test("downloads the snapshot once, and again after a failed download", async () => {
    const responses = [
      new Response("Not found", { status: 404 }),
      Response.json(snapshot),
    ]
    const requestedUrls: string[] = []
    const deps = {
      fetch: async (input) => {
        requestedUrls.push(String(input))
        const response = responses.shift()
        if (response === undefined) throw new Error("Downloaded again")
        return response
      },
    } satisfies FetchDep
    await using run = testCreateRun(deps)
    const loadFiles = createSnapshotRepoFilesLoader(run, {
      snapshotUrl: "https://payky.me/repo-snapshot.json",
      appVersion: "abc1234",
    })

    await expect(loadFiles()).rejects.toThrow()
    expect((await loadFiles()).paths).toEqual(["apps/web-app/src/app.ts"])
    expect((await loadFiles()).paths).toEqual(["apps/web-app/src/app.ts"])
    expect(requestedUrls).toEqual([
      "https://payky.me/repo-snapshot.json",
      "https://payky.me/repo-snapshot.json",
    ])
  })
})
