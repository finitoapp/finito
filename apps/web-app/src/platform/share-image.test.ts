import type { WriteFileOptions } from "@capacitor/filesystem"
import type { ShareOptions } from "@capacitor/share"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { sharePngImage } from "@/platform/share-image.ts"

const writeFile =
  vi.fn<(options: WriteFileOptions) => Promise<{ uri: string }>>()
const share = vi.fn<(options: ShareOptions) => Promise<unknown>>()

vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Filesystem: { writeFile: (options: WriteFileOptions) => writeFile(options) },
}))

vi.mock("@capacitor/share", () => ({
  Share: { share: (options: ShareOptions) => share(options) },
}))

describe("sharePngImage", () => {
  beforeEach(() => {
    writeFile.mockReset()
    share.mockReset()
    writeFile.mockResolvedValue({ uri: "file:///cache/shared-images/T7.png" })
  })

  test("writes the PNG to the app cache and shares that file", async () => {
    share.mockResolvedValue({})

    await sharePngImage({ filename: "T7.png", base64Png: "iVBORw0KGgo=" })

    expect(writeFile).toHaveBeenCalledWith({
      path: "shared-images/T7.png",
      data: "iVBORw0KGgo=",
      directory: "CACHE",
      recursive: true,
    })
    expect(share).toHaveBeenCalledWith({
      title: "T7.png",
      files: ["file:///cache/shared-images/T7.png"],
    })
  })

  test("treats a dismissed share sheet as done", async () => {
    share.mockRejectedValue(new Error("Share canceled"))

    await expect(
      sharePngImage({ filename: "T7.png", base64Png: "iVBORw0KGgo=" })
    ).resolves.toBeUndefined()
  })

  test("passes any other share failure on", async () => {
    share.mockRejectedValue(new Error("Failed to find configured root"))

    await expect(
      sharePngImage({ filename: "T7.png", base64Png: "iVBORw0KGgo=" })
    ).rejects.toThrow("Failed to find configured root")
  })
})
