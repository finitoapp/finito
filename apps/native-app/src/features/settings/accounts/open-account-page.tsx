import { brandName, paykyBrand } from "@payky/app-shared/brand"
import {
  type OpenAccountStep,
  openAccountStepCopy,
  parseOpenAccountStep,
} from "@payky/app-shared/open-account"
import { router, useLocalSearchParams } from "expo-router"
import { useAtomValue, useStore } from "jotai"
import { Text, YStack } from "tamagui"
import { evoluCounterAtom } from "../../../atoms/evolu-counter.ts"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { OpenAccountFlow } from "../../shared/open-account-flow.tsx"
import { useRestoreAccount } from "../../shared/use-restore-account.ts"

/**
 * `/settings/accounts/open`: adds an account the user already has to this
 * device (onboarding/0011), the chooser and each way of opening it, as
 * onboarding offers them. The step is in the URL, so the system Back walks
 * them.
 */
export function OpenAccountPage() {
  const { t } = useTranslation()
  const { step: rawStep } = useLocalSearchParams<{ step?: string }>()
  const step = parseOpenAccountStep(rawStep)
  const store = useStore()
  const accountVersion = useAtomValue(evoluCounterAtom)
  const restoring = useRestoreAccount("settings")
  const copy = openAccountStepCopy[step]
  const sourceApp = brandName(paykyBrand)

  const goTo = (next: OpenAccountStep) => {
    restoring.setError(null)
    router.push({ pathname: "/settings/accounts/open", params: { step: next } })
  }

  return (
    <Screen>
      <FadeHeader title={t(copy.title, { sourceApp })} />
      <YStack gap={20}>
        <Text color="muted-foreground">
          {t(copy.description, { sourceApp })}
        </Text>
        <OpenAccountFlow
          step={step}
          source="settings"
          confirmBeforeAdding
          disabled={restoring.pending}
          restore={{
            error: restoring.error,
            pending: restoring.pending,
            onRestore: (phrase) => {
              // Switched account meanwhile: the phrase was meant for the other.
              if (store.get(evoluCounterAtom) !== accountVersion) return
              void restoring.restore(phrase)
            },
          }}
          onStepChange={goTo}
        />
      </YStack>
    </Screen>
  )
}
