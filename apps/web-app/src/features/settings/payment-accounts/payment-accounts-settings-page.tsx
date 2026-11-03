import { Capacitor } from "@capacitor/core"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  saveCardSwitchioAccount,
  saveCashRegisterAccount,
  saveCashuAccount,
  saveFiatBankAccount,
  saveLightningAddressAccount,
  saveQerkoTerminalAccount,
  saveSparkAccount,
} from "@payky/core/modules/account/account-actions"
import {
  cardSwitchioAccountQuery,
  cashRegisterAccountQuery,
  cashuAccountQuery,
  fiatBankAccountQuery,
  lightningAddressAccountQuery,
  qerkoTerminalAccountQuery,
  sparkAccountQuery,
} from "@payky/core/modules/account/account-queries"
import { setPaymentMethodOrder } from "@payky/core/modules/app-settings/app-settings-actions"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import type { DefaultPaymentMethod } from "@payky/core/modules/app-settings/app-settings-types"
import {
  getFiatCurrency,
  getPaymentMethodOrder,
} from "@payky/core/modules/app-settings/app-settings-utils"
import { qerkoPluginQuery } from "@payky/core/modules/qerko-plugin/qerko-plugin-queries"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import { useQuery } from "@tanstack/react-query"
import { Link, type LinkProps } from "@tanstack/react-router"
import {
  AtSignIcon,
  BanknoteIcon,
  ChevronRight,
  CoinsIcon,
  CreditCardIcon,
  GripVerticalIcon,
  LandmarkIcon,
  type LucideIcon,
  NfcIcon,
  ZapIcon,
} from "lucide-react"
import { Reorder, useDragControls, useReducedMotion } from "motion/react"
import { useRef, useState } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import { verticalNavShellClassName } from "@/components/vertical-nav.tsx"
import { InlineEditSwitch } from "@/features/shared/forms/inline-edit-switch.tsx"
import { useAppRun, useCashuAppRun } from "@/hooks/use-app-run.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "@/hooks/use-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { cn } from "@/lib/utils.ts"
import { isSwitchioInstalled } from "@/platform/switchio.ts"

interface PaymentMethodRowState {
  readonly icon: LucideIcon
  readonly title: TranslationKey
  readonly switchLabel: TranslationKey
  readonly enabled: boolean
  /** Enabled and offered on the payment screen for the app's currency. */
  readonly available: boolean
  readonly canEnable: boolean
  readonly status: string | null
  readonly to: LinkProps["to"] | null
  readonly saveEnabled: (enabled: boolean) => Promise<void>
  /** Still being proven: marked so the merchant knows before turning it on. */
  readonly experimental?: true
}

/**
 * The payment methods in the order customers see them. There is no separate
 * default: the first available one is the tab the payment screen opens on.
 * The merchant reorders them by dragging a row's grip (motion's `Reorder`),
 * or with the arrow keys on the focused grip.
 */
const paymentAccountsPageQueries = [
  settingsQuery,
  fiatBankAccountQuery,
  sparkAccountQuery,
  cashRegisterAccountQuery,
  cardSwitchioAccountQuery,
  qerkoTerminalAccountQuery,
  qerkoPluginQuery,
  cashuAccountQuery,
  lightningAddressAccountQuery,
]

