import { emptyScanBuffer, readScanKey } from "@payky/app-shared/hardware-scan"
import { useFocusEffect } from "expo-router"
import { useCallback, useEffectEvent } from "react"
import { addHardwareKeyListener } from "../platform/hardware-keys"

/**
 * Reports codes from a keyboard-wedge barcode scanner while `enabled`, as
 * web's hook (docs/decisions/scanner/0001) and with the same classification
 * (`readScanKey`). Unlike on web the closing Enter is not swallowed: on
 * Android the key reaches JS only after native has passed it on, so a
 * focused text field still sees it, and the web build keeps it the same. The
 * terminal keypad, which sees the same keys, therefore tells the scan apart
 * itself (`readKeypadKey`). Listens only while its screen is focused, so a
 * screen under the one on top never reacts to the same scan: through
 * `useFocusEffect`, not `useIsFocused`, so a screen that loses focus is not
 * rendered again for it (on a slow terminal, re-rendering home as it is
 * covered cost ~200 ms per navigation). Not verified against a real scanner.
 */
export function useHardwareScanner({
  enabled,
  onScan,
}: {
  readonly enabled: boolean
  readonly onScan: (code: string) => void
}) {
  const handleScan = useEffectEvent(onScan)

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return

      let buffer = emptyScanBuffer
      return addHardwareKeyListener((event) => {
        const result = readScanKey(buffer, event)
        buffer = result.buffer
        if (result.scanned !== null) handleScan(result.scanned)
      })
    }, [enabled])
  )
}
