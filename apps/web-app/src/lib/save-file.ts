import { Capacitor } from "@capacitor/core"

/** Where a saved file went: a browser download or the native share sheet. */
export type SavedFileDestination = "web" | "capacitor"

/**
 * Saves `bytes` as `filename`: a download in a browser, the system share
 * sheet in the Capacitor shell. Resolves to `null` when the user dismisses
 * the share sheet: nothing left the device, which is neither a success nor a
 * failure.
 *
 * On native the file is written to the app's private cache — never shared
 * storage such as `Documents/`, which any app with storage access can read —
 * under `cacheDirectory`, which must be one of the paths
 * `apps/native-shell/android/app/src/main/res/xml/file_paths.xml` lets the
 * FileProvider grant. The directory is cleared first so earlier files do not
 * pile up.
 */
export async function saveFile(file: {
  readonly filename: string
  readonly mimeType: string
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly cacheDirectory: string
}): Promise<SavedFileDestination | null> {
  if (Capacitor.isNativePlatform()) {
    return (await shareWithCapacitor(file)) ? "capacitor" : null
  }

  downloadWithBrowser(file)
  return "web"
}

function downloadWithBrowser(file: {
  readonly filename: string
  readonly mimeType: string
  readonly bytes: Uint8Array<ArrayBuffer>
}): void {
  const blob = new Blob([file.bytes], { type: file.mimeType })
  const href = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = href
  link.download = file.filename
  link.rel = "noreferrer"
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
}

async function shareWithCapacitor(file: {
  readonly filename: string
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly cacheDirectory: string
}): Promise<boolean> {
  const [{ Directory, Filesystem }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ])

  await Filesystem.rmdir({
    path: file.cacheDirectory,
    directory: Directory.Cache,
    recursive: true,
  }).catch(() => undefined)

  const { uri } = await Filesystem.writeFile({
    path: `${file.cacheDirectory}/${file.filename}`,
    data: uint8ArrayToBase64(file.bytes),
    directory: Directory.Cache,
    recursive: true,
  })

  try {
    await Share.share({ title: file.filename, files: [uri] })
    return true
  } catch (error) {
    if (error instanceof Error && error.message === shareCanceledMessage) {
      return false
    }
    throw error
  }
}

/** The rejection message both native Share implementations use on dismiss. */
const shareCanceledMessage = "Share canceled"

/**
 * `btoa` wants a binary string, so the bytes go through `String.fromCharCode`
 * one spread at a time. The chunking is the point: spreading a whole database
 * export in one call would blow the argument limit, and 0x8000 is the usual
 * safe width. Exported for its test — the chunk boundary is the only thing
 * here that can break, and nothing else reaches this from outside.
 *
 * `Uint8Array.prototype.toBase64` would replace all of it, but it doesn't
 * exist in this TypeScript target (ES2024) and isn't in the runtimes this app
 * still supports.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  const chunks: string[] = []

  for (let index = 0; index < bytes.length; index += chunkSize) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(index, index + chunkSize))
    )
  }

  return btoa(chunks.join(""))
}
