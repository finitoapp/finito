import * as Crypto from "expo-crypto"
import { Directory, File, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"
import {
  type ShareFileIo,
  type ShareFileOutcome,
  shareTempFile,
} from "./share-file-flow.ts"

const folderPrefix = "share-"
/** What builds before this module named their folders (the Evolu export's). */
const staleFolderPrefixes = [folderPrefix, "evolu-export-"]

/** Clears the folders earlier shares left in the cache. */
export const removeStaleSharedFiles = (): void => {
  for (const entry of Paths.cache.list()) {
    if (
      entry instanceof Directory &&
      staleFolderPrefixes.some((prefix) => entry.name.startsWith(prefix))
    ) {
      entry.delete()
    }
  }
}

/** The app's private cache: never shared storage, and readable by the share sheet through expo-sharing's FileProvider. */
const shareFileIo: ShareFileIo = {
  isSharingAvailable: () => Sharing.isAvailableAsync(),
  writeTemp: async ({ folder, filename, bytes }) => {
    // Clear anything an earlier share left behind (app killed mid-share).
    removeStaleSharedFiles()
    const directory = new Directory(Paths.cache, folder)
    directory.create({ intermediates: true })
    const file = new File(directory, filename)
    file.create()
    await file.write(bytes)
    return file.uri
  },
  share: ({ uri, filename, mimeType }) =>
    Sharing.shareAsync(uri, { mimeType, dialogTitle: filename }),
  removeTemp: (folder) => {
    const directory = new Directory(Paths.cache, folder)
    if (directory.exists) directory.delete()
  },
}

/**
 * Hands `bytes` to the share sheet as a file named `filename`
 * (`share-file-flow.ts` says where it lives and for how long). Never RN's
 * `Share.share({ message })`, whose intent overflows on a long text.
 */
export const shareFile = (input: {
  readonly filename: string
  readonly mimeType: string
  readonly bytes: Uint8Array
}): Promise<ShareFileOutcome> =>
  shareTempFile({
    io: shareFileIo,
    // `expo-crypto` is a CSPRNG.
    folder: `${folderPrefix}${Crypto.randomUUID()}`,
    ...input,
  })
