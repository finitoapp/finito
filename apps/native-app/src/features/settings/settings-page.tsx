import { sqliteTrue } from "@evolu/common"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { countryLabelKey } from "@payky/app-shared/legal-entity-options"
import {
  cardSwitchioAccountQuery,
  cashRegisterAccountQuery,
  fiatBankAccountQuery,
  sparkAccountQuery,
} from "@payky/core/modules/account/account-queries"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import {
  getFiatCurrency,
  parseEnabledHomeModes,
} from "@payky/core/modules/app-settings/app-settings-utils"
import { eetSettingsQuery } from "@payky/core/modules/eet/eet-queries"
import { legalEntityQuery } from "@payky/core/modules/legal-entity/legal-entity-queries"
import type { Href } from "expo-router"
import type { LucideIcon } from "lucide-react-native"
import BadgeDollarSign from "lucide-react-native/icons/badge-dollar-sign"
import Building from "lucide-react-native/icons/building"
import FolderIcon from "lucide-react-native/icons/folder"
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
import ShoppingBag from "lucide-react-native/icons/shopping-bag"
import Sparkles from "lucide-react-native/icons/sparkles"
import Stamp from "lucide-react-native/icons/stamp"
import SunMoon from "lucide-react-native/icons/sun-moon"
import Table2Icon from "lucide-react-native/icons/table-2"
import UserRound from "lucide-react-native/icons/user-round"
import { Text, XStack, YStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { languageOptions } from "../../components/language-options.ts"
import { Screen } from "../../components/screen.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { VerticalNav } from "../../components/vertical-nav.tsx"
import {
  useEvoluQuery,
  usePreloadDeviceEvoluQueries,
  usePreloadEvoluQueries,
} from "../../hooks/use-evolu-query.ts"
import { useThemePreference } from "../../hooks/use-theme-preference.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { useEetSettings } from "../shared/use-eet-settings.ts"
import { homeModeLabelKeys } from "./home-screen/home-screen-settings-page.tsx"
import {
  privacyQuery,
  usePrivacySettings,
} from "./privacy/use-privacy-settings.ts"
import { ProfileCard } from "./profile/profile-card.tsx"
import { themeLabelKeys } from "./theme/theme-settings-page.tsx"

interface SettingRow {
  readonly icon: LucideIcon
  readonly title: TranslationKey
  readonly description?: TranslationKey
  readonly value?: string
  readonly href: Href
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
          <YStack flexShrink={1} minW={0} gap={4}>
            <Text fontSize="sm" lineHeight="sm" fontWeight="600">
              {label}
            </Text>
            {item.description === undefined ? null : (
              <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                {t(item.description)}
              </Text>
            )}
          </YStack>
          {item.value === undefined ? null : (
            <Text
              color="muted-foreground"
              fontSize="sm"
              lineHeight="sm"
              numberOfLines={1}
              ml="auto"
              maxW="100%"
              flexShrink={1}
            >
              {item.value}
            </Text>
          )}
        </XStack>
      ),
    }
  })
}

/** The settings groups follow web's order; unavailable native routes stay omitted. */
/**
 * Everything the list reads, `useEetSettings` included, in one round trip;
 * `usePrivacySettings` reads the device database, preloaded beside it.
 */
const settingsPageQueries = [
  settingsQuery,
  legalEntityQuery,
  cashRegisterAccountQuery,
  fiatBankAccountQuery,
  sparkAccountQuery,
  cardSwitchioAccountQuery,
  eetSettingsQuery,
]
const settingsPageDeviceQueries = [privacyQuery]

