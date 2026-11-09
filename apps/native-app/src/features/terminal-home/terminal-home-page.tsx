import { sqliteTrue } from "@evolu/common"
import {
  findOwnerRelays,
  initialSyncIdleLimitMs,
  isInitialSyncPending,
} from "@payky/core/evolu/initial-sync-state"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import type { TerminalHomeMode } from "@payky/core/modules/app-settings/app-settings-types"
import {
  getFiatCurrency,
  terminalHomeModes,
} from "@payky/core/modules/app-settings/app-settings-utils"
import { createRandomBillId } from "@payky/core/modules/bill/bill-types"
import { Redirect, router } from "expo-router"
import { useAtomValue } from "jotai"
import Menu from "lucide-react-native/icons/menu"
import { Suspense, useEffect, useState, useSyncExternalStore } from "react"
import { ActivityIndicator, Platform, useWindowDimensions } from "react-native"
import { useTheme, View, XStack, YStack } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import { evoluAtom } from "../../atoms/evolu.ts"
import { LoadingView } from "../../components/loading-view.tsx"
import { menuSidebarMinWidth } from "../../components/menu-nav.tsx"
import { SafeAreaView } from "../../components/safe-area-view.tsx"
import { screenPaddingX } from "../../components/screen.tsx"
import { Button } from "../../components/ui/button.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { NotificationDot } from "../../components/ui/notification-dot.tsx"
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs.tsx"
import { homeModeLabelKeys } from "../../core/home-mode-labels.ts"
import { nativeRun } from "../../core/native-runtime.ts"
import { useActiveNotifications } from "../../hooks/use-active-notifications.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useHardwareScanner } from "../../hooks/use-hardware-scanner.ts"
import { useIsConfirmOpen } from "../../hooks/use-is-confirm-open.ts"
import { useScreenWakeLock } from "../../hooks/use-screen-wake-lock.ts"
import { useTerminalHomeMode } from "../../hooks/use-terminal-home-mode.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { maxWidth } from "../../theme/tokens.ts"
import { AmountKeypad } from "./amount-keypad.tsx"
import { PosOverviewPage } from "./pos-overview-page.tsx"

/**
 * On a wide window web's keypad page is the `max-w-xl` column itself, with
 * the screen's sides outside it.
 */
const keypadColumn = {
  width: "100%",
  maxWidth: maxWidth.xl + 2 * screenPaddingX,
  alignSelf: "center",
} as const

/**
 * The root screen, like web's `_terminal/` index: the keypad or the tables
 * grid, by the modes the account enables and the one this device last
 * chose, with a switch between them at the top left when both are enabled
 * (navigation/0004). An account without its appSettings row is not
 * onboarded and goes to onboarding (a restore runs its own sync screen
 * first, so no initial-sync wait is needed here).
 */
