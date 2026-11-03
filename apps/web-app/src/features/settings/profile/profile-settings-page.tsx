import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { optionalTextCodec } from "@payky/app-shared/inline-edit-codecs"
import {
  emptyNostrProfile,
  mergeProfileMetadata,
  type NostrIdentity,
  type NostrProfile,
  profileFromMetadata,
  publishNostrProfile,
} from "@payky/core/integrations/nostr/nostr-client"
import { useQueryClient } from "@tanstack/react-query"
import { CopyIcon, ImageIcon, Trash2Icon } from "lucide-react"
import { Suspense, useId, useRef, useState } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { ProfileAvatar } from "@/features/settings/profile/profile-avatar.tsx"
import { readProfilePicture } from "@/features/settings/profile/profile-picture.ts"
import { InlineEditField } from "@/features/shared/forms/inline-edit-field.tsx"
import {
  InlineEditSavedTick,
  useInlineChoice,
} from "@/features/shared/forms/inline-edit-save.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import {
  nostrProfileQueryKey,
  useActiveNostrProfile,
  useNostrIdentity,
} from "@/hooks/use-nostr-profile.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { copyToClipboard } from "@/lib/clipboard.ts"

/**
 * Edits the name and picture of the account's Nostr profile; each change is
 * republished with the account's key as soon as it is made. The editor opens
 * only once the published profile is known, so a save never overwrites
 * fields it could not read.
 */
export function ProfileSettingsPage() {
  const { t } = useTranslation()
  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.profile.title")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.profile.title")}</CardTitle>
          <CardDescription>{t("settings.profile.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Suspense fallback={<ProfileFieldsPlaceholder />}>
              <ProfileFields />
            </Suspense>
            <Field>
              <FieldLabel>{t("settings.profile.npub.label")}</FieldLabel>
              <Suspense fallback={<Skeleton className="h-8 w-full" />}>
                <ProfilePublicKey />
              </Suspense>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </>
  )
}

function ProfileFields() {
  const { t } = useTranslation()
  const identity = useNostrIdentity()
  const profile = useActiveNostrProfile()

  if (profile.isPending) return <ProfileFieldsPlaceholder />
  if (profile.isError) {
    return (
      <>
        <ProfileFieldsPlaceholder loading={false} />
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="text-sm text-destructive">
            {t("settings.profile.loadFailed")}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={profile.isFetching}
            onClick={() => void profile.refetch()}
          >
            {t("settings.profile.retry")}
          </Button>
        </div>
      </>
    )
  }
  return <ProfileEditor identity={identity} profile={profile.data} />
}

function ProfileFieldsPlaceholder({
  loading = true,
}: {
  readonly loading?: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      <Field data-disabled aria-busy={loading}>
        <FieldLabel>{t("settings.profile.picture.label")}</FieldLabel>
        <div className="flex items-center gap-4">
          {loading ? (
            <Skeleton className="size-20 shrink-0 rounded-full" />
          ) : (
            <div className="size-20 shrink-0" />
          )}
          <Button type="button" variant="outline" disabled>
            <ImageIcon data-icon="inline-start" />
            {t("settings.profile.picture.choose")}
          </Button>
        </div>
      </Field>
      <Field data-disabled aria-busy={loading}>
        <FieldLabel>{t("settings.profile.name.label")}</FieldLabel>
        {loading ? (
          <Skeleton className="h-8 w-full rounded-lg" />
        ) : (
          <div className="h-8" />
        )}
      </Field>
    </>
  )
}

function ProfileEditor({
  identity,
  profile,
}: {
  readonly identity: NostrIdentity
  readonly profile: NostrProfile
}) {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const queryClient = useQueryClient()
  const pictureInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pictureInvalid, setPictureInvalid] = useState(false)

  // ponytail: each save merges into the profile as last published here, so a
  // name and a picture saved at the same instant can drop one of the two;
  // queue the publishes if that ever shows up.
  const publish = async (changes: {
    readonly name: string
    readonly picture: string | null
  }): Promise<TranslationKey | undefined> => {
    const metadata = mergeProfileMetadata({
      current: profile.metadata,
      ...changes,
    })
    await using run = appRun()
    const result = await run(publishNostrProfile({ metadata }))
    if (!result.ok) return "settings.profile.saveFailed"
    // Relays may still serve the previous event for a moment, so the cache
    // takes what was published instead of refetching.
    queryClient.setQueryData(
      nostrProfileQueryKey(identity.pubkey),
      profileFromMetadata(metadata) ?? emptyNostrProfile
    )
    return undefined
  }

  const picture = useInlineChoice(profile.picture, (next) =>
    publish({ name: profile.name ?? "", picture: next })
  )

  const choosePicture = async (file: File | undefined) => {
    if (file === undefined) return
    const dataUrl = await readProfilePicture(file)
    setPictureInvalid(dataUrl === null)
    if (dataUrl !== null) await picture.choose(dataUrl)
  }

  return (
    <>
      <Field data-invalid={pictureInvalid}>
        <FieldLabel htmlFor={pictureInputId}>
          {t("settings.profile.picture.label")}
        </FieldLabel>
        <div className="relative flex items-center gap-4">
          {picture.justSaved && <InlineEditSavedTick className="right-0" />}
          <ProfileAvatar picture={picture.value} className="size-20" />
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              id={pictureInputId}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={picture.saving}
              onChange={(event) => {
                void choosePicture(event.currentTarget.files?.[0])
                event.currentTarget.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={picture.saving}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon data-icon="inline-start" />
              {t("settings.profile.picture.choose")}
            </Button>
            {picture.value !== null ? (
              <Button
                type="button"
                variant="ghost"
                disabled={picture.saving}
                onClick={() => {
                  setPictureInvalid(false)
                  void picture.choose(null)
                }}
              >
                <Trash2Icon data-icon="inline-start" />
                {t("settings.profile.picture.remove")}
              </Button>
            ) : null}
          </div>
        </div>
        <FieldError>
          {pictureInvalid ? t("settings.profile.picture.invalid") : null}
        </FieldError>
      </Field>

      <InlineEditField
        label={t("settings.profile.name.label")}
        placeholder={t("settings.profile.name.placeholder")}
        defaultValue={profile.name}
        codec={optionalTextCodec}
        errorKey="settings.profile.name.invalid"
        onSave={async (next) => {
          const errorKey = await publish({
            name: next ?? "",
            picture: profile.picture,
          })
          // The field toasts a rejection itself.
          if (errorKey !== undefined) throw new Error(errorKey)
        }}
      />
    </>
  )
}

function ProfilePublicKey() {
  const { t } = useTranslation()
  const identity = useNostrIdentity()
  return (
    <div className="flex items-center gap-1">
      <span className="min-w-0 flex-1 break-all font-mono text-xs text-muted-foreground">
        {identity.npub}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground"
        aria-label={t("settings.profile.npub.copy")}
        onClick={() =>
          void copyToClipboard(identity.npub, {
            copied: t("settings.profile.npub.copied"),
            failed: t("settings.profile.npub.copyFailed"),
          })
        }
      >
        <CopyIcon />
      </Button>
    </div>
  )
}
