import { Capacitor } from "@capacitor/core"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { splitMentions } from "@payky/app-shared/support-chat-mentions"
import {
  buildTimeline,
  type ChatEntry,
  type TimelineItem,
  toChatEntries,
} from "@payky/app-shared/support-chat-timeline"
import { shortenNpub } from "@payky/core/integrations/nostr/nostr-client"
import {
  type DmInbox,
  mergeSupportMessages,
  type SupportMessage,
  type SupportTeam,
  sendSupportMessage,
} from "@payky/core/integrations/nostr/nostr-support-chat"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  ClockIcon,
  RotateCwIcon,
} from "lucide-react"
import { npubEncode } from "nostr-tools/nip19"
import { useState } from "react"
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "@/components/reui/alert.tsx"
import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import {
  ChatComposer,
  ChatLayout,
  ChatScrollArea,
} from "@/features/settings/chat/chat-layout.tsx"
import { ProfileAvatar } from "@/features/settings/profile/profile-avatar.tsx"
import {
  supportMessagesQueryKey,
  useDmInbox,
  useDmRelayList,
  useSupportMessages,
  useSupportTeam,
} from "@/features/settings/support/use-support-chat.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import {
  useActiveNostrProfile,
  useNostrIdentity,
  useNostrProfile,
} from "@/hooks/use-nostr-profile.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatRelativeDate, formatTime } from "@/lib/format-utils.ts"
import { cn } from "@/lib/utils.ts"

/**
 * A group chat with the support team Payky's API serves (support/0001), laid out
 * like a messenger: the header stays put, the conversation scrolls between it
 * and the composer, newest at the bottom. New messages arrive live while it
 * is open; there is no unread state and no push.
 */
export function SupportChatPage() {
  const { t } = useTranslation()
  const { pubkey } = useNostrIdentity()
  const team = useSupportTeam()
  const inbox = useDmInbox({ pubkey, team: team.data })
  const messages = useSupportMessages({
    pubkey,
    team: team.data,
    inbox: inbox.data,
  })
  const { pending, send, retry } = useSendSupportMessage({
    pubkey,
    team: team.data,
    inbox: inbox.data,
  })
  const dmRelayList = useDmRelayList({ pubkey, team: team.data })
  // Every message makes sure support's client can find where to reply: an
  // account without a DM relay list gets one alongside its first message,
  // even one sent before the check finished (support/0004).
  const sendAndOpenReplies = async (text: string) => {
    await Promise.all([send(text), dmRelayList.ensure()])
  }
  // Without the team there is nobody to write to: the chat says so instead
  // of falling back to a list built into the app (support/0001).
  const failure: TranslationKey | null = team.isError
    ? "settings.supportChat.teamUnavailable"
    : inbox.isError || messages.isError
      ? "settings.supportChat.loadFailed"
      : null
  const failedQuery = team.isError ? team : inbox.isError ? inbox : messages

  const entries: ReadonlyArray<ChatEntry> = [
    ...toChatEntries(messages.data ?? []),
    ...pending,
  ]

  return (
    <ChatLayout title={t("settings.supportChat.title")}>
      <Conversation
        entries={entries}
        loading={
          failure === null &&
          (team.isPending || inbox.isPending || messages.isPending)
        }
        failure={failure}
        reloading={team.isFetching || inbox.isFetching || messages.isFetching}
        onReload={() => void failedQuery.refetch()}
        onRetry={retry}
      />
      {inbox.data?.state === "unverified" || dmRelayList.failed ? (
        <DmInboxWarning
          unverified={inbox.data?.state === "unverified"}
          publishFailed={dmRelayList.failed}
          onVerify={async () => {
            await inbox.refetch()
            await dmRelayList.ensure()
          }}
          onPublish={dmRelayList.publish}
        />
      ) : null}
      <ChatComposer
        label={t("settings.supportChat.message.label")}
        placeholder={t("settings.supportChat.message.placeholder")}
        sendLabel={t("settings.supportChat.send")}
        onSend={(text) => void sendAndOpenReplies(text)}
        disabled={team.data === undefined}
      />
    </ChatLayout>
  )
}