export function TerminalHomePage() {
  const theme = useTheme()
  const { t } = useTranslation()
  const [settings] = useEvoluQuery(settingsQuery).data
  const { mode, enabledModes, setMode } = useTerminalHomeMode()
  const showSwitch = enabledModes.length > 1
  // On a wide window the rail beside the screen holds the menu.
  const wide = useWindowDimensions().width >= menuSidebarMinWidth
  useScreenWakeLock(true)
  const confirmOpen = useIsConfirmOpen()
  // The hamburger stands for the menu, Notifications its tab, so it carries
  // their dot (a wide window shows it on the rail's tab instead).
  const unread = useActiveNotifications().length > 0
  // A scan starts a new bill without a table; the bill then adds the item
  // as if it had been scanned there (scanner/0001).
  useHardwareScanner({
    enabled: settings !== undefined && !confirmOpen,
    onScan: (code) =>
      router.push({
        pathname: "/bill",
        params: { billId: createRandomBillId(), scan: code },
      }),
  })

  if (settings === undefined) return <NotOnboarded />

  return (
    <SafeAreaView
      style={[
        {
          flex: 1,
          paddingVertical: 16,
          paddingHorizontal: screenPaddingX,
          backgroundColor: theme.background.val,
        },
        // The keypad keeps web's column; the grid takes the width.
        Platform.OS === "web" && mode === "numpad" ? keypadColumn : null,
      ]}
    >
      {/* Web's header and keypad add `px-4` to the screen's sides. The mode
          switch sits at the start; the hamburger opens the menu on its first
          tab (navigation/0001) and carries the notifications' dot, and a
          wide window has the rail instead, so a header with neither goes
          away. */}
      {wide && !showSwitch ? null : (
        <XStack
          items="center"
          justify="space-between"
          gap={12}
          mb={12}
          px={16}
          minH={44}
        >
          {showSwitch ? (
            <HomeModeSwitch mode={mode} onChange={setMode} />
          ) : (
            <View />
          )}
          {wide ? null : (
            <Button
              variant="ghost"
              aria-label={t(unread ? "nav.notificationsUnread" : "nav.menu")}
              onPress={() => router.push("/activity")}
            >
              <View>
                <Icon icon={Menu} size={24} strokeWidth={3} />
                {unread ? <NotificationDot /> : null}
              </View>
            </Button>
          )}
        </XStack>
      )}
      {mode === "numpad" ? (
        <YStack flex={1} px={16}>
          <AmountKeypad
            currency={getFiatCurrency(settings)}
            tipsEnabled={settings.tipsEnabled === sqliteTrue}
          />
        </YStack>
      ) : (
        <Suspense fallback={<LoadingView />}>
          <PosOverviewPage />
        </Suspense>
      )}
    </SafeAreaView>
  )
}

/**
 * Web's home-mode toggle in its header: both modes named, the active one on
 * the kit's sliding pill. Shown only while both are enabled.
 */
function HomeModeSwitch({
  mode,
  onChange,
}: {
  readonly mode: TerminalHomeMode
  readonly onChange: (mode: TerminalHomeMode) => void
}) {
  const { t } = useTranslation()
  return (
    <Tabs value={mode} onValueChange={onChange}>
      <TabsList w={240}>
        {terminalHomeModes.map((option) => (
          <TabsTrigger
            key={option}
            value={option}
            aria-label={t(homeModeLabelKeys[option])}
          >
            {t(homeModeLabelKeys[option])}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

/**
 * As web's `NotOnboarded`: a missing appSettings row means nothing while the
 * account's first sync is still transferring (a paired or restored account
 * reopened mid-sync), so this waits for that before sending the account to
 * onboarding, where finishing would overwrite the synced settings. An
 * account that does not sync (no transports, or a demo) never registers its
 * owner, so it goes straight on; one that does gets
 * `initialSyncIdleLimitMs` for the owner to be reported.
 */
function NotOnboarded() {
  const { t } = useTranslation()
  const theme = useTheme()
  const account = useAtomValue(accountAtom)
  const evolu = useAtomValue(evoluAtom)
  const { syncState } = nativeRun.deps
  const state = useSyncExternalStore(syncState.subscribe, syncState.get)
  const relays = findOwnerRelays(state, evolu.name, evolu.appOwner.id)
  const syncs = account.demo === null && account.transports.length > 0
  const ownerUnknown = syncs && relays === null
  const [ownerTimedOut, setOwnerTimedOut] = useState(false)
  useEffect(() => {
    if (!ownerUnknown) return
    const id = setTimeout(() => setOwnerTimedOut(true), initialSyncIdleLimitMs)
    return () => clearTimeout(id)
  }, [ownerUnknown])
  const waitingForSync =
    syncs && (relays === null ? !ownerTimedOut : isInitialSyncPending(relays))

  if (!waitingForSync) return <Redirect href="/onboarding" />
  return (
    <View flex={1} items="center" justify="center" bg="background">
      <ActivityIndicator
        size="large"
        color={theme["muted-foreground"]?.val}
        aria-label={t("accountRestore.syncing")}
      />
    </View>
  )
}