export function PaymentAccountsSettingsPage() {
  usePreloadEvoluQueries(paymentAccountsPageQueries)
  const appRun = useAppRun()
  const cashuAppRun = useCashuAppRun()
  const runToast = useRunToast()
  const { t } = useTranslation()
  const { data: settingsData } = useEvoluQuery(settingsQuery)
  const { data: bankData } = useEvoluQuery(fiatBankAccountQuery)
  const { data: sparkData } = useEvoluQuery(sparkAccountQuery)
  const { data: cashData } = useEvoluQuery(cashRegisterAccountQuery)
  const { data: cardData } = useEvoluQuery(cardSwitchioAccountQuery)
  const { data: qerkoData } = useEvoluQuery(qerkoTerminalAccountQuery)
  const { data: qerkoPluginData } = useEvoluQuery(qerkoPluginQuery)
  const { data: cashuData } = useEvoluQuery(cashuAccountQuery)
  const { data: lightningAddressData } = useEvoluQuery(
    lightningAddressAccountQuery
  )
  const [settings] = settingsData
  const [bank] = bankData
  const [spark] = sparkData
  const [cash] = cashData
  const [card] = cardData
  const [qerko] = qerkoData
  const [cashu] = cashuData
  const [lightningAddress] = lightningAddressData

  const appCurrency = getFiatCurrency(settings)
  const bankEnabled = bank !== undefined && bank.isDeleted !== 1
  const sparkEnabled = spark !== undefined && spark.isDeleted !== 1
  const cashEnabled = cash !== undefined && cash.isDeleted !== 1
  const cardEnabled = card !== undefined && card.isDeleted !== 1
  const qerkoEnabled = qerko !== undefined && qerko.isDeleted !== 1
  const qerkoPaired = qerkoPluginData.length > 0
  const cashuEnabled = cashu !== undefined && cashu.isDeleted !== 1
  const lightningAddressEnabled =
    lightningAddress !== undefined && lightningAddress.isDeleted !== 1
  // The SwitchioPay terminal is driven through Android intents, so only the
  // native app can offer it. The account is plain synced data, though, so it
  // stays configurable here for the devices that can.
  const isNativeRuntime = Capacitor.isNativePlatform()
  const switchioInstalledQuery = useQuery({
    queryKey: ["native", "switchio-installed"],
    queryFn: isSwitchioInstalled,
    enabled: isNativeRuntime,
  })

  const currencyMismatch = (currency: FiatCurrency | undefined) =>
    currency === undefined || currency === appCurrency
      ? null
      : t("settings.paymentAccounts.status.currencyMismatch", {
          currency,
          appCurrency,
        })

  const rows = {
    iban: {
      icon: LandmarkIcon,
      title: "settings.paymentAccounts.method.iban",
      switchLabel: "settings.fiatBankAccount.enabled.label",
      enabled: bankEnabled,
      available: bankEnabled && bank.currency === appCurrency,
      // An account row only exists once an IBAN was entered, and enabling
      // without one would offer bank transfer with nowhere to send it.
      canEnable: bank !== undefined,
      status:
        bank === undefined
          ? t("settings.paymentAccounts.status.missingIban")
          : bankEnabled
            ? currencyMismatch(bank.currency)
            : null,
      to: "/settings/payment-accounts/iban",
      saveEnabled: async (enabled) => {
        if (bank === undefined) return
        await using run = appRun()
        await run.ok(
          saveFiatBankAccount({
            enabled,
            iban: bank.iban,
            currency: bank.currency,
            defaultQrFormat: bank.defaultQrFormat ?? "spayd",
          })
        )
      },
    },
    spark: {
      icon: ZapIcon,
      title: "settings.paymentAccounts.method.spark",
      switchLabel: "settings.sparkAccount.enabled.label",
      enabled: sparkEnabled,
      available: sparkEnabled,
      canEnable: true,
      status: null,
      // Before the first enable there is no wallet yet to show or change.
      to: spark === undefined ? null : "/settings/payment-accounts/spark",
      saveEnabled: async (enabled) => {
        await using run = appRun()
        await run.ok(saveSparkAccount({ enabled }))
      },
    },
    cashRegister: {
      icon: BanknoteIcon,
      title: "settings.paymentAccounts.method.cashRegister",
      switchLabel: "settings.cashRegisterAccount.enabled.label",
      enabled: cashEnabled,
      available: cashEnabled && cash.currency === appCurrency,
      canEnable: true,
      status: cashEnabled ? currencyMismatch(cash.currency) : null,
      to: null,
      saveEnabled: async (enabled) => {
        await using run = appRun()
        await run.ok(
          saveCashRegisterAccount({ enabled, currency: appCurrency })
        )
      },
    },
    cardSwitchio: {
      icon: CreditCardIcon,
      title: "settings.paymentAccounts.method.cardSwitchio",
      switchLabel: "settings.cardSwitchioAccount.enabled.label",
      enabled: cardEnabled,
      available:
        isNativeRuntime && cardEnabled && card.currency === appCurrency,
      canEnable: true,
      status: !isNativeRuntime
        ? t("settings.cardSwitchioAccount.nativeRuntimeWarning")
        : switchioInstalledQuery.data === false
          ? t("settings.cardSwitchioAccount.notInstalledWarning")
          : cardEnabled
            ? currencyMismatch(card.currency)
            : null,
      to: "/settings/payment-accounts/card-switchio",
      saveEnabled: async (enabled) => {
        await using run = appRun()
        await run.ok(
          saveCardSwitchioAccount({ enabled, currency: appCurrency })
        )
      },
    },
    qerkoTerminal: {
      icon: NfcIcon,
      title: "settings.paymentAccounts.method.qerkoTerminal",
      switchLabel: "settings.qerkoTerminal.enabled.label",
      enabled: qerkoEnabled,
      available: qerkoPaired && qerkoEnabled && qerko.currency === appCurrency,
      // Without a pairing there is no key to start a payment with.
      canEnable: qerkoPaired,
      status: !qerkoPaired
        ? t("settings.qerkoTerminal.status.notPaired")
        : qerkoEnabled
          ? currencyMismatch(qerko.currency)
          : null,
      to: "/settings/payment-accounts/qerko-terminal",
      saveEnabled: async (enabled) => {
        await using run = appRun()
        await run.ok(
          saveQerkoTerminalAccount({ enabled, currency: appCurrency })
        )
      },
    },
    cashu: {
      icon: CoinsIcon,
      title: "settings.paymentAccounts.method.cashu",
      switchLabel: "settings.cashuAccount.enabled.label",
      enabled: cashuEnabled,
      available: cashuEnabled,
      canEnable: true,
      status: null,
      to: cashu === undefined ? null : "/settings/payment-accounts/cashu",
      experimental: true,
      saveEnabled: async (enabled) => {
        await using run = await cashuAppRun()
        await run.ok(saveCashuAccount({ enabled }))
      },
    },
    lightningAddress: {
      icon: AtSignIcon,
      title: "settings.paymentAccounts.method.lightningAddress",
      switchLabel: "settings.lightningAddress.enabled.label",
      enabled: lightningAddressEnabled,
      available: lightningAddressEnabled,
      // Enabling without an address would offer a method with nowhere to
      // ask for an invoice; the address is entered on its own page.
      canEnable: lightningAddress !== undefined,
      status:
        lightningAddress === undefined
          ? t("settings.paymentAccounts.status.missingLightningAddress")
          : lightningAddress.address,
      to: "/settings/payment-accounts/lightning-address",
      saveEnabled: async (enabled) => {
        await using run = appRun()
        await run.ok(saveLightningAddressAccount({ enabled }))
      },
    },
  } satisfies Record<DefaultPaymentMethod, PaymentMethodRowState>

  const order = getPaymentMethodOrder(settings)
  const orderKey = order.join(" ")
  // The order a drag is drawing, shown until the store catches up (its key
  // then differs) or the save fails. Keyed to the stored order it departs
  // from, and dropped as soon as that changes, so a stale draft never wins.
  const [draft, setDraft] = useState<{
    readonly key: string
    readonly order: ReadonlyArray<DefaultPaymentMethod>
  } | null>(null)
  if (draft !== null && draft.key !== orderKey) setDraft(null)
  // What the drag has reordered so far, for the release, which may come
  // before the draft's render.
  const dragged = useRef<ReadonlyArray<DefaultPaymentMethod> | null>(null)
  const shownOrder =
    draft !== null && draft.key === orderKey ? draft.order : order
  const firstAvailable = shownOrder.find((method) => rows[method].available)

  const store = (nextOrder: ReadonlyArray<DefaultPaymentMethod>) =>
    runToast(async (run) => {
      await run.ok(setPaymentMethodOrder(nextOrder))
    })

  const move = (method: DefaultPaymentMethod, offset: -1 | 1) => {
    const index = order.indexOf(method)
    const neighbour = order[index + offset]
    if (index === -1 || neighbour === undefined) return

    void store(order.with(index, neighbour).with(index + offset, method))
  }

  const reorder = (next: ReadonlyArray<DefaultPaymentMethod>) => {
    dragged.current = next
    setDraft({ key: orderKey, order: next })
  }

  const endDrag = () => {
    const next = dragged.current
    dragged.current = null
    if (next === null) return
    if (next.join(" ") === orderKey) {
      setDraft(null)
      return
    }
    void store(next).then((stored) => {
      if (!stored) setDraft(null)
    })
  }

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.paymentAccounts.title")} />
      <div className="flex flex-col gap-3">
        <p className="px-1 text-sm text-muted-foreground">
          {t("settings.paymentAccounts.order.description")}
        </p>
        <Reorder.Group
          as="ul"
          axis="y"
          values={[...shownOrder]}
          onReorder={reorder}
          className={cn(verticalNavShellClassName, "divide-y")}
        >
          {shownOrder.map((method) => (
            <PaymentMethodRow
              key={method}
              method={method}
              row={rows[method]}
              isDefault={method === firstAvailable}
              onMove={(offset) => move(method, offset)}
              onDragEnd={endDrag}
            />
          ))}
        </Reorder.Group>
      </div>
    </>
  )
}

