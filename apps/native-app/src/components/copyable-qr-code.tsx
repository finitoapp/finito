import { memo } from "react"
import { View } from "tamagui"
import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.ts"
import { useTranslation } from "../hooks/use-translation.ts"
import { radius } from "../theme/tokens.ts"
import { QrCode } from "./qr-code.tsx"

/**
 * Web `apps/web-app/src/components/copyable-qr-code.tsx`: a payment request
 * QR that copies its content when tapped, drawn full width on a white
 * rounded square whatever the theme, since scanners need the contrast.
 *
 * Tailwind mirrored: `aspect-square w-full rounded-xl bg-white p-4 ring-1
 * ring-foreground/10 active:scale-[0.98]`.
 *
 * Native differences: only web's `ready` state; no native caller shows the
 * pending or empty one. Memoized, as `QrCode` is, so screen re-renders skip it.
 */
export const CopyableQrCode = memo(function CopyableQrCode({
  value,
}: {
  readonly value: string
}) {
  const { t } = useTranslation()
  const copy = useCopyToClipboard()
  return (
    <View
      w="100%"
      aspectRatio={1}
      rounded={radius.xl}
      bg="neutral-soft"
      p={16}
      scale="1 press:0.98"
      style={{ backgroundColor: "#fff" }}
      role="button"
      aria-label={t("paymentWait.copyQr")}
      cursor="web:pointer"
      onPress={() =>
        void copy(value, {
          copied: t("paymentWait.qrCopied"),
          failed: t("paymentWait.qrCopyFailed"),
        })
      }
    >
      <QrCode value={value} />
    </View>
  )
})
