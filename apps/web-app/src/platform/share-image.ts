const sharedImagesCacheDirectory = "shared-images"

const shareCanceledMessage = "Share canceled"

export async function sharePngImage({
  filename,
  base64Png,
}: {
  readonly filename: string
  readonly base64Png: string
}): Promise<void> {
  const [{ Directory, Filesystem }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ])

  const { uri } = await Filesystem.writeFile({
    path: `${sharedImagesCacheDirectory}/${filename}`,
    data: base64Png,
    directory: Directory.Cache,
    recursive: true,
  })

  try {
    await Share.share({ title: filename, files: [uri] })
  } catch (error) {
    if (error instanceof Error && error.message === shareCanceledMessage) {
      return
    }
    throw error
  }
}
