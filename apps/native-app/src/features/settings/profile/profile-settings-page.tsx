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
  shortenNpub,
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
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { z } from "zod"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { InlineEditField } from "../../../components/inline-edit-field.tsx"
import { Screen } from "../../../components/screen.tsx"
import { SwitchRow } from "../../../components/switch-row.tsx"
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "../../../components/ui/alert.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select.tsx"
import { Skeleton } from "../../../components/ui/skeleton.tsx"
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
import { fontSize, radius } from "../../../theme/tokens.ts"
import { AccountAvatar } from "../account-avatar.tsx"

/**
 * The business's profile in two cards, as what is public and what is not:
 * - the public profile, web's `ProfileSettingsPage`: the name and picture of
 *   the account's Nostr profile, republished with the account's key as soon
 *   as they are saved, and the public key itself, shortened, with a copy
 *   button. The editor opens only once the published profile is known, so a
 *   save never overwrites fields it could not read.
 * - the business, web's legal-entity screen: country, currency and VAT
 *   status, kept in the app and written as soon as each is chosen.
 */
export function ProfileSettingsPage() {
  const { t } = useTranslation()
  const identity = useNostrIdentity()
  const copy = useCopyToClipboard()
  const profile = useNostrProfile(identity.pubkey)

  return (
    <Screen>
      <FadeHeader title={t("settings.profile.title")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.profile.public.title")}</CardTitle>
          <CardDescription>
            {t("settings.profile.public.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {profile.data !== null ? (
              <ProfileEditor pubkey={identity.pubkey} profile={profile.data} />
            ) : profile.failed && !profile.loading ? (
              <Alert variant="destructive" icon={TriangleAlert}>
                <AlertDescription>
                  {t("settings.profile.loadFailed")}
                </AlertDescription>
                <AlertAction>
                  <Button
                    size="sm"
                    label={t("settings.profile.retry")}
                    variant="outline"
                    onPress={profile.refetch}
                  />
                </AlertAction>
              </Alert>
            ) : (
              <YStack gap={12} aria-label={t("settings.profile.title")}>
                <Skeleton w={80} h={80} rounded={radius.full} />
                <Skeleton h={40} />
              </YStack>
            )}
            <Field>
              <FieldLabel>{t("settings.profile.npub.label")}</FieldLabel>
              {/* Shortened, as on the settings list: the whole key does not
                  fit a phone's width and pushed the copy button off it. The
                  button copies all of it. */}
              <XStack items="center" gap={4}>
                <Text
                  flex={1}
                  minW={0}
                  numberOfLines={1}
                  fontSize={fontSize.xs}
                  lineHeight={fontSize.xs}
                  color="muted-foreground"
                >
                  {shortenNpub(identity.npub)}
                </Text>
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
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.legalEntity.title")}</CardTitle>
          <CardDescription>
            {t("settings.profile.business.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BusinessFields />
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

  // ponytail: each save merges into the profile as last published here, so a
  // name and a picture saved at the same instant can drop one of the two.
  const publish = (changes: {
    readonly name: string
    readonly picture: string | null
  }) =>
    runToast(async (run) => {
      const metadata = mergeProfileMetadata({
        current: profile.metadata,
        ...changes,
      })
      const result = await run(publishNostrProfile({ metadata }))
      if (!result.ok) return "settings.profile.saveFailed"
      setOwnNostrProfile(pubkey, profileFromMetadata(metadata) ?? profile)
      return undefined
    })

  const picture = useInlineChoice(profile.picture, (next) =>
    publish({ name: profile.name ?? "", picture: next })
  )

  const choosePicture = async () => {
    const picked = await pickProfilePicture()
    if (picked.type === "cancelled") return
    setPictureInvalid(picked.type === "invalid")
    if (picked.type === "picked") await picture.choose(picked.dataUrl)
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>{t("settings.profile.picture.label")}</FieldLabel>
        <XStack gap={12} items="center">
          {/* Without a picture, the app's icon, as the settings list and the
              rail show it, rather than an empty circle the card hides. */}
          <AccountAvatar picture={picture.value} size={80} />
          <YStack gap={8} flex={1} items="flex-start">
            <Button
              label={t("settings.profile.picture.choose")}
              variant="outline"
              iconStart={ImageIcon}
              disabled={picture.saving}
              onPress={() => void choosePicture()}
            />
            {picture.value !== null ? (
              <Button
                size="sm"
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
        <FieldError>
          {pictureInvalid ? t("settings.profile.picture.invalid") : undefined}
        </FieldError>
      </Field>
      <InlineEditField
        label={t("settings.profile.name.label")}
        placeholder={t("settings.profile.name.placeholder")}
        defaultValue={profile.name}
        codec={optionalTextCodec}
        errorKey="settings.profile.name.invalid"
        onSave={(name) =>
          publish({ name: name ?? "", picture: profile.picture })
        }
      />
    </FieldGroup>
  )
}

const settingsPageQueries = [legalEntityQuery, settingsQuery]

/**
 * Country, accounting currency and VAT status, as web's
 * `LegalEntitySettingsPage`: the country and the currency under their
 * labels, the VAT status as one row with a switch. Every choice is written
 * at once.
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
    <FieldGroup>
      <Field>
        <FieldLabel>{t("settings.legalEntity.country.label")}</FieldLabel>
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
      </Field>
      <Field>
        <FieldLabel>{t("settings.legalEntity.currency.label")}</FieldLabel>
        {/* The currency reads as its sign ("Kč"); the sheet names it too. */}
        <Select
          value={currency.value}
          onValueChange={(value) => void currency.choose(value)}
          items={Object.fromEntries(
            fiatCurrencyOptions.map((option) => [
              option.value,
              t(option.symbol),
            ])
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
      </Field>
      <SwitchRow
        label={t("settings.profile.vatPayer")}
        checked={vat.value}
        // The country comes first: saving this while none is chosen
        // would write "other" on the user's behalf.
        disabled={legalEntity === undefined || vat.saving}
        onCheckedChange={(next) => void vat.choose(next)}
      />
    </FieldGroup>
  )
}
