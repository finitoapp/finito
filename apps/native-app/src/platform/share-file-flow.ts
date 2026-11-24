/** The file system and share sheet, injected so the order of operations is testable. */
export interface ShareFileIo {
  readonly isSharingAvailable: () => Promise<boolean>
  /** Writes `bytes` into a fresh private cache folder and returns the file URI. */
  readonly writeTemp: (input: {
    readonly folder: string
    readonly filename: string
    readonly bytes: Uint8Array
  }) => Promise<string>
  /** Resolves when the share sheet closes; a completed share and a dismissal look the same. */
  readonly share: (input: {
    readonly uri: string
    readonly filename: string
    readonly mimeType: string
  }) => Promise<void>
  readonly removeTemp: (folder: string) => void
}

/**
 * `handedOff`: the share sheet closed, shared or dismissed alike, so it is
 * no success to report. `saved`: the web export's browser download started.
 */
export type ShareFileOutcome = "handedOff" | "saved" | "unavailable"

/**
 * A shared file can hold every secret in the app database (the Evolu
 * export), so it lives only in the app's private cache (not backed up), in a
 * folder named by a random id. Once handed to the share sheet the file is
 * deliberately left in place: the target app (Gmail, Drive, Signal) may read
 * it lazily, after the sheet has closed, and deleting it then would silently
 * lose it. The next share and the next app start clear stale folders. A file
 * that was never handed over (write failed) is removed at once; nothing is
 * written when sharing is unavailable. A failure is thrown; the bytes and the
 * URI are never logged.
 */
export async function shareTempFile({
  io,
  bytes,
  filename,
  mimeType,
  folder,
}: {
  readonly io: ShareFileIo
  readonly bytes: Uint8Array
  readonly filename: string
  readonly mimeType: string
  /** Random and unguessable: the caller draws it from a CSPRNG. */
  readonly folder: string
}): Promise<ShareFileOutcome> {
  if (!(await io.isSharingAvailable())) return "unavailable"

  let uri: string
  try {
    uri = await io.writeTemp({ folder, filename, bytes })
  } catch (error) {
    try {
      io.removeTemp(folder)
    } catch {
      // Nothing left to do; the next cleanup clears it.
    }
    throw error
  }
  await io.share({ uri, filename, mimeType })
  return "handedOff"
}
