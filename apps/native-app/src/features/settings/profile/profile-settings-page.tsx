import { fiatCurrencyOptions } from "@payky/app-shared/fiat-currency-options"
import { optionalTextCodec } from "@payky/app-shared/inline-edit-codecs"
import {
  countryCodec,
  countryLabelKey,
  countryOptions,
  OTHER_COUNTRY,
} from "@payky/app-shared/legal-entity-options"
import {
  mergeProfileMetadata,
  type NostrProfile,
  profileFromMetadata,
  publishNostrProfile,
} from "@payky/core/integrations/nostr/nostr-client"
import { updateSettings } from "@payky/core/modules/app-settings/app-settings-actions"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import { setLegalEntity } from "@payky/core/modules/legal-entity/legal-entity-actions"
import { legalEntityQuery } from "@payky/core/modules/legal-entity/legal-entity-queries"
import type { CountryCode } from "@payky/core/modules/legal-entity/legal-entity-types"
import Copy from "lucide-react-native/icons/copy"
import ImageIcon from "lucide-react-native/icons/image"
import Trash from "lucide-react-native/icons/trash"
import { useState } from "react"
import { Image, Text as NativeText } from "react-native"
import { Text, useTheme, XStack, YStack } from "tamagui"
import { z } from "zod"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { InlineEditField } from "../../../components/inline-edit-field.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select.tsx"
import { Skeleton } from "../../../components/ui/skeleton.tsx"
import { Switch } from "../../../components/ui/switch.tsx"
import { useCopyToClipboard } from "../../../hooks/use-copy-to-clipboard.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import {
  setOwnNostrProfile,
  useNostrIdentity,
  useNostrProfile,
} from "../../../hooks/use-nostr-profile.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { pickProfilePicture } from "../../../platform/pick-profile-picture"
import { radius } from "../../../theme/tokens.ts"

/**
 * Edits the name and picture of the account's Nostr profile, as web's
 * `ProfileSettingsPage`: republished with the account's key as soon as it is
 * saved. The editor opens only once the published profile is known, so a save
 * never overwrites fields it could not read. Between the name and the key
 * sit the business's country, currency and VAT status (web's legal-entity
 * screen), unlabelled, each written as soon as it is chosen.
 */
