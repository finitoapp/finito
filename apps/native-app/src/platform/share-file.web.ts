import type { ShareFileOutcome } from "./share-file-flow.ts"

/** A browser download leaves nothing in the app to clear. */
export const removeStaleSharedFiles = (): void => {}

/**
 * Web's share: the browser downloads the file, as web-app's
 * `downloadWithBrowser`. The bytes live only in a blob URL, revoked once the
 * download has started.
 */
export const shareFile = async ({
  filename,
  mimeType,
  bytes,
}: {
  readonly filename: string
  readonly mimeType: string
  readonly bytes: Uint8Array
}): Promise<ShareFileOutcome> => {
  const uri = URL.createObjectURL(new Blob([bytes.slice()], { type: mimeType }))
  const link = document.createElement("a")
  link.href = uri
  link.download = filename
  link.rel = "noreferrer"
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(uri)
  return "saved"
}
