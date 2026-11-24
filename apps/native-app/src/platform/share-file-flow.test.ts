import { describe, expect, it } from "vitest"
import { type ShareFileIo, shareTempFile } from "./share-file-flow.ts"

const makeIo = (overrides: Partial<ShareFileIo> = {}) => {
  const calls: string[] = []
  const io: ShareFileIo = {
    isSharingAvailable: async () => {
      calls.push("available")
      return true
    },
    writeTemp: async ({ folder }) => {
      calls.push("write")
      return `file:///cache/${folder}/x.sqlite`
    },
    share: async ({ mimeType }) => {
      calls.push(`share ${mimeType}`)
    },
    removeTemp: () => {
      calls.push("remove")
    },
    ...overrides,
  }
  return { io, calls }
}

const input = {
  bytes: new Uint8Array([1]),
  filename: "x.sqlite",
  mimeType: "application/vnd.sqlite3",
  folder: "f",
}

describe("shareTempFile", () => {
  it("writes and shares, leaving the file for the next cleanup", async () => {
    const { io, calls } = makeIo()
    await expect(shareTempFile({ io, ...input })).resolves.toBe("handedOff")
    expect(calls).toEqual([
      "available",
      "write",
      "share application/vnd.sqlite3",
    ])
  })

  it("writes nothing when sharing is unavailable", async () => {
    const { io, calls } = makeIo({ isSharingAvailable: async () => false })
    await expect(shareTempFile({ io, ...input })).resolves.toBe("unavailable")
    expect(calls).toEqual([])
  })

  it("leaves the file in place when the share throws", async () => {
    const { io, calls } = makeIo({
      share: async () => {
        throw new Error("boom")
      },
    })
    await expect(shareTempFile({ io, ...input })).rejects.toThrow("boom")
    expect(calls).not.toContain("remove")
  })

  it("removes the temp folder when the write fails", async () => {
    const { io, calls } = makeIo({
      writeTemp: async () => {
        throw new Error("disk full")
      },
    })
    await expect(shareTempFile({ io, ...input })).rejects.toThrow("disk full")
    expect(calls).toEqual(["available", "remove"])
  })

  it("still reports the write failure when removal itself throws", async () => {
    const { io } = makeIo({
      writeTemp: async () => {
        throw new Error("disk full")
      },
      removeTemp: () => {
        throw new Error("busy")
      },
    })
    await expect(shareTempFile({ io, ...input })).rejects.toThrow("disk full")
  })
})