/**
 * Sends optimistically: the message shows at once as sending, then joins the
 * conversation, or stays marked as not delivered with a retry.
 */
function useSendSupportMessage({
  pubkey,
  team,
  inbox,
}: {
  readonly pubkey: string
  readonly team: SupportTeam | undefined
  readonly inbox: DmInbox | undefined
}) {
  const runToast = useRunToast()
  const queryClient = useQueryClient()
  const identity = useNostrIdentity()
  const profile = useActiveNostrProfile()
  const [pending, setPending] = useState<ReadonlyArray<ChatEntry>>([])

  const send = async (text: string) => {
    // The composer is disabled until the team is loaded.
    if (team === undefined) return
    const id = crypto.randomUUID()
    setPending((current) => [
      ...current,
      {
        id,
        author: pubkey,
        fromSupport: false,
        text,
        sentAt: Math.floor(Date.now() / 1000),
        type: "message",
        refersTo: [],
        status: "sending",
        reactions: [],
      },
    ])

    const outcome: { delivered?: SupportMessage } = {}
    await runToast(async (run) => {
      const result = await run(
        sendSupportMessage({
          text,
          subject: `Payky · ${profile.data?.name ?? shortenNpub(identity.npub)}`,
          client: {
            version: __APP_VERSION__,
            platform: Capacitor.getPlatform(),
          },
          team,
          // Not loaded yet: the own copy goes to the team's relays only.
          inbox: inbox ?? { relays: [], state: "unverified" },
        })
      )
      // Not delivered is shown on the message itself, with a retry.
      if (result.ok) outcome.delivered = result.value
    })

    const { delivered } = outcome
    if (delivered === undefined) {
      setPending((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, status: "failed" } : entry
        )
      )
      return
    }
    // Relays may not serve it back yet, so the cache takes it directly.
    queryClient.setQueryData(
      supportMessagesQueryKey(pubkey),
      (current: ReadonlyArray<SupportMessage> | undefined) =>
        mergeSupportMessages(current, [delivered])
    )
    setPending((current) => current.filter((entry) => entry.id !== id))
  }

  const retry = (failed: ChatEntry) => {
    setPending((current) => current.filter((entry) => entry.id !== failed.id))
    void send(failed.text)
  }

  return { pending, send, retry }
}

/**
 * Support may have nowhere to reply: the account's DM relay list could not be
 * checked, or publishing it failed (support/0001). Retrying checks again — and
 * publishes when the list turns out missing — or publishes again; publishing
 * over a list that could not be checked is a separate, confirmed choice,
 * because it replaces the list Linky may rely on.
 */
function DmInboxWarning({
  unverified,
  publishFailed,
  onVerify,
  onPublish,
}: {
  readonly unverified: boolean
  readonly publishFailed: boolean
  readonly onVerify: () => Promise<void>
  readonly onPublish: () => Promise<void>
}) {
  const { t } = useTranslation()
  const confirm = useConfirmDialog()
  const [busy, setBusy] = useState(false)
  const busyWhile = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shrink-0 px-3 pb-3">
      <Alert variant="warning">
        <AlertTriangleIcon />
        <AlertDescription>
          {t(
            unverified
              ? "settings.supportChat.inbox.unverified"
              : "settings.supportChat.inbox.publishFailed"
          )}
        </AlertDescription>
        <AlertAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              void busyWhile(
                unverified && !publishFailed ? onVerify : onPublish
              )
            }
          >
            {t("settings.supportChat.retry")}
          </Button>
          {unverified ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void busyWhile(async () => {
                  const confirmed = await confirm({
                    title: t("settings.supportChat.inbox.confirm.title"),
                    description: t(
                      "settings.supportChat.inbox.confirm.description"
                    ),
                    confirmLabel: t(
                      "settings.supportChat.inbox.confirm.confirm"
                    ),
                    cancelLabel: t("settings.supportChat.inbox.confirm.cancel"),
                    variant: "destructive",
                  })
                  if (confirmed) await onPublish()
                })
              }
            >
              {t("settings.supportChat.inbox.publishAnyway")}
            </Button>
          ) : null}
        </AlertAction>
      </Alert>
    </div>
  )
}