export function ProfileSettingsPage() {
  const { t } = useTranslation()
  const identity = useNostrIdentity()
  const copy = useCopyToClipboard()
  const theme = useTheme()
  const profile = useNostrProfile(identity.pubkey)

  return (
    <Screen>
      <FadeHeader title={t("settings.profile.title")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.profile.title")}</CardTitle>
          <CardDescription>{t("settings.profile.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <YStack gap="5">
            {profile.data !== null ? (
              <ProfileEditor pubkey={identity.pubkey} profile={profile.data} />
            ) : profile.failed && !profile.loading ? (
              <YStack gap="2" role="alert">
                <Text color="destructive">
                  {t("settings.profile.loadFailed")}
                </Text>
                <Button
                  label={t("settings.profile.retry")}
                  variant="outline"
                  onPress={profile.refetch}
                />
              </YStack>
            ) : (
              <YStack gap="3" aria-label={t("settings.profile.title")}>
                <Skeleton w={80} h={80} rounded={radius.full} />
                <Skeleton h={40} />
              </YStack>
            )}
            <BusinessFields />
            <YStack gap="1.5">
              <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                {t("settings.profile.npub.label")}
              </Text>
              {/* The key can be copied by hand as well as with the button. */}
              <XStack items="center" gap="1">
                <NativeText
                  selectable
                  style={{
                    flex: 1,
                    fontSize: 12,
                    lineHeight: 16,
                    // Web's text-muted-foreground; RN Text has no theme color.
                    color: theme["muted-foreground"]?.val,
                    fontFamily: "monospace",
                  }}
                >
                  {identity.npub}
                </NativeText>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  labelColor="muted-foreground"
                  aria-label={t("settings.profile.npub.copy")}
                  iconStart={Copy}
                  onPress={() =>
                    void copy(identity.npub, {
                      copied: t("settings.profile.npub.copied"),
                      failed: t("settings.profile.npub.copyFailed"),
                    })
                  }
                />
              </XStack>
            </YStack>
          </YStack>
        </CardContent>
      </Card>
    </Screen>
  )
}

function ProfileEditor({
  pubkey,
  profile,
}: {
  readonly pubkey: string
  readonly profile: NostrProfile
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const [pictureInvalid, setPictureInvalid] = useState(false)
  // What this screen last published is what every reader shows
  // (`setOwnNostrProfile`); `profile` is that value once it is set.
  const current = profile

  // ponytail: each save merges into the profile as last published here, so a
  // name and a picture saved at the same instant can drop one of the two.
  const publish = (changes: {
    readonly name: string
    readonly picture: string | null
  }) =>
    runToast(async (run) => {
      const metadata = mergeProfileMetadata({
        current: current.metadata,
        ...changes,
      })
      const result = await run(publishNostrProfile({ metadata }))
      if (!result.ok) return "settings.profile.saveFailed"
      setOwnNostrProfile(pubkey, profileFromMetadata(metadata) ?? current)
      return undefined
    })

  const picture = useInlineChoice(current.picture, (next) =>
    publish({ name: current.name ?? "", picture: next })
  )

  const choosePicture = async () => {
    const picked = await pickProfilePicture()
    if (picked.type === "cancelled") return
    setPictureInvalid(picked.type === "invalid")
    if (picked.type === "picked") await picture.choose(picked.dataUrl)
  }

  return (
    <YStack gap="3">
      <YStack gap="2">
        <Text fontSize="sm" lineHeight="sm" fontWeight="600">
          {t("settings.profile.picture.label")}
        </Text>
        <XStack gap="3" alignItems="center">
          <YStack
            width={80}
            height={80}
            borderRadius={40}
            overflow="hidden"
            backgroundColor="card"
          >
            {picture.value !== null ? (
              <Image
                source={{ uri: picture.value }}
                style={{ width: 80, height: 80 }}
                accessibilityIgnoresInvertColors
              />
            ) : null}
          </YStack>
          <YStack gap="2" flex={1}>
            <Button
              label={t("settings.profile.picture.choose")}
              variant="outline"
              iconStart={ImageIcon}
              disabled={picture.saving}
              onPress={() => void choosePicture()}
            />
            {picture.value !== null ? (
              <Button
                label={t("settings.profile.picture.remove")}
                variant="ghost"
                iconStart={Trash}
                disabled={picture.saving}
                onPress={() => {
                  setPictureInvalid(false)
                  void picture.choose(null)
                }}
              />
            ) : null}
          </YStack>
        </XStack>
        {pictureInvalid ? (
          <Text color="destructive" role="alert">
            {t("settings.profile.picture.invalid")}
          </Text>
        ) : null}
      </YStack>
      <InlineEditField
        label={t("settings.profile.name.label")}
        placeholder={t("settings.profile.name.placeholder")}
        defaultValue={current.name}
        codec={optionalTextCodec}
        errorKey="settings.profile.name.invalid"
        onSave={(name) =>
          publish({ name: name ?? "", picture: current.picture })
        }
      />
    </YStack>
  )
}

const settingsPageQueries = [legalEntityQuery, settingsQuery]

/**
 * Country, accounting currency and VAT status, as web's
 * `LegalEntitySettingsPage`, without its labels: the country and the
 * currency read as their value ("Česko", "Kč"), the VAT status as one row
 * with a switch. Every choice is written at once.
 */
function BusinessFields() {
  usePreloadEvoluQueries(settingsPageQueries)
  const { t } = useTranslation()
  const runToast = useRunToast()
  const [legalEntity] = useEvoluQuery(legalEntityQuery).data
  const [settings] = useEvoluQuery(settingsQuery).data
  const vatPayer = legalEntity?.vatPayer === 1

  // `setLegalEntity` always writes both fields, so each control carries the
  // other one along unchanged.
  const save = (values: {
    readonly country: CountryCode | null
    readonly vatPayer: boolean
  }) =>
    runToast(async (run) => {
      await run.ok(setLegalEntity(values))
    })

  const country = useInlineChoice<CountryCode | null | undefined>(
    legalEntity === undefined ? undefined : legalEntity.country,
    async (next) =>
      next === undefined ? false : save({ country: next, vatPayer })
  )
  const currency = useInlineChoice(getFiatCurrency(settings), (fiatCurrency) =>
    runToast(async (run) => {
      await run.ok(updateSettings({ fiatCurrency }))
    })
  )
  const vat = useInlineChoice(vatPayer, (next) =>
    save({ country: legalEntity?.country ?? null, vatPayer: next })
  )
  const countryTitle = (option: (typeof countryOptions)[number]) =>
    t(countryLabelKey(option === OTHER_COUNTRY ? null : option))

  return (
    <YStack gap="3">
      {/* Nothing is selected until a country is chosen: the row does not exist. */}
      <Select
        value={
          country.value === undefined
            ? null
            : z.encode(countryCodec, country.value)
        }
        onValueChange={(value) => {
          const parsed = z.safeDecode(countryCodec, value)
          if (parsed.success) void country.choose(parsed.data)
        }}
        items={Object.fromEntries(
          countryOptions.map((option) => [option, countryTitle(option)])
        )}
      >
        <SelectTrigger
          fullWidth
          aria-label={t("settings.legalEntity.country.label")}
        >
          <SelectValue
            placeholder={t("settings.legalEntity.country.placeholder")}
          />
        </SelectTrigger>
        <SelectContent title={t("settings.legalEntity.country.label")}>
          {countryOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {countryTitle(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* The currency reads as its sign ("Kč"); the sheet names it too. */}
      <Select
        value={currency.value}
        onValueChange={(value) => void currency.choose(value)}
        items={Object.fromEntries(
          fiatCurrencyOptions.map((option) => [option.value, t(option.symbol)])
        )}
      >
        <SelectTrigger
          fullWidth
          aria-label={t("settings.legalEntity.currency.label")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent title={t("settings.legalEntity.currency.label")}>
          {fiatCurrencyOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {`${t(option.symbol)} · ${t(option.label)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <XStack items="center" justify="space-between" gap="3" minH={44} px={4}>
        <Text fontSize="sm" lineHeight="sm" fontWeight="600">
          {t("settings.profile.vatPayer")}
        </Text>
        <Switch
          checked={vat.value}
          aria-label={t("settings.profile.vatPayer")}
          // The country comes first: saving this while none is chosen
          // would write "other" on the user's behalf.
          disabled={legalEntity === undefined || vat.saving}
          onCheckedChange={(next) => void vat.choose(next)}
        />
      </XStack>
    </YStack>
  )
}
