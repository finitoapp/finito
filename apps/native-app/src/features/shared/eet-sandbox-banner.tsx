import { router, usePathname } from "expo-router"
import FlaskConical from "lucide-react-native/icons/flask-conical"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Text, useTheme, XStack } from "tamagui"
import { SafeAreaView } from "../../components/safe-area-view.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { isTerminalRoute } from "../../core/route-access.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize, fontWeight, radius } from "../../theme/tokens.ts"
import { useEetSettings } from "./use-eet-settings.ts"

/**
 * Web's `EetSandboxBanner`, mounted above every terminal screen while EET
 * reports to the playground, so nobody takes test receipts for reported
 * sales. Web overlays it and pads the viewport by its height; native lays it
 * out above the navigator and over the top inset its screens pad by, so they
 * start right below it.
 */
export function EetSandboxBanner() {
  const pathname = usePathname()
  const { isSandboxActive } = useEetSettings()
  if (!isSandboxActive || !isTerminalRoute(pathname)) return null
  return <SandboxBanner />
}

function SandboxBanner() {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{
        backgroundColor: theme.background.val,
        paddingHorizontal: 12,
        marginBottom: -insets.top,
        zIndex: 1,
      }}
    >
      <XStack
        testID="eet-sandbox-banner"
        role="link"
        cursor="web:pointer"
        onPress={() => router.push("/settings/eet")}
        h={40}
        items="center"
        gap={8}
        px={12}
        bg="warning-10"
        borderBottomLeftRadius={radius.lg}
        borderBottomRightRadius={radius.lg}
      >
        <Icon icon={FlaskConical} size={16} color="warning" />
        <Text
          flex={1}
          numberOfLines={1}
          fontSize={fontSize.xs}
          lineHeight={fontSize.xs}
          fontWeight={fontWeight.medium}
          color="warning"
        >
          {t("eet.sandbox.banner")}
        </Text>
      </XStack>
    </SafeAreaView>
  )
}