function Conversation({
  entries,
  loading,
  failure,
  reloading,
  onReload,
  onRetry,
}: {
  readonly entries: ReadonlyArray<ChatEntry>
  readonly loading: boolean
  /** What went wrong loading the chat, with a retry beside it. */
  readonly failure: TranslationKey | null
  readonly reloading: boolean
  readonly onReload: () => void
  readonly onRetry: (entry: ChatEntry) => void
}) {
  const { t } = useTranslation()
  const last = entries.at(-1)
  const ownJustSent = last?.fromSupport === false && last.status === "sending"
  const timeline = buildTimeline(entries)

  return (
    <ChatScrollArea followKey={ownJustSent ? last.id : null}>
      {failure === null ? null : (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{t(failure)}</AlertDescription>
          <AlertAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={reloading}
              onClick={onReload}
            >
              {t("settings.supportChat.retry")}
            </Button>
          </AlertAction>
        </Alert>
      )}

      {loading ? (
        <div className="mt-auto flex flex-col gap-2" aria-hidden="true">
          <Skeleton className="h-10 w-2/3 rounded-2xl" />
          <Skeleton className="h-14 w-1/2 self-end rounded-2xl" />
          <Skeleton className="h-10 w-3/5 rounded-2xl" />
        </div>
      ) : timeline.length === 0 && failure === null ? (
        // At the bottom, next to the composer, as the assistant's.
        <p className="mx-auto mt-auto max-w-xs text-center text-sm text-muted-foreground">
          {t("settings.supportChat.empty")}
        </p>
      ) : (
        <ol className="mt-auto flex flex-col" aria-live="polite">
          {timeline.map((item) => (
            <TimelineRow key={item.key} item={item} onRetry={onRetry} />
          ))}
        </ol>
      )}
    </ChatScrollArea>
  )
}

function TimelineRow({
  item,
  onRetry,
}: {
  readonly item: TimelineItem
  readonly onRetry: (entry: ChatEntry) => void
}) {
  const locale = useLocale()
  if (item.kind === "day") {
    return (
      <li className="my-2 self-center">
        <Badge variant="secondary">
          {formatRelativeDate(item.date, new Date(), locale)}
        </Badge>
      </li>
    )
  }
  return <MessageBubble {...item} onRetry={onRetry} />
}