export function SettingsPage() {
  usePreloadEvoluQueries(settingsPageQueries)
  usePreloadDeviceEvoluQueries(settingsPageDeviceQueries)
  const { language, t } = useTranslation()
  const theme = useThemePreference()
  const [settings] = useEvoluQuery(settingsQuery).data
  const [legalEntity] = useEvoluQuery(legalEntityQuery).data
  const [cash] = useEvoluQuery(cashRegisterAccountQuery).data
  const [bank] = useEvoluQuery(fiatBankAccountQuery).data
  const eet = useEetSettings()
  const { aiAssistantAccess } = usePrivacySettings()
  const [spark] = useEvoluQuery(sparkAccountQuery).data
  const [card] = useEvoluQuery(cardSwitchioAccountQuery).data
  const enabledMethods = [
    [cash, "settings.paymentAccounts.method.cashRegister"],
    [bank, "settings.paymentAccounts.method.iban"],
    [spark, "settings.paymentAccounts.method.spark"],
    [card, "settings.paymentAccounts.method.cardSwitchio"],
  ] as const
  const paymentMethodsValue =
    enabledMethods
      .filter(([account]) => account !== undefined && account.isDeleted !== 1)
      .map(([, key]) => t(key))
      .join(", ") || t("settings.paymentAccounts.nav.none")
  const enabledHomeModes = parseEnabledHomeModes(settings?.enabledHomeModesJson)
  const fiatCurrency = getFiatCurrency(settings)
  const businessValue =
    legalEntity === undefined
      ? fiatCurrency
      : `${t(countryLabelKey(legalEntity.country))} · ${fiatCurrency}`

  const catalogItems = createSettingsNavItems(
    [
      {
        icon: ShoppingBag,
        title: "settings.items.title",
        description: "settings.items.description",
        href: "/settings/items",
      },
      {
        icon: FolderIcon,
        title: "settings.categories.title",
        description: "settings.categories.description",
        href: "/settings/categories",
      },
      {
        icon: Table2Icon,
        title: "settings.tables.title",
        description: "settings.tables.description",
        href: "/settings/tables",
      },
    ],
    t
  )
  const paymentItems = createSettingsNavItems(
    [
      {
        icon: Building,
        title: "settings.legalEntity.title",
        value: businessValue,
        href: "/settings/legal-entity",
      },
      {
        icon: Landmark,
        title: "settings.paymentAccounts.title",
        value: paymentMethodsValue,
        href: "/settings/payment-accounts",
      },
      {
        icon: BadgeDollarSign,
        title: "settings.tips.title",
        value: t(
          settings?.tipsEnabled === sqliteTrue
            ? "settings.tips.nav.on"
            : "settings.tips.nav.off"
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
        description: "settings.taxRates.nav.description",
        href: "/settings/tax-rates",
      },
      {
        icon: ReceiptText,
        title: "settings.paymentNumberSeries.title",
        description: "settings.paymentNumberSeries.description",
        href: "/settings/payment-number-series",
      },
      {
        icon: Stamp,
        title: "settings.eet.title",
        value: t(
          !eet.isEnabled
            ? "settings.eet.nav.off"
            : eet.isSandboxActive
              ? "settings.eet.nav.sandbox"
              : "settings.eet.nav.production"
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
        description: "settings.accounts.nav.description",
        href: "/settings/accounts",
      },
      {
        icon: ShieldCheck,
        title: "settings.security.title",
        description: "settings.security.description",
        href: "/settings/security",
      },
      {
        icon: LockKeyhole,
        title: "access.title",
        description: "access.nav.description",
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
        value: t(themeLabelKeys[theme]),
        href: "/settings/theme",
      },
      {
        icon: House,
        title: "settings.homeScreen.title",
        value: enabledHomeModes
          .map((mode) => t(homeModeLabelKeys[mode]))
          .join(", "),
        href: "/settings/home-screen",
      },
    ],
    t
  )
  const supportItems = createSettingsNavItems(
    [
      {
        icon: LifeBuoy,
        title: "settings.supportChat.title",
        description: "settings.supportChat.description",
        href: "/settings/support",
      },
      ...(aiAssistantAccess === "off"
        ? []
        : [
            {
              icon: Sparkles,
              title: "settings.assistant.title",
              description: "settings.assistant.description",
              href: "/settings/assistant",
            } as const,
          ]),
      {
        icon: HeartHandshake,
        title: "settings.donations.title",
        description: "settings.donations.description",
        href: "/settings/donations",
      },
      {
        icon: Info,
        title: "settings.about.title",
        description: "settings.about.description",
        href: "/settings/about",
      },
    ],
    t
  )

  return (
    <Screen>
      <FadeHeader title={t("settings.title")} />
      <ProfileCard />
      <VerticalNav title={t("settings.catalog")} items={catalogItems} />
      <VerticalNav title={t("settings.payments")} items={paymentItems} />
      <VerticalNav title={t("settings.taxesGroup")} items={taxItems} />
      <VerticalNav title={t("settings.accountAndSync")} items={accountItems} />
      <VerticalNav title={t("settings.appearance")} items={appearanceItems} />
      <VerticalNav title={t("settings.support")} items={supportItems} />
    </Screen>
  )
}
