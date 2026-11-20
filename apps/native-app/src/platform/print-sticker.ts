import { File, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"
import type { ComponentRef, RefObject } from "react"
import type { View } from "react-native"
import { captureRef } from "react-native-view-shot"

export const printSticker = async (
  sticker: RefObject<ComponentRef<typeof View> | null>,
  filename: string
): Promise<void> => {
  const png = new File(await captureRef(sticker, { format: "png" }))
  await png.move(new File(Paths.cache, filename), { overwrite: true })
  await Sharing.shareAsync(png.uri, {
    mimeType: "image/png",
    dialogTitle: filename,
  })
}
