import { NativeModule, requireOptionalNativeModule } from "expo"
import { z } from "zod"

export type NfcStatus = "unsupported" | "disabled" | "enabled"

/** `modules/finito-nfc`; the Android half of web's `platform/nfc.ts`. */
declare class FinitoNfcNativeModule extends NativeModule<{
  onTagRead: (event: unknown) => void
}> {
  getStatus(): NfcStatus
  startReading(): void
  stopReading(): void
  openSettings(): void
}

const NfcTagReadEventSchema = z.object({
  uri: z.string().nullable().default(null),
})

// Absent in a binary built before the module existed: then there is no reader.
const nfc = requireOptionalNativeModule<FinitoNfcNativeModule>("FinitoNfc")

export const getNfcStatus = (): NfcStatus =>
  nfc === null ? "unsupported" : nfc.getStatus()

export const openNfcSettings = (): void => nfc?.openSettings()

/**
 * Turns the reader on and calls `onTag` with each tapped tag's first NDEF
 * URI, or `null` for a tag that carries none. The returned function turns
 * the reader off again. Does nothing without the native module.
 */
export const startNfcReading = (
  onTag: (uri: string | null) => void
): (() => void) => {
  if (nfc === null) return () => {}

  const subscription = nfc.addListener("onTagRead", (event) => {
    const parsed = NfcTagReadEventSchema.safeParse(event)
    onTag(parsed.success ? parsed.data.uri : null)
  })
  nfc.startReading()

  return () => {
    subscription.remove()
    nfc.stopReading()
  }
}
