import type { EvoluExportDatabase } from "@payky/app-shared/evolu-export"

import { type SavedFileDestination, saveFile } from "@/lib/save-file.ts"

interface EvoluExportFile {
  readonly database: EvoluExportDatabase
  readonly filename: string
  readonly bytes: Uint8Array<ArrayBuffer>
}

export interface SavedEvoluExportFile extends EvoluExportFile {
  readonly destination: { readonly type: SavedFileDestination }
}

const evoluExportMimeType = "application/vnd.sqlite3"

/**
 * Resolves to `null` when the user dismisses the native share sheet: nothing
 * left the device, which is neither a success nor a failure.
 *
 * The export holds the Spark wallet secret, which is why `saveFile` keeps it
 * in the app's private cache on native and hands it only to the share sheet.
 */
export async function saveEvoluExportFile(
  file: EvoluExportFile
): Promise<SavedEvoluExportFile | null> {
  const destination = await saveFile({
    filename: file.filename,
    mimeType: evoluExportMimeType,
    bytes: file.bytes,
    cacheDirectory: "evolu-export",
  })

  return destination === null
    ? null
    : { ...file, destination: { type: destination } }
}