function MessageBubble({
  entry,
  firstOfGroup,
  lastOfGroup,
  onRetry,
}: Extract<TimelineItem, { kind: "message" }> & {
  readonly onRetry: (entry: ChatEntry) => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const own = !entry.fromSupport

  return (
    <li
      className={cn(
        "flex max-w-[85%] items-end gap-2",
        own ? "self-end" : "self-start",
        firstOfGroup ? "mt-3 first:mt-0" : "mt-1"
      )}
    >
      {/* As in group chats, the others' avatar sits by the last bubble of
          their run; the earlier ones keep its width so the run lines up. */}
      {own ? null : lastOfGroup ? (
        <SupportAvatar pubkey={entry.author} />
      ) : (
        <span className="w-7 shrink-0" aria-hidden="true" />
      )}
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1",
          own ? "items-end" : "items-start"
        )}
      >
        {!own && firstOfGroup ? <SupportAuthor pubkey={entry.author} /> : null}
        {/* Support writes on a card, the account on the primary colour, as
          the rest of the app tells surfaces from actions. */}
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm",
            own
              ? "bg-primary text-primary-foreground"
              : // Inset: an outer ring would eat the gap between bubbles.
                "bg-card text-card-foreground ring-1 ring-foreground/10 ring-inset",
            // As in messengers, a run reads as one block: the corners on the
            // author's side tighten where its bubbles meet.
            !firstOfGroup && (own ? "rounded-tr-md" : "rounded-tl-md"),
            !lastOfGroup && (own ? "rounded-br-md" : "rounded-bl-md"),
            entry.status === "sending" && "opacity-70"
          )}
        >
          <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
            <MessageText text={entry.text} own={own} />
          </span>
          <span
            className={cn(
              "float-right mt-1 ml-3 inline-flex items-center gap-1 text-xs",
              own ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {formatTime(new Date(entry.sentAt * 1000), locale)}
            {own && entry.status === "sending" ? (
              <ClockIcon
                className="size-3"
                aria-label={t("settings.supportChat.sending")}
              />
            ) : null}
            {/* A relay accepted it for support; NIP-17 cannot tell more. */}
            {own && entry.status === "sent" ? (
              <CheckIcon
                className="size-3"
                aria-label={t("settings.supportChat.sent")}
              />
            ) : null}
          </span>
        </div>
        {/* As in messengers, reactions overlap the bubble's lower edge. */}
        {entry.reactions.length > 0 ? (
          <span className="-mt-2.5 mx-2 rounded-full bg-card px-1.5 text-sm ring-1 ring-foreground/10 ring-inset">
            {entry.reactions.join(" ")}
          </span>
        ) : null}
        {entry.status === "failed" ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-destructive"
            onClick={() => onRetry(entry)}
          >
            <AlertCircleIcon data-icon="inline-start" />
            {t("settings.supportChat.notDelivered")}
            <RotateCwIcon data-icon="inline-end" />
          </Button>
        ) : null}
      </div>
    </li>
  )
}

/**
 * A support member's profile, also read from the team's indexers, where the
 * names of people who publish elsewhere live. Bubbles render only once the
 * team is loaded, so its indexers are known by then.
 */
const useSupportMemberProfile = (pubkey: string) =>
  useNostrProfile(pubkey, useSupportTeam().data?.indexerRelays)

function SupportAvatar({ pubkey }: { readonly pubkey: string }) {
  const profile = useSupportMemberProfile(pubkey)
  return (
    <ProfileAvatar picture={profile.data?.picture ?? null} className="size-7" />
  )
}

function SupportAuthor({ pubkey }: { readonly pubkey: string }) {
  const profile = useSupportMemberProfile(pubkey)
  return (
    <span className="px-1 text-xs font-medium text-muted-foreground">
      {profile.data?.name ?? shortenNpub(npubEncode(pubkey))}
    </span>
  )
}

/** A message, with the accounts it mentions shown by name. */
function MessageText({
  text,
  own,
}: {
  readonly text: string
  readonly own: boolean
}) {
  let offset = 0
  return splitMentions(text).map((part) => {
    // Parts never move, so where one starts is a stable key.
    const key = offset
    offset += part.kind === "text" ? part.text.length : 1
    return part.kind === "text" ? (
      <span key={key}>{part.text}</span>
    ) : (
      <Mention key={key} pubkey={part.pubkey} own={own} />
    )
  })
}

/** A mentioned account as other clients show it: a chip with its picture. */
function Mention({
  pubkey,
  own,
}: {
  readonly pubkey: string
  readonly own: boolean
}) {
  const profile = useSupportMemberProfile(pubkey)
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full py-px pr-2 pl-0.5 align-bottom font-medium whitespace-nowrap",
        own
          ? "bg-primary-foreground/15 text-primary-foreground"
          : "bg-primary/10 text-primary"
      )}
    >
      <ProfileAvatar
        picture={profile.data?.picture ?? null}
        className="size-4"
      />
      <span className="truncate">
        {profile.data?.name ?? shortenNpub(npubEncode(pubkey))}
      </span>
    </span>
  )
}
