import { type BarcodeType, CameraView, useCameraPermissions } from "expo-camera"
import { useIsFocused } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { AppState, Linking } from "react-native"
import { Text, View, YStack } from "tamagui"
import { useTranslation } from "../hooks/use-translation.ts"
import { hapticConfirm } from "../platform/haptics.ts"
import { scanPermissionView, shouldAcceptScan } from "../platform/scan-state.ts"
import { Button } from "./ui/button.tsx"

/** The retail symbologies web scans, plus QR for custom labels. */
export const ALL_SCAN_TYPES: ReadonlyArray<BarcodeType> = [
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "code128",
  "code39",
  "itf14",
  "qr",
]

/** A destination or pairing code is always a QR code. */
export const QR_SCAN_TYPES: ReadonlyArray<BarcodeType> = ["qr"]

const DEFAULT_REPEAT_DELAY_MS = 2000

/**
 * Camera scanner. The scanned string is untrusted input: `onScan` must
 * validate it. Runs only while the screen is focused and the app is in the
 * foreground, ignores the same value within `repeatDelayMs` and everything
 * while a previous `onScan` is still running.
 */
export function ScanCodeScanner({
  onScan,
  types = ALL_SCAN_TYPES,
  repeatDelayMs = DEFAULT_REPEAT_DELAY_MS,
  paused = false,
}: {
  readonly onScan: (rawValue: string) => void | Promise<void>
  readonly types?: ReadonlyArray<BarcodeType>
  readonly repeatDelayMs?: number
  /** Ignores every code while true, e.g. behind an open dialog. */
  readonly paused?: boolean
}) {
  const { t } = useTranslation()
  const [permission, requestPermission] = useCameraPermissions()
  const focused = useIsFocused()
  const [foreground, setForeground] = useState(
    AppState.currentState === "active"
  )
  const [ready, setReady] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [cameraFailed, setCameraFailed] = useState(false)
  const lastRef = useRef<{ value: string; at: number } | null>(null)
  const busyRef = useRef(false)

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setForeground(state === "active")
    )
    return () => sub.remove()
  }, [])

  const active = focused && foreground

  const handle = useCallback(
    async (rawValue: string) => {
      const now = Date.now()
      if (paused || busyRef.current) return
      if (!shouldAcceptScan(lastRef.current, rawValue, now, repeatDelayMs))
        return
      lastRef.current = { value: rawValue, at: now }
      busyRef.current = true
      hapticConfirm()
      try {
        await onScan(rawValue)
      } finally {
        busyRef.current = false
      }
    },
    [onScan, repeatDelayMs, paused]
  )

  const view = scanPermissionView(permission)
  if (view === "checking") return null
  if (view !== "granted") {
    return (
      <YStack gap="3" p="4">
        <Text role="alert">{t("scanner.error.permissionDenied")}</Text>
        <Button
          size="lg"
          label={t(
            view === "request"
              ? "scanner.permission.grant"
              : "scanner.permission.openSettings"
          )}
          onPress={() =>
            view === "request"
              ? void requestPermission()
              : void Linking.openSettings()
          }
        />
      </YStack>
    )
  }
  if (cameraFailed) {
    return <Text p="4">{t("scanner.error.noCamera")}</Text>
  }

  return (
    // The height is the frame's, which the camera fills: expo-camera's web
    // view carries `flex: 1`, which react-native-web writes as a zero
    // flex-basis, so a height on the camera itself drew it 0 px tall in a
    // frame sized by its content.
    <View h={320} overflow="hidden" rounded="lg" bg="black">
      {active ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          // ponytail: expo-camera cannot report torch support, so the toggle
          // shows for any ready back camera; a device without a flash ignores it.
          enableTorch={torchOn}
          barcodeScannerSettings={{ barcodeTypes: [...types] }}
          onCameraReady={() => setReady(true)}
          onMountError={() => setCameraFailed(true)}
          onBarcodeScanned={({ data }) => void handle(data)}
        />
      ) : null}
      {active && ready ? (
        <View position="absolute" b="2" r="2">
          <Button
            size="lg"
            variant="outline"
            label={t(torchOn ? "scanner.torch.off" : "scanner.torch.on")}
            onPress={() => setTorchOn((on) => !on)}
          />
        </View>
      ) : null}
    </View>
  )
}
