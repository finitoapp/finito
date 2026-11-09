import { sqliteTrue } from "@evolu/common"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import { createRandomBillId } from "@payky/core/modules/bill/bill-types"
import type { Money } from "@payky/core/modules/shared/money"
import {
  FiatCurrencySchema,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { Link, useNavigate } from "@tanstack/react-router"
import { BellIcon, Calculator, LayoutGrid, MenuIcon } from "lucide-react"
import { LayoutGroup, motion } from "motion/react"
import { Suspense } from "react"
import { NotificationDot } from "@/components/notification-dot.tsx"
import {
  SlidingPillSegmentContent,
  slidingPillLayout,
  useSlidingPillTransition,
} from "@/components/sliding-pill.tsx"
import { Button } from "@/components/ui/button.tsx"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx"
import { PosOverviewPage } from "@/features/terminal-home/pos-overview-page.tsx"
import { TerminalPaymentKeypad } from "@/features/terminal-home/terminal-payment-keypad.tsx"
import { useActiveNotifications } from "@/hooks/use-active-notifications.ts"
import { useIsConfirmDialogOpen } from "@/hooks/use-confirm-dialog.ts"
import { useCreateTerminalPayment } from "@/hooks/use-create-terminal-payment.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useHardwareScanner } from "@/hooks/use-hardware-scanner.ts"
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock.ts"
import { useTerminalHomeMode } from "@/hooks/use-terminal-home-mode.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { homeModeLabelKeys } from "@/i18n/settings-labels.ts"
import { cn } from "@/lib/utils.ts"

const homeModeItems = [
  { mode: "numpad", icon: Calculator, label: homeModeLabelKeys.numpad },
  { mode: "pos", icon: LayoutGrid, label: homeModeLabelKeys.pos },
] as const

const Header = () => {
  const { t } = useTranslation()
  const {
    mode: terminalHomeMode,
    enabledModes,
    setMode: setTerminalHomeMode,
  } = useTerminalHomeMode()
  const transition = useSlidingPillTransition()
  const hasNotifications = useActiveNotifications().length > 0

  return (
    <header className="px-4 flex items-center justify-between">
      {/*
       * Both modes stay on screen so the control reads as a switch rather
       * than a mystery icon; only the active one spells out its label, which
       * keeps "Klávesnice" from crowding the header on a phone. The motion
       * is `sliding-pill.tsx`'s. With a single mode enabled in settings
       * there is nothing to switch to, so the control goes away entirely.
       */}
      {enabledModes.length > 1 && (
        <LayoutGroup>
          <ToggleGroup
            value={[terminalHomeMode]}
            onValueChange={(value) => {
              // Tapping the already-active segment would empty the group.
              const [nextMode] = value
              if (nextMode !== undefined) setTerminalHomeMode(nextMode)
            }}
            // Not 0: the vendored group squares off joined segments at spacing 0.
            spacing={0.5}
            render={<motion.div {...slidingPillLayout(transition)} />}
            className="border border-input p-1"
          >
            {homeModeItems.map(({ mode, icon: Icon, label }) => {
              const active = mode === terminalHomeMode
              return (
                <ToggleGroupItem
                  key={mode}
                  value={mode}
                  aria-label={t(label)}
                  render={<motion.button {...slidingPillLayout(transition)} />}
                  className="relative isolate h-9 min-w-9 gap-0 px-4 text-muted-foreground transition-colors duration-300 hover:bg-transparent aria-pressed:bg-transparent aria-pressed:text-background motion-reduce:transition-none"
                >
                  <SlidingPillSegmentContent
                    active={active}
                    pillId="home-mode-pill"
                    icon={<Icon className="size-4" strokeWidth={2.5} />}
                    label={t(label)}
                  />
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
        </LayoutGroup>
      )}
      {/*
       * Notifications ahead of the menu, which opens on its first tab
       * (navigation/0001). A dot on the bell says one is active
       * (navigation/0005); the menu carries none.
       */}
      <div className="ml-auto flex items-center gap-2">
        <Button
          nativeButton={false}
          variant={"ghost"}
          className="relative"
          render={
            <Link
              aria-label={t(
                hasNotifications
                  ? "nav.notificationsUnread"
                  : "nav.notifications"
              )}
              to="/notifications"
            />
          }
        >
          <BellIcon className={"size-6"} strokeWidth={3} />
          {hasNotifications && <NotificationDot />}
        </Button>
        <Button
          nativeButton={false}
          variant={"ghost"}
          render={<Link aria-label={t("nav.menu")} to="/activity" />}
        >
          <MenuIcon className={"size-6"} strokeWidth={3} />
        </Button>
      </div>
    </header>
  )
}

function TerminalPaymentKeypadLoader() {
  const navigate = useNavigate()
  const createTerminalPayment = useCreateTerminalPayment()
  const { data } = useEvoluQuery(settingsQuery)
  const [settings] = data

  const handleCharge = async (money: Money) => {
    const amount = NonNegativeInteger(money.value)
    const currency = FiatCurrencySchema.parse(money.currency)

    if (settings?.tipsEnabled === sqliteTrue) {
      await navigate({
        to: "/payment/tip",
        search: {
          amount,
          currency,
        },
      })
      return
    }

    await createTerminalPayment({
      amount,
      currency,
      tipAmount: NonNegativeInteger(0),
    })
  }

  return (
    <div className={"px-4 flex flex-1 flex-col justify-between"}>
      <div>&nbsp;</div>

      <TerminalPaymentKeypad
        currency={getFiatCurrency(settings)}
        onCharge={handleCharge}
      />
    </div>
  )
}

export function TerminalHomePage() {
  useScreenWakeLock(true)
  const navigate = useNavigate()
  const isConfirmDialogOpen = useIsConfirmDialogOpen()
  // A scan in either mode starts a new bill without a table; `BillPage`
  // then adds the item exactly as if it had been scanned there. The
  // scanner's capture-phase listener also keeps the code's closing Enter
  // from reaching the keypad as a charge.
  useHardwareScanner({
    enabled: !isConfirmDialogOpen,
    onScan: (code) =>
      void navigate({
        to: "/bill",
        search: { billId: createRandomBillId(), scan: code },
      }),
  })
  const { mode: terminalHomeMode } = useTerminalHomeMode()
  const isNumpadMode = terminalHomeMode !== "pos"

  return (
    <div
      className={cn(
        "flex flex-1 flex-col",
        // Only the pos grid uses a large monitor's width; the keypad keeps
        // the phone-sized column the route's viewport would otherwise give.
        isNumpadMode && "lg:mx-auto lg:w-full lg:max-w-xl"
      )}
    >
      <Header />

      <Suspense fallback={null}>
        {isNumpadMode ? <TerminalPaymentKeypadLoader /> : <PosOverviewPage />}
      </Suspense>
    </div>
  )
}
