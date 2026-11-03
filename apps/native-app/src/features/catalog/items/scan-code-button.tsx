import ScanLine from "lucide-react-native/icons/scan-line"
import { Button } from "../../../components/ui/button.tsx"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { radius } from "../../../theme/tokens.ts"

export function ScanCodeButton({
  disabled = false,
  onPress,
}: {
  readonly disabled?: boolean
  readonly onPress: () => void
}) {
  const { t } = useTranslation()

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      rounded={radius.full}
      iconStart={ScanLine}
      aria-label={t("catalog.items.form.scanCode.scan.aria")}
      disabled={disabled}
      onPress={onPress}
    />
  )
}
