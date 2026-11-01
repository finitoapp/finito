import { brandName } from "@payky/app-shared/brand"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Text, useTheme, View } from "tamagui"
import { Button } from "../../components/ui/button.tsx"
import { appBrand } from "../../core/app-brand.ts"
import { checkSharedLogic } from "../../core/check-shared-logic.ts"
import { checkLockAuthority } from "../../core/native-runtime.ts"
import { BootstrapDiagnostics } from "./bootstrap-diagnostics.tsx"
import { UiKitCard } from "./ui-kit-card.tsx"

export function NativePreviewPage() {
  const theme = useTheme()
  const [roundedAmount, setRoundedAmount] = useState(checkSharedLogic)
  const [checks, setChecks] = useState(1)
  const [lockStatus, setLockStatus] = useState("checking")

  useEffect(() => {
    checkLockAuthority().then(
      () => setLockStatus("passed"),
      (error: unknown) => setLockStatus(String(error))
    )
  }, [])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View flex={1} justify="center" p="6" gap="6">
          <Text
            fontFamily="heading"
            fontSize="3xl"
            lineHeight="3xl"
            fontWeight="700"
          >
            {brandName(appBrand)} Native
          </Text>
          <Text color="muted-foreground">
            Expo, React Native and Tamagui are ready.
          </Text>
          <View
            backgroundColor="card"
            borderColor="border-color"
            borderWidth={1}
            rounded="lg"
            p="4"
            gap="3"
          >
            <Text fontWeight="600">Shared business logic</Text>
            <Text>
              CZK cash rounding: 123.45 →{" "}
              {(roundedAmount / 100).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
            <Text aria-live="polite">Checks passed: {checks}</Text>
            <Text>Lock authority: {lockStatus}</Text>
            <BootstrapDiagnostics />
          </View>
          <UiKitCard />
          <Button
            size="lg"
            onPress={() => {
              setRoundedAmount(checkSharedLogic())
              setChecks((count) => count + 1)
            }}
          >
            Run shared logic again
          </Button>
          {/* Temporary entry to the bill until the pos overview (P04). */}
          <Button
            variant="outline"
            size="lg"
            onPress={() => router.push("/bill")}
          >
            Open new bill
          </Button>
          <Button
            variant="outline"
            size="lg"
            onPress={() => router.push("/onboarding")}
          >
            Open onboarding
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
