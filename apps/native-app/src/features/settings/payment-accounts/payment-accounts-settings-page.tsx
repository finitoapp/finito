import {
  expandPaymentMethodOrder,
  groupPaymentMethodOrder,
  movePaymentMethodGroup,
  type PaymentMethodGroup,
} from "@payky/app-shared/bitcoin-payment-method"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  saveCardSwitchioAccount,
  saveCashRegisterAccount,
  saveFiatBankAccount,
  saveQerkoPaymentAccount,
  saveQerkoTerminalAccount,
} from "@payky/core/modules/account/account-actions"
import {
  cardSwitchioAccountQuery,
  cashRegisterAccountQuery,
  fiatBankAccountQuery,
  qerkoPaymentAccountQuery,
  qerkoTerminalAccountQuery,
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
import { router } from "expo-router"
import type { LucideIcon } from "lucide-react-native"
import Banknote from "lucide-react-native/icons/banknote"
import Bitcoin from "lucide-react-native/icons/bitcoin"
import ChevronRight from "lucide-react-native/icons/chevron-right"
import CreditCard from "lucide-react-native/icons/credit-card"
import GripVertical from "lucide-react-native/icons/grip-vertical"
import Landmark from "lucide-react-native/icons/landmark"
import Nfc from "lucide-react-native/icons/nfc"
import { useEffect, useRef, useState } from "react"
import {
  type AccessibilityActionEvent,
  Animated,
  Easing,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  type ViewStyle,
} from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { animateTo } from "../../../components/motion.ts"
import { QerkoIcon } from "../../../components/qerko-icon.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Badge } from "../../../components/ui/badge.tsx"
import { Icon } from "../../../components/ui/icon.tsx"
import { Switch } from "../../../components/ui/switch.tsx"
import { VerticalNavShell } from "../../../components/vertical-nav.tsx"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { hapticButtonPress } from "../../../platform/haptics.ts"
import {
  isSwitchioInstalled,
  isSwitchioSupported,
} from "../../../platform/switchio.ts"
import { control, fontSize, fontWeight } from "../../../theme/tokens.ts"
import {
  bitcoinWalletQueries,
  useBitcoinWallet,
  walletLabelKeys,
} from "./use-bitcoin-wallet.ts"

interface PaymentMethodRowState {
  readonly icon: LucideIcon
  readonly title: TranslationKey
  readonly switchLabel: TranslationKey
  readonly enabled: boolean
  /** Enabled and offered on the payment screen for the app's currency. */
  readonly available: boolean
  readonly canEnable: boolean
  readonly status: string | null
  readonly href: string | null
  /**
   * Resolves `true` once stored; `null` for a method this app cannot set up
   * yet, which gets no switch rather than one that does nothing.
   */
  readonly saveEnabled: ((enabled: boolean) => Promise<boolean>) | null
}

const paymentAccountsPageQueries = [
  settingsQuery,
  fiatBankAccountQuery,
  cashRegisterAccountQuery,
  cardSwitchioAccountQuery,
  qerkoTerminalAccountQuery,
  qerkoPluginQuery("terminalPayments"),
  qerkoPaymentAccountQuery,
  qerkoPluginQuery("standard"),
  ...bitcoinWalletQueries,
]

/** How long the other rows take to make room for the dragged one. */
const shiftTiming = { duration: 150, easing: Easing.out(Easing.quad) }

/**
 * In the PWA a touch that starts on the grip must drag, not scroll the
 * screen: a native scroll under the responder would end it (RNW's responder
 * system). React Native Web draws any CSS property it is given; React
 * Native's types know no `touchAction`.
 */
const gripTouch = { touchAction: "none" } as unknown as ViewStyle

/**
 * The rows' part of a drag: each row's measured height and its vertical
 * offset, an `Animated.Value` on the native driver. The dragged row follows
 * the finger; the rows it passes shift by its height to make room.
 */
interface RowDrag {
  readonly offset: Animated.Value
  readonly isDragging: boolean
  readonly onLayout: (event: LayoutChangeEvent) => void
  readonly onStart: () => void
  readonly onMove: (dy: number) => void
  readonly onEnd: () => void
}

/**
 * The payment methods in the order customers see them, as web's
 * `PaymentAccountsSettingsPage`, with the three bitcoin wallets as one
 * "Bitcoin" row (settings/0002). There is no separate default: the first
 * available one is the tab the payment screen opens on. The merchant
 * reorders them by dragging a row's grip, as on web; TalkBack gets the move
 * actions instead.
 */
export function PaymentAccountsSettingsPage() {
  usePreloadEvoluQueries(paymentAccountsPageQueries)
  const runToast = useRunToast()
  const { t } = useTranslation()
  const [settings] = useEvoluQuery(settingsQuery).data
  const [bank] = useEvoluQuery(fiatBankAccountQuery).data
  const [cash] = useEvoluQuery(cashRegisterAccountQuery).data
  const [card] = useEvoluQuery(cardSwitchioAccountQuery).data
  const [qerko] = useEvoluQuery(qerkoTerminalAccountQuery).data
  const qerkoPaired =
    useEvoluQuery(qerkoPluginQuery("terminalPayments")).data.length > 0
  const [qerkoPayment] = useEvoluQuery(qerkoPaymentAccountQuery).data
  const [qerkoPaymentPlugin] = useEvoluQuery(qerkoPluginQuery("standard")).data
  const qerkoPaymentPaired = qerkoPaymentPlugin !== undefined
  // Paired but without a location yet, Qerko refuses the key (qerko/0007).
  const qerkoPaymentReady =
    qerkoPaymentPlugin !== undefined && qerkoPaymentPlugin.restaurantId !== null
  const bitcoin = useBitcoinWallet()

  const appCurrency = getFiatCurrency(settings)
  const bankEnabled = bank !== undefined && bank.isDeleted !== 1
  const cashEnabled = cash !== undefined && cash.isDeleted !== 1
  const cardEnabled = card !== undefined && card.isDeleted !== 1
  const qerkoEnabled = qerko !== undefined && qerko.isDeleted !== 1
  const qerkoPaymentEnabled =
    qerkoPayment !== undefined && qerkoPayment.isDeleted !== 1

  const currencyMismatch = (currency: FiatCurrency | undefined) =>
    currency === undefined || currency === appCurrency
      ? null
      : t("settings.paymentAccounts.status.currencyMismatch", {
          currency,
          appCurrency,
        })

  const rows = {
    iban: {
      icon: Landmark,
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
      href: "/settings/payment-accounts/iban",
      saveEnabled: (enabled) =>
        runToast(async (run) => {
          if (bank === undefined) return
          await run.ok(
            saveFiatBankAccount({
              enabled,
              iban: bank.iban,
              currency: bank.currency,
              defaultQrFormat: bank.defaultQrFormat ?? "spayd",
            })
          )
        }),
    },
    bitcoin: {
      icon: Bitcoin,
      title: "settings.paymentAccounts.method.bitcoin",
      switchLabel: "settings.bitcoin.enabled.label",
      enabled: bitcoin.enabled !== undefined,
      available: bitcoin.enabled !== undefined,
      canEnable: true,
      // The main wallet by name, or the Lightning address itself (settings/0003).
      status:
        bitcoin.enabled === undefined
          ? null
          : bitcoin.enabled === "lightningAddress"
            ? (bitcoin.lightningAddress ?? null)
            : t(walletLabelKeys[bitcoin.enabled]),
      href: "/settings/payment-accounts/bitcoin",
      saveEnabled: (enabled) =>
        enabled ? bitcoin.enable() : bitcoin.select(null),
    },
    cashRegister: {
      icon: Banknote,
      title: "settings.paymentAccounts.method.cashRegister",
      switchLabel: "settings.cashRegisterAccount.enabled.label",
      enabled: cashEnabled,
      available: cashEnabled && cash.currency === appCurrency,
      canEnable: true,
      status: cashEnabled ? currencyMismatch(cash.currency) : null,
      href: null,
      saveEnabled: (enabled) =>
        runToast(async (run) => {
          await run.ok(
            saveCashRegisterAccount({ enabled, currency: appCurrency })
          )
        }),
    },
    cardSwitchio: {
      icon: CreditCard,
      title: "settings.paymentAccounts.method.cardSwitchio",
      switchLabel: "settings.cardSwitchioAccount.enabled.label",
      enabled: cardEnabled,
      // The terminal is driven through Android intents, which needs the
      // module: in the PWA the row stays, disabled, saying so.
      available:
        isSwitchioSupported() && cardEnabled && card.currency === appCurrency,
      canEnable: isSwitchioSupported(),
      status: !isSwitchioSupported()
        ? t("settings.paymentAccounts.status.nativeOnly")
        : !isSwitchioInstalled()
          ? t("settings.cardSwitchioAccount.notInstalledWarning")
          : cardEnabled
            ? currencyMismatch(card.currency)
            : null,
      href: "/settings/payment-accounts/card-switchio",
      saveEnabled: (enabled) =>
        runToast(async (run) => {
          await run.ok(
            saveCardSwitchioAccount({ enabled, currency: appCurrency })
          )
        }),
    },
    qerkoTerminal: {
      icon: Nfc,
      title: "settings.paymentAccounts.method.qerkoTerminal",
      switchLabel: "settings.qerkoTerminal.enabled.label",
      enabled: qerkoEnabled,
      available: qerkoPaired && qerkoEnabled && qerko.currency === appCurrency,
      // Without a pairing there is no key to start a payment with: the
      // switch waits, and the row's screen is where the pairing happens.
      canEnable: qerkoPaired,
      status: qerkoEnabled ? currencyMismatch(qerko.currency) : null,
      href: "/settings/payment-accounts/qerko-terminal",
      saveEnabled: (enabled) =>
        runToast(async (run) => {
          await run.ok(
            saveQerkoTerminalAccount({ enabled, currency: appCurrency })
          )
        }),
    },
    qerkoPayment: {
      icon: QerkoIcon,
      title: "settings.paymentAccounts.method.qerkoPayment",
      switchLabel: "settings.qerkoPayment.enabled.label",
      enabled: qerkoPaymentEnabled,
      available:
        qerkoPaymentReady &&
        qerkoPaymentEnabled &&
        qerkoPayment.currency === appCurrency,
      // Without a location there is no restaurant for the QR code to name.
      canEnable: qerkoPaymentReady,
      status: !qerkoPaymentPaired
        ? t("settings.qerkoPayment.status.notPaired")
        : !qerkoPaymentReady
          ? t("settings.qerkoPayment.location.none")
          : qerkoPaymentEnabled
            ? (currencyMismatch(qerkoPayment.currency) ??
              (qerkoPayment.connectionDeviceId === null
                ? t("settings.qerkoPayment.status.noDevice")
                : null))
            : null,
      href: "/settings/payment-accounts/qerko-payment",
      saveEnabled: (enabled) =>
        runToast(async (run) => {
          await run.ok(
            saveQerkoPaymentAccount({ enabled, currency: appCurrency })
          )
        }),
    },
  } satisfies Record<PaymentMethodGroup, PaymentMethodRowState>

  // The stored order lists every wallet; the rows show the three as one.
  const storedOrder = getPaymentMethodOrder(settings)
  const order = groupPaymentMethodOrder(storedOrder)
  const orderKey = order.join(" ")
  // The order a drag ended on, shown until the store catches up (its key
  // then differs) or the save fails. Keyed to the stored order it departs
  // from, and dropped as soon as that changes, so a stale draft never wins.
  const [draft, setDraft] = useState<{
    readonly key: string
    readonly order: ReadonlyArray<PaymentMethodGroup>
  } | null>(null)
  if (draft !== null && draft.key !== orderKey) setDraft(null)
  const shownOrder =
    draft !== null && draft.key === orderKey ? draft.order : order
  const firstAvailable = shownOrder.find((method) => rows[method].available)

  const storeExpanded = (nextOrder: ReadonlyArray<DefaultPaymentMethod>) =>
    runToast(async (run) => {
      await run.ok(setPaymentMethodOrder(nextOrder))
    })
  const store = (nextOrder: ReadonlyArray<PaymentMethodGroup>) =>
    storeExpanded(expandPaymentMethodOrder(nextOrder, storedOrder))

  const move = (method: PaymentMethodGroup, offset: -1 | 1) => {
    const moved = movePaymentMethodGroup(
      storedOrder,
      order.indexOf(method),
      offset
    )
    if (moved !== undefined) void storeExpanded(moved)
  }

  const [rowHeights] = useState(() => new Map<PaymentMethodGroup, number>())
  const [rowOffsets] = useState(
    () => new Map<PaymentMethodGroup, Animated.Value>()
  )
  const offsetOf = (method: PaymentMethodGroup) => {
    const known = rowOffsets.get(method)
    if (known !== undefined) return known
    const offset = new Animated.Value(0)
    rowOffsets.set(method, offset)
    return offset
  }
  const [dragging, setDragging] = useState<PaymentMethodGroup | null>(null)
  // The drag in flight: where its row started and where it would land now.
  const drag = useRef<{
    readonly method: PaymentMethodGroup
    readonly from: number
    to: number
  } | null>(null)

  const shiftTo = (offset: Animated.Value, value: number) =>
    animateTo(offset, value, shiftTiming)

  /** The index the dragged row lands on after moving `dy`: a neighbour is passed once the finger crosses half of it. */
  const landingIndex = (from: number, dy: number) => {
    const step = dy < 0 ? -1 : 1
    let index = from
    let remaining = Math.abs(dy)
    let neighbour = shownOrder[index + step]
    while (neighbour !== undefined) {
      const height = rowHeights.get(neighbour) ?? 0
      if (remaining < height / 2) break
      remaining -= height
      index += step
      neighbour = shownOrder[index + step]
    }
    return index
  }

  const rowDrag = (method: PaymentMethodGroup): RowDrag => ({
    offset: offsetOf(method),
    isDragging: dragging === method,
    onLayout: (event) => {
      rowHeights.set(method, event.nativeEvent.layout.height)
    },
    onStart: () => {
      const from = shownOrder.indexOf(method)
      drag.current = { method, from, to: from }
      setDragging(method)
      hapticButtonPress()
    },
    onMove: (dy) => {
      const current = drag.current
      if (current === null || current.method !== method) return
      offsetOf(method).setValue(dy)
      const to = landingIndex(current.from, dy)
      if (to === current.to) return
      current.to = to
      const height = rowHeights.get(method) ?? 0
      shownOrder.forEach((other, index) => {
        if (other === method) return
        const passed =
          to < current.from
            ? index >= to && index < current.from
            : index > current.from && index <= to
        shiftTo(
          offsetOf(other),
          passed ? (to < current.from ? height : -height) : 0
        )
      })
    },
    onEnd: () => {
      const current = drag.current
      if (current === null || current.method !== method) return
      drag.current = null
      setDragging(null)
      for (const offset of rowOffsets.values()) offset.setValue(0)
      if (current.to === current.from) return
      const next = shownOrder.filter((other) => other !== method)
      next.splice(current.to, 0, method)
      setDraft({ key: orderKey, order: next })
      void store(next).then((stored) => {
        if (!stored) setDraft(null)
      })
    },
  })

  return (
    <Screen>
      <FadeHeader title={t("settings.paymentAccounts.title")} />
      <YStack gap={12}>
        <Text
          px={4}
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
        >
          {t("settings.paymentAccounts.order.description")}
        </Text>
        <VerticalNavShell>
          {shownOrder.map((method) => (
            <PaymentMethodRow
              key={method}
              row={rows[method]}
              isDefault={method === firstAvailable}
              drag={rowDrag(method)}
              onMove={(offset) => move(method, offset)}
            />
          ))}
        </VerticalNavShell>
      </YStack>
    </Screen>
  )
}

function PaymentMethodRow({
  row,
  isDefault,
  drag,
  onMove,
}: {
  readonly row: PaymentMethodRowState
  readonly isDefault: boolean
  readonly drag: RowDrag
  /** TalkBack's move, one place up or down. */
  readonly onMove: (offset: -1 | 1) => void
}) {
  const { t } = useTranslation()
  const name = t(row.title)
  const choice = useInlineChoice(
    row.enabled,
    row.saveEnabled ?? (async () => false)
  )
  const { href } = row

  return (
    <Animated.View
      onLayout={drag.onLayout}
      style={{
        transform: [{ translateY: drag.offset }],
        zIndex: drag.isDragging ? 1 : 0,
      }}
    >
      <XStack
        items="center"
        gap={8}
        py={4}
        pl={4}
        pr={12}
        bg={drag.isDragging ? "neutral-soft" : "transparent"}
      >
        <DragHandle
          label={t("settings.paymentAccounts.reorder.aria", { name })}
          moveUpLabel={t("settings.paymentAccounts.moveUp.aria", { name })}
          moveDownLabel={t("settings.paymentAccounts.moveDown.aria", { name })}
          drag={drag}
          onMove={onMove}
        />
        <Pressable
          role={href === null ? undefined : "button"}
          aria-label={name}
          disabled={href === null}
          style={{
            flex: 1,
            minHeight: 48,
            justifyContent: "center",
            opacity: row.canEnable ? 1 : 0.5,
          }}
          onPress={() => {
            if (href !== null) router.push(href)
          }}
        >
          {/* One line per row (fazole-ui-minimal-copy): the status sits
              beside the title in small type, never under it. */}
          <XStack items="center" gap={12} py={8}>
            <Icon icon={row.icon} color="muted-foreground" size={20} />
            <XStack flex={1} minW={0} items="center" gap={8}>
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                fontWeight={fontWeight.medium}
                flexShrink={0}
                color={row.enabled ? "color" : "muted-foreground"}
              >
                {name}
              </Text>
              {isDefault ? (
                <Badge
                  variant="secondary"
                  label={t("settings.paymentAccounts.default")}
                />
              ) : null}
              {row.status === null ? null : (
                <Text
                  fontSize={fontSize.xs}
                  lineHeight={fontSize.xs}
                  color="muted-foreground"
                  numberOfLines={1}
                  flexShrink={1}
                  minW={0}
                >
                  {row.status}
                </Text>
              )}
            </XStack>
            {href === null ? null : <Icon icon={ChevronRight} />}
          </XStack>
        </Pressable>
        {row.saveEnabled === null ? null : (
          <Switch
            aria-label={t(row.switchLabel)}
            checked={choice.value}
            disabled={!row.canEnable || choice.saving}
            onCheckedChange={(next) => {
              void choice.choose(next)
            }}
          />
        )}
      </XStack>
    </Animated.View>
  )
}

/**
 * The grip that drags its row, web's ghost icon Button with the grip icon:
 * a pan responder that takes the touch at once (so the screen's ScrollView
 * does not scroll instead) and keeps it. Its TalkBack actions move the row
 * one place, since a drag cannot be done by screen reader.
 */
function DragHandle({
  label,
  moveUpLabel,
  moveDownLabel,
  drag,
  onMove,
}: {
  readonly label: string
  readonly moveUpLabel: string
  readonly moveDownLabel: string
  readonly drag: RowDrag
  readonly onMove: (offset: -1 | 1) => void
}) {
  // The responder is created once, so its gesture state survives the
  // re-render a drag's start causes; it reads the latest callbacks here.
  const latest = useRef(drag)
  useEffect(() => {
    latest.current = drag
  })
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => latest.current.onStart(),
      onPanResponderMove: (_event, gesture) =>
        latest.current.onMove(gesture.dy),
      onPanResponderRelease: () => latest.current.onEnd(),
      onPanResponderTerminate: () => latest.current.onEnd(),
    })
  )
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") onMove(-1)
    if (event.nativeEvent.actionName === "decrement") onMove(1)
  }

  return (
    <Animated.View
      {...responder.panHandlers}
      accessible
      role="button"
      aria-label={label}
      accessibilityActions={[
        { name: "increment", label: moveUpLabel },
        { name: "decrement", label: moveDownLabel },
      ]}
      onAccessibilityAction={onAccessibilityAction}
      style={[
        {
          width: control.lg,
          height: control.lg,
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        },
        gripTouch,
      ]}
    >
      <Icon icon={GripVertical} color="muted-foreground" />
    </Animated.View>
  )
}
