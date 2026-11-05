import { sqliteTrue } from "@evolu/common"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  cardSwitchioAccountQuery,
  cashRegisterAccountQuery,
  fiatBankAccountQuery,
} from "@payky/core/modules/account/account-queries"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { eetSettingsQuery } from "@payky/core/modules/eet/eet-queries"
import type { Href } from "expo-router"
import type { LucideIcon } from "lucide-react-native"
import BadgeDollarSign from "lucide-react-native/icons/badge-dollar-sign"
import HeartHandshake from "lucide-react-native/icons/heart-handshake"
import House from "lucide-react-native/icons/house"
import Info from "lucide-react-native/icons/info"
import Landmark from "lucide-react-native/icons/landmark"
import Languages from "lucide-react-native/icons/languages"
import LifeBuoy from "lucide-react-native/icons/life-buoy"
import LockKeyhole from "lucide-react-native/icons/lock-keyhole"
import Percent from "lucide-react-native/icons/percent"
import ReceiptText from "lucide-react-native/icons/receipt-text"
import ShieldCheck from "lucide-react-native/icons/shield-check"
import Sparkles from "lucide-react-native/icons/sparkles"
import Stamp from "lucide-react-native/icons/stamp"
import SunMoon from "lucide-react-native/icons/sun-moon"
import Table2 from "lucide-react-native/icons/table-2"
import Tag from "lucide-react-native/icons/tag"
import UserRound from "lucide-react-native/icons/user-round"
import { type ReactNode, Suspense } from "react"
import { Text, XStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { languageOptions } from "../../components/language-options.ts"
import { MenuBarSpacer } from "../../components/menu-nav.tsx"
import { Screen } from "../../components/screen.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { Skeleton } from "../../components/ui/skeleton.tsx"
import { VerticalNav } from "../../components/vertical-nav.tsx"
import { homeModeLabelKeys } from "../../core/home-mode-labels.ts"
import {
  useEvoluQuery,
  usePreloadDeviceEvoluQueries,
  usePreloadEvoluQueries,
} from "../../hooks/use-evolu-query.ts"
import { useTerminalHomeMode } from "../../hooks/use-terminal-home-mode.ts"
import { useThemePreference } from "../../hooks/use-theme-preference.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { useEetSettings } from "../shared/use-eet-settings.ts"
import {
  bitcoinWalletQueries,
  useBitcoinWallet,
} from "./payment-accounts/use-bitcoin-wallet.ts"
import {
  privacyQuery,
  usePrivacySettings,
} from "./privacy/use-privacy-settings.ts"
import { ProfileCard } from "./profile/profile-card.tsx"
import { themeLabelKeys } from "./theme/theme-settings-page.tsx"

/**
 * One line per row (Fazole's settings): the title and, at most, its current
 * value. No second line explaining the screen behind it. A value read from
 * the database is a `DeferredValue`, so the row shows before it.
 */
interface SettingRow {
  readonly icon: LucideIcon
  readonly title: TranslationKey
  readonly value?: ReactNode
  readonly href: Href
}

/** A row's current value, muted and right-aligned beside its title. */
function SettingValue({ children }: { readonly children: string | undefined }) {
  return (
    <Text
      color="muted-foreground"
      fontSize="sm"
      lineHeight="sm"
      numberOfLines={1}
      ml="auto"
      maxW="100%"
      flexShrink={1}
    >
      {children}
    </Text>
  )
}

/**
 * A value that waits for its query on its own: a short skeleton holds its
 * place, so the list around it never waits for the database.
 */
function DeferredValue({ children }: { readonly children: ReactNode }) {
  return (
    <Suspense fallback={<Skeleton ml="auto" w={64} h={14} />}>
      {children}
    </Suspense>
  )
}

const isEnabled = (
  account: { readonly isDeleted: number | null } | undefined
) => account !== undefined && account.isDeleted !== 1

/** The enabled payment methods, the three bitcoin wallets as one (settings/0002). */
function PaymentMethodsValue() {
  const { t } = useTranslation()
  const [cash] = useEvoluQuery(cashRegisterAccountQuery).data
  const [bank] = useEvoluQuery(fiatBankAccountQuery).data
  const bitcoin = useBitcoinWallet()
  const [card] = useEvoluQuery(cardSwitchioAccountQuery).data
  const enabledMethods = [
    [isEnabled(cash), "settings.paymentAccounts.method.cashRegister"],
    [isEnabled(bank), "settings.paymentAccounts.method.iban"],
    [bitcoin.enabled !== undefined, "settings.paymentAccounts.method.bitcoin"],
    [isEnabled(card), "settings.paymentAccounts.method.cardSwitchio"],
  ] as const
  return (
    <SettingValue>
      {enabledMethods
        .filter(([enabled]) => enabled)
        .map(([, key]) => t(key))
        .join(", ") || t("settings.paymentAccounts.nav.none")}
    </SettingValue>
  )
}

function TipsValue() {
  const { t } = useTranslation()
  const [settings] = useEvoluQuery(settingsQuery).data
  return (
    <SettingValue>
      {t(
        settings?.tipsEnabled === sqliteTrue
          ? "settings.tips.nav.on"
          : "settings.tips.nav.off"
      )}
    </SettingValue>
  )
}

function EetValue() {
  const { t } = useTranslation()
  const eet = useEetSettings()
  return (
    <SettingValue>
      {t(
        !eet.isEnabled
          ? "settings.eet.nav.off"
          : eet.isSandboxActive
            ? "settings.eet.nav.sandbox"
            : "settings.eet.nav.production"
      )}
    </SettingValue>
  )
}

/** The modes home offers, in their order (navigation/0004). */
function HomeModesValue() {
  const { t } = useTranslation()
  const { enabledModes } = useTerminalHomeMode()
  return (
    <SettingValue>
      {enabledModes.map((mode) => t(homeModeLabelKeys[mode])).join(", ")}
    </SettingValue>
  )
}

function ThemeValue() {
  const { t } = useTranslation()
  return <SettingValue>{t(themeLabelKeys[useThemePreference()])}</SettingValue>
}

function createSettingsNavItems(
  settings: ReadonlyArray<SettingRow>,
  t: (key: TranslationKey) => string
) {
  return settings.map((item) => {
    const label = t(item.title)

    return {
      kind: "link" as const,
      href: item.href,
      icon: <Icon icon={item.icon} size={20} color="muted-foreground" />,
      accessibilityLabel: label,
      label: (
        // No flex={1}: it would grow to the row's height and, wrapping, pack
        // a one-line label at the top instead of the row's center.
        <XStack
          minW={0}
          flexWrap="wrap"
          items="center"
          justify="space-between"
          columnGap={12}
          rowGap={4}
        >
          {/* Web's wrap: the title keeps its own width (no flex={1}, whose
              zero basis never wraps and squeezes it instead) and a value that
              does not fit beside it drops below, right-aligned. */}
          <Text
            flexShrink={1}
            minW={0}
            fontSize="sm"
            lineHeight="sm"
            fontWeight="600"
          >
            {label}
          </Text>
          {typeof item.value === "string" ? (
            <SettingValue>{item.value}</SettingValue>
          ) : (
            item.value
          )}
        </XStack>
      ),
    }
  })
}

/** The settings groups follow web's order; unavailable native routes stay omitted. */
/**
 * Everything the list's values read, `useEetSettings` included, started in
 * one round trip as the page mounts; `usePrivacySettings` reads the device
 * database, preloaded beside it. Nothing on the page waits for them: each
 * value waits on its own (`DeferredValue`), and so does the assistant row.
 */
const settingsPageQueries = [
  settingsQuery,
  cashRegisterAccountQuery,
  fiatBankAccountQuery,
  ...bitcoinWalletQueries,
  cardSwitchioAccountQuery,
  eetSettingsQuery,
]
const settingsPageDeviceQueries = [privacyQuery]

export function SettingsPage() {
  usePreloadEvoluQueries(settingsPageQueries)
  usePreloadDeviceEvoluQueries(settingsPageDeviceQueries)
  const { language, t } = useTranslation()

  // Items, tables and the modes home offers are set up here; the tables
  // grid itself is a mode of home (navigation/0004).
  const salesItems = createSettingsNavItems(
    [
      { icon: Tag, title: "catalog.items.title", href: "/settings/items" },
      { icon: Table2, title: "catalog.tables.title", href: "/settings/tables" },
      {
        icon: House,
        title: "settings.homeScreen.title",
        value: (
          <DeferredValue>
            <HomeModesValue />
          </DeferredValue>
        ),
        href: "/settings/home-screen",
      },
    ],
    t
  )
  const paymentItems = createSettingsNavItems(
    [
      {
        icon: Landmark,
        title: "settings.paymentAccounts.title",
        value: (
          <DeferredValue>
            <PaymentMethodsValue />
          </DeferredValue>
        ),
        href: "/settings/payment-accounts",
      },
      {
        icon: BadgeDollarSign,
        title: "settings.tips.title",
        value: (
          <DeferredValue>
            <TipsValue />
          </DeferredValue>
        ),
        href: "/settings/tips",
      },
    ],
    t
  )
  const taxItems = createSettingsNavItems(
    [
      {
        icon: Percent,
        title: "settings.taxRates.title",
        href: "/settings/tax-rates",
      },
      {
        icon: ReceiptText,
        title: "settings.paymentNumberSeries.title",
        href: "/settings/payment-number-series",
      },
      {
        icon: Stamp,
        title: "settings.eet.title",
        value: (
          <DeferredValue>
            <EetValue />
          </DeferredValue>
        ),
        href: "/settings/eet",
      },
    ],
    t
  )
  const accountItems = createSettingsNavItems(
    [
      {
        icon: UserRound,
        title: "settings.accounts.nav.title",
        href: "/settings/accounts",
      },
      {
        icon: ShieldCheck,
        title: "settings.security.title",
        href: "/settings/security",
      },
      {
        icon: LockKeyhole,
        title: "access.title",
        href: "/settings/access",
      },
    ],
    t
  )
  const appearanceItems = createSettingsNavItems(
    [
      {
        icon: Languages,
        title: "settings.language.title",
        value: languageOptions.find((option) => option.value === language)
          ?.label,
        href: "/settings/language",
      },
      {
        icon: SunMoon,
        title: "settings.theme.title",
        value: (
          <DeferredValue>
            <ThemeValue />
          </DeferredValue>
        ),
        href: "/settings/theme",
      },
    ],
    t
  )
  return (
    <Screen footer={<MenuBarSpacer />}>
      <FadeHeader title={t("settings.title")} startAddon={null} />
      <ProfileCard />
      <VerticalNav title={t("settings.payments")} items={paymentItems} />
      <VerticalNav title={t("settings.salesGroup")} items={salesItems} />
      <VerticalNav title={t("settings.taxesGroup")} items={taxItems} />
      <VerticalNav title={t("settings.accountAndSync")} items={accountItems} />
      <VerticalNav title={t("settings.appearance")} items={appearanceItems} />
      {/* The assistant row joins once the device's privacy setting is read. */}
      <Suspense fallback={<SupportNav assistant={false} />}>
        <SupportNavWithAssistant />
      </Suspense>
    </Screen>
  )
}

function SupportNavWithAssistant() {
  const { aiAssistantAccess } = usePrivacySettings()
  return <SupportNav assistant={aiAssistantAccess !== "off"} />
}

function SupportNav({ assistant }: { readonly assistant: boolean }) {
  const { t } = useTranslation()
  const items = createSettingsNavItems(
    [
      {
        icon: LifeBuoy,
        title: "settings.supportChat.title",
        href: "/settings/support",
      },
      ...(assistant
        ? [
            {
              icon: Sparkles,
              title: "settings.assistant.title",
              href: "/settings/assistant",
            } as const,
          ]
        : []),
      {
        icon: HeartHandshake,
        title: "settings.donations.title",
        href: "/settings/donations",
      },
      {
        icon: Info,
        title: "settings.about.title",
        href: "/settings/about",
      },
    ],
    t
  )
  return <VerticalNav title={t("settings.support")} items={items} />
}