function PaymentMethodRow({
  method,
  row,
  isDefault,
  onMove,
  onDragEnd,
}: {
  readonly method: DefaultPaymentMethod
  readonly row: PaymentMethodRowState
  readonly isDefault: boolean
  /** The keyboard's move, one place up or down. */
  readonly onMove: (offset: -1 | 1) => void
  readonly onDragEnd: () => void
}) {
  const { t } = useTranslation()
  const name = t(row.title)
  const Icon = row.icon
  // Only the grip starts a drag, so the row's link and switch keep working.
  const dragControls = useDragControls()
  const reducedMotion = useReducedMotion() ?? false

  const content = (
    <>
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "flex items-center gap-2 font-medium",
            !row.enabled && "text-muted-foreground"
          )}
        >
          {name}
          {isDefault && (
            <Badge variant="secondary">
              {t("settings.paymentAccounts.default")}
            </Badge>
          )}
          {row.experimental && (
            <Badge className="bg-warning/10 text-warning">
              {t("settings.paymentAccounts.experimental")}
            </Badge>
          )}
        </span>
        {row.status !== null && (
          <span className="text-xs text-muted-foreground">{row.status}</span>
        )}
      </span>
    </>
  )

  return (
    <Reorder.Item
      as="li"
      value={method}
      dragListener={false}
      dragControls={dragControls}
      layout="position"
      transition={reducedMotion ? { duration: 0 } : undefined}
      onDragEnd={onDragEnd}
      className="flex items-center gap-2 bg-card py-1 pr-3 pl-1 text-sm"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="shrink-0 cursor-grab touch-none active:cursor-grabbing"
        aria-label={t("settings.paymentAccounts.reorder.aria", { name })}
        aria-keyshortcuts="ArrowUp ArrowDown"
        onPointerDown={(event) => dragControls.start(event)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
          event.preventDefault()
          onMove(event.key === "ArrowUp" ? -1 : 1)
        }}
      >
        <GripVerticalIcon className="size-5" />
      </Button>
      {row.to === null ? (
        <span className="flex min-w-0 flex-1 items-center gap-3 py-2">
          {content}
        </span>
      ) : (
        <Link
          to={row.to}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
          <ChevronRight className="size-4 shrink-0" />
        </Link>
      )}
      <span className="shrink-0">
        <InlineEditSwitch
          label={t(row.switchLabel)}
          defaultValue={row.enabled}
          disabled={!row.canEnable}
          showText={false}
          showSaved={false}
          onSave={row.saveEnabled}
        />
      </span>
    </Reorder.Item>
  )
}
