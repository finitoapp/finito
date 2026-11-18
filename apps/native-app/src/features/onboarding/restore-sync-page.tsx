import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  initialOnboardingFormState,
  onboardingFormAtom,
} from "@payky/app-shared/onboarding-form-state"
import {
  planRestoreCleanup,
  restoredAccountAtom,
} from "@payky/app-shared/restored-account"
import {
  removeDeviceAccount,
  selectAccount,
} from "@payky/core/evolu/device-account"
import {
  evaluateInitialSync,
  findOwnerRelays,
  type InitialSyncOutcome,
  isRelaySyncing,
} from "@payky/core/evolu/initial-sync-state"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { useNetworkState } from "expo-network"
import { router, useLocalSearchParams } from "expo-router"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import KeyRound from "lucide-react-native/icons/key-round"
import Plus from "lucide-react-native/icons/plus"
import RefreshCw from "lucide-react-native/icons/refresh-cw"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useEffect, useState, useSyncExternalStore } from "react"
import { ActivityIndicator } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { z } from "zod"
import { accountAtom } from "../../atoms/account.ts"
import { deviceEvoluAtom } from "../../atoms/device-evolu.ts"
import { evoluAtom } from "../../atoms/evolu.ts"
import { reloadAppEvoluAtom } from "../../atoms/evolu-counter.ts"
import { Screen } from "../../components/screen.tsx"
import { Button } from "../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { showMenuRoot } from "../../core/menu-navigation.ts"
import { nativeRun } from "../../core/native-runtime.ts"
import { isE2eOffline } from "../../e2e/e2e-network.ts"
import { useConfirm } from "../../hooks/use-confirm.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { TransportAddForm } from "../shared/evolu-transports/transport-add-form.tsx"
import { TransportToggleList } from "../shared/evolu-transports/transport-toggle-list.tsx"

// Falls back instead of throwing, and only `source` is read from the route:
// which account to remove or select never comes from it (account/0005).
const SourceSchema = z.enum(["onboarding", "settings"]).catch("settings")

const outcomePresentation = {
  waiting: {
    title: "accountRestore.title",
    description: "accountRestore.description",
  },
  restored: {
    title: "accountRestore.title",
    description: "accountRestore.description",
  },
  empty: {
    title: "accountRestore.empty.title",
    description: "accountRestore.empty.description",
  },
  failed: {
    title: "accountRestore.failed.title",
    description: "accountRestore.failed.description",
  },
} satisfies Record<
  InitialSyncOutcome,
  { readonly title: TranslationKey; readonly description: TranslationKey }
>

const SYNC_TICK_MS = 1000
const SETTLE_MS = 400

/** `evaluateInitialSync` with its idle clock and the settling web applies. */
function useInitialSyncOutcome(hasSettings: boolean) {
  const evolu = useAtomValue(evoluAtom)
  const { syncState } = nativeRun.deps
  const state = useSyncExternalStore(syncState.subscribe, syncState.get)
  const relays = findOwnerRelays(state, evolu.name, evolu.appOwner.id)
  const network = useNetworkState()
  // Unknown (undefined) counts as online, as the browser's `onLine` does.
  const online =
    network.isConnected !== false &&
    network.isInternetReachable !== false &&
    !isE2eOffline()
  const syncing = relays?.some(isRelaySyncing) === true
  const [idle, setIdle] = useState(() => ({ syncing, since: Date.now() }))
  if (idle.syncing !== syncing) setIdle({ syncing, since: Date.now() })
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), SYNC_TICK_MS)
    return () => clearInterval(id)
  }, [])

  const next = evaluateInitialSync({
    relays,
    hasSettings,
    online,
    idleForMs: now - idle.since,
  })
  // Relay statuses flip within moments of each other; settling the outcome
  // keeps a transient mix from flashing an error.
  const [outcome, setOutcome] = useState(next)
  useEffect(() => {
    const id = setTimeout(() => setOutcome(next), SETTLE_MS)
    return () => clearTimeout(id)
  }, [next])

  return {
    outcome,
    online,
    restart: () => setIdle({ syncing, since: Date.now() }),
  }
}

/**
 * Waits for a restored account's first sync and decides what it found: the
 * account's settings (go home), relays that synced but hold nothing, or
 * relays that could not be synced with. Mirrors web's RestoreSyncPage,
 * including adding a relay once the wait has settled.
 */
export function RestoreSyncPage() {
  const { t } = useTranslation()
  const source = SourceSchema.parse(useLocalSearchParams().source)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const account = useAtomValue(accountAtom)
  const reloadAppEvolu = useSetAtom(reloadAppEvoluAtom)
  const confirm = useConfirm()
  const setOnboardingForm = useSetAtom(onboardingFormAtom)
  const { data } = useEvoluQuery(settingsQuery)
  const hasSettings = data[0] !== undefined
  const { outcome, online, restart } = useInitialSyncOutcome(hasSettings)
  const [addingRelay, setAddingRelay] = useState(false)
  const settled = outcome === "empty" || outcome === "failed"

  // Taken once and the atom emptied, so the restore is cleaned up after at
  // most once: a later visit finds nothing to remove or select.
  const [restoredAccount, setRestoredAccount] = useAtom(restoredAccountAtom)
  const [restored] = useState(() => restoredAccount)
  useEffect(() => {
    setRestoredAccount(null)
  }, [setRestoredAccount])
  const cleanup = planRestoreCleanup({
    restored,
    activeAccountId: account.id,
    source,
  })
  const previousToDiscard = cleanup.discardOnSuccess

  useEffect(() => {
    if (!hasSettings) return
    if (previousToDiscard !== undefined) {
      removeDeviceAccount(deviceEvolu, previousToDiscard)
    }
    showMenuRoot("/")
  }, [deviceEvolu, previousToDiscard, hasSettings])

  const retry = () => {
    reloadAppEvolu()
    restart()
  }

  const switchToAnotherPhrase = () => {
    if (cleanup.removeOnCancel !== undefined) {
      removeDeviceAccount(deviceEvolu, cleanup.removeOnCancel)
    }
    if (cleanup.selectOnCancel !== undefined) {
      selectAccount(deviceEvolu, cleanup.selectOnCancel)
    }
    if (source === "onboarding") {
      setOnboardingForm({
        ...initialOnboardingFormState,
        accountType: "restore",
        step: "restore",
      })
    }
    reloadAppEvolu()
    if (source === "onboarding") router.replace("/onboarding")
    else showMenuRoot("/")
  }

  const setUpAsNew = async () => {
    // Relays that synced empty hold nothing to lose; one that could not be
    // reached may still hold the account, which a later sync would overwrite.
    if (outcome === "failed") {
      const confirmed = await confirm({
        title: t("accountRestore.setupNew.confirm.title"),
        description: t("accountRestore.setupNew.confirm.description"),
        confirmLabel: t("accountRestore.setupNew.confirm.confirm"),
        cancelLabel: t("accountRestore.setupNew.confirm.cancel"),
        variant: "destructive",
      })
      if (!confirmed) return
    }
    if (previousToDiscard !== undefined) {
      removeDeviceAccount(deviceEvolu, previousToDiscard)
    }
    setOnboardingForm({
      ...initialOnboardingFormState,
      accountType: "existingMnemonic",
      step: "payments",
    })
    router.replace("/onboarding")
  }

  const { title, description } = outcomePresentation[outcome]

  return (
    <Screen>
      <YStack gap="5">
        <YStack gap="3" items="center" text="center" aria-live="polite">
          {settled ? (
            <Icon icon={TriangleAlert} size={32} color="destructive" />
          ) : (
            <ActivityIndicator size="large" />
          )}
          <Text
            fontSize="2xl"
            lineHeight="2xl"
            fontWeight="600"
            role="heading"
            aria-level={1}
          >
            {t(title)}
          </Text>
          <Text fontSize="sm" lineHeight="sm" color="muted-foreground">
            {t(
              outcome === "failed" && !online
                ? "accountRestore.failed.offline"
                : description
            )}
          </Text>
        </YStack>

        <Card>
          <CardHeader>
            <CardTitle>{t("accountRestore.relays.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <YStack gap="4">
              <TransportToggleList accountId={account.id} />
              {settled && addingRelay ? (
                <TransportAddForm accountId={account.id} />
              ) : null}
              {settled && !addingRelay ? (
                <XStack>
                  <Button
                    variant="outline"
                    iconStart={Plus}
                    label={t("accountRestore.action.addRelay")}
                    onPress={() => setAddingRelay(true)}
                  />
                </XStack>
              ) : null}
            </YStack>
          </CardContent>
        </Card>

        <YStack gap="2">
          {settled ? (
            <Button
              label={t("accountRestore.action.retry")}
              iconStart={RefreshCw}
              onPress={retry}
            />
          ) : null}
          <Button
            label={t("accountRestore.action.otherPhrase")}
            iconStart={KeyRound}
            variant="outline"
            onPress={switchToAnotherPhrase}
          />
          {settled ? (
            <Button
              label={t("accountRestore.action.setupNew")}
              variant="ghost"
              onPress={() => {
                void setUpAsNew()
              }}
            />
          ) : null}
        </YStack>
      </YStack>
    </Screen>
  )
}
