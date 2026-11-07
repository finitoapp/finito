import { AbortError } from "@evolu/common"
import {
  type AssistantTurn,
  assistantConversationAtom,
  toAssistantMessages,
} from "@payky/app-shared/assistant-conversation"
import { brandName } from "@payky/app-shared/brand"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { createAiModelDep } from "@payky/core/ai/ai-model"
import { askAssistant } from "@payky/core/ai/assistant"
import { createAssistantTools } from "@payky/core/ai/assistant-tools"
import type { AiAssistantAccess } from "@payky/core/evolu/device-client"
import { Navigate } from "@tanstack/react-router"
import { atom, type PrimitiveAtom, useAtomValue, useStore } from "jotai"
import {
  AlertCircleIcon,
  MessageSquarePlusIcon,
  RotateCwIcon,
} from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { appBrand } from "@/core/app-brand.ts"
import { apiUrl } from "@/core/app-env.ts"
import {
  ChatComposer,
  ChatLayout,
  ChatScrollArea,
} from "@/features/settings/chat/chat-layout.tsx"
import { useAiAssistantAccess } from "@/hooks/use-ai-assistant-access.ts"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useEvolu } from "@/hooks/use-evolu.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { cn } from "@/lib/utils.ts"

/** What the assistant may read, as its empty state says and suggests. */
type Access = Exclude<AiAssistantAccess, "off">

const emptyKeys = {
  public: "settings.assistant.emptyPublic",
  all: "settings.assistant.empty",
} satisfies Record<Access, TranslationKey>

const suggestions = {
  public: [
    "settings.assistant.suggestion.howSplit",
    "settings.assistant.suggestion.howRefund",
  ],
  all: [
    "settings.assistant.suggestion.openBills",
    "settings.assistant.suggestion.latestPayments",
    "settings.assistant.suggestion.today",
    "settings.assistant.suggestion.howSplit",
  ],
} satisfies Record<Access, ReadonlyArray<TranslationKey>>

/** What a tool the reply waits for reads: the merchant's data or the docs. */
type LookingUp = "data" | "docs"

const lookingUpKeys = {
  data: "settings.assistant.lookingUp.data",
  docs: "settings.assistant.lookingUp.docs",
} satisfies Record<LookingUp, TranslationKey>

/** The reply being streamed in, and what a tool is reading for it. */
interface Answering {
  readonly text: string
  readonly lookingUp: LookingUp | null
}

/**
 * A chat with the assistant (ai/0004), laid out like the support chat. The
 * assistant reads the merchant's local data through its tools and answers
 * through Payky's AI proxy. The conversation stays in memory while the app
 * runs; leaving the page stops a reply that is still coming.
 *
 * The assistant exists only on a device that allowed it (ai/0004); anywhere
 * else the page sends the merchant to the privacy settings.
 */
export function AssistantChatPage() {
  const access = useAiAssistantAccess()
  if (access === "off") return <Navigate to="/settings/about/privacy" replace />
  return <AssistantChat access={access} />
}

function AssistantChat({ access }: { readonly access: Access }) {
  const { t } = useTranslation()
  const { turns, answeringAtom, ask, stop, startOver } =
    useAssistantConversation(access)
  const last = turns.at(-1)
  const answering = last?.status === "answering"

  return (
    <ChatLayout
      title={t("settings.assistant.title")}
      headerAction={
        turns.length === 0 ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("settings.assistant.newConversation")}
            onClick={startOver}
          >
            <MessageSquarePlusIcon className="size-5 text-primary" />
          </Button>
        )
      }
    >
      <ChatScrollArea followKey={answering ? last.id : null}>
        {turns.length === 0 ? (
          <EmptyConversation access={access} onAsk={ask} />
        ) : (
          // Busy while a reply streams in, so a screen reader reads it once
          // it is complete rather than word by word.
          <ol
            className="mt-auto flex flex-col gap-2"
            aria-live="polite"
            aria-busy={answering}
          >
            {turns.map((turn) => (
              <Turn
                key={turn.id}
                turn={turn}
                answeringAtom={answeringAtom}
                onRetry={() => ask(turn.question, turn.id)}
              />
            ))}
          </ol>
        )}
      </ChatScrollArea>
      <ChatComposer
        label={t("settings.assistant.message.label")}
        placeholder={t("settings.assistant.message.placeholder")}
        sendLabel={t("settings.assistant.send")}
        onSend={ask}
        disabled={false}
        stop={
          answering
            ? { label: t("settings.assistant.stop"), onStop: stop }
            : undefined
        }
      />
    </ChatLayout>
  )
}

/**
 * The conversation of the active account and access, and asking within it.
 * A conversation held with another access starts afresh, so
 * replies about the merchant's data are not sent again (ai/0004). The reply
 * being streamed lives in a page-scoped atom that only its bubble reads, so
 * a token re-renders that bubble rather than the whole conversation; it joins
 * the conversation once it is complete.
 */
function useAssistantConversation(access: Access) {
  const appRun = useAppRun()
  const store = useStore()
  const ownerId = useEvolu().appOwner.id
  const conversation = useAtomValue(assistantConversationAtom)
  const isCurrent = (current: typeof conversation) =>
    current.ownerId === ownerId && current.access === access
  const turns = isCurrent(conversation) ? conversation.turns : []
  const [answeringAtom] = useState(() =>
    atom<Answering>({ text: "", lookingUp: null })
  )
  const fiber = useRef<{ readonly abort: () => void } | null>(null)

  // Leaving the page stops the reply; what came so far stays.
  useEffect(() => () => fiber.current?.abort(), [])

  const updateTurns = (
    update: (
      turns: ReadonlyArray<AssistantTurn>
    ) => ReadonlyArray<AssistantTurn>
  ) =>
    store.set(assistantConversationAtom, (current) => ({
      ownerId,
      access,
      turns: update(isCurrent(current) ? current.turns : []),
    }))

  /** Asks `question`, or asks the failed turn `retryOf` again. */
  const ask = async (question: string, retryOf?: string) => {
    const earlier = turns.filter((turn) => turn.id !== retryOf)
    const id = crypto.randomUUID()
    updateTurns(() => [
      ...earlier,
      { id, question, reply: "", status: "answering" },
    ])
    store.set(answeringAtom, { text: "", lookingUp: null })

    await using run = appRun()
    const { tools, repoTools } = createAssistantTools(access, run, {
      snapshotUrl: apiUrl("/repo-snapshot.json"),
      appVersion: __APP_VERSION__,
    })
    const current = run.abortable(
      askAssistant({
        appName: brandName(appBrand),
        messages: toAssistantMessages(earlier, question),
        tools,
        onText: (text) =>
          store.set(answeringAtom, (answer) => ({
            text: answer.text + text,
            lookingUp: null,
          })),
        onToolCall: (toolName) =>
          store.set(answeringAtom, (answer) => ({
            ...answer,
            lookingUp: Object.hasOwn(repoTools, toolName) ? "docs" : "data",
          })),
      }),
      {
        ...run.deps,
        // Payky's AI proxy (ai/0001), which holds the provider and its key.
        ...createAiModelDep({ baseURL: apiUrl("/api/ai/v1"), ownerId }),
      }
    )
    // The run's signal cannot tell: a settled fiber's run is disposed, which
    // aborts it too.
    let stopped = false
    fiber.current = {
      abort: () => {
        stopped = true
        current.abort()
      },
    }
    const result = await current
    fiber.current = null

    const reply = result.ok ? result.value : store.get(answeringAtom).text
    const status: AssistantTurn["status"] =
      stopped || (!result.ok && AbortError.is(result.error))
        ? "stopped"
        : result.ok
          ? "answered"
          : "failed"
    updateTurns((all) =>
      all.map((turn) => (turn.id === id ? { ...turn, reply, status } : turn))
    )
  }

  return {
    turns,
    answeringAtom,
    ask: (question: string, retryOf?: string) => void ask(question, retryOf),
    stop: () => fiber.current?.abort(),
    /** Stops a reply still coming and forgets the conversation. */
    startOver: () => {
      fiber.current?.abort()
      updateTurns(() => [])
    },
  }
}

function EmptyConversation({
  access,
  onAsk,
}: {
  readonly access: Access
  readonly onAsk: (question: string) => void
}) {
  const { t } = useTranslation()
  return (
    // At the bottom, next to the composer and the thumb, as in messengers.
    <div className="mx-auto mt-auto flex max-w-xs flex-col items-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">{t(emptyKeys[access])}</p>
      {suggestions[access].map((key) => (
        <Button
          key={key}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAsk(t(key))}
        >
          {t(key)}
        </Button>
      ))}
    </div>
  )
}

function Turn({
  turn,
  answeringAtom,
  onRetry,
}: {
  readonly turn: AssistantTurn
  readonly answeringAtom: PrimitiveAtom<Answering>
  readonly onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <Bubble own>{turn.question}</Bubble>
      {turn.status === "answering" ? (
        <AnsweringBubble answeringAtom={answeringAtom} />
      ) : turn.reply === "" ? null : (
        <Bubble own={false}>{turn.reply}</Bubble>
      )}
      {turn.status === "stopped" ? (
        <li className="self-start px-3 text-xs text-muted-foreground">
          {t("settings.assistant.stopped")}
        </li>
      ) : null}
      {turn.status === "failed" ? (
        <li className="self-start">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-destructive"
            onClick={onRetry}
          >
            <AlertCircleIcon data-icon="inline-start" />
            {t("settings.assistant.failed")}
            <RotateCwIcon data-icon="inline-end" />
          </Button>
        </li>
      ) : null}
    </>
  )
}

/**
 * The reply as it streams in. Until the first words it is a bubble that is
 * typing, saying what a tool reads, if one does; a tool started after some
 * words says it below them.
 */
function AnsweringBubble({
  answeringAtom,
}: {
  readonly answeringAtom: PrimitiveAtom<Answering>
}) {
  const { t } = useTranslation()
  const { text, lookingUp } = useAtomValue(answeringAtom)
  const waitingFor = (
    <span className="flex items-center gap-2 text-muted-foreground">
      <TypingDots />
      {lookingUp === null ? (
        <span className="sr-only">{t("settings.assistant.thinking")}</span>
      ) : (
        <span className="text-xs">{t(lookingUpKeys[lookingUp])}</span>
      )}
    </span>
  )
  if (text === "") return <Bubble own={false}>{waitingFor}</Bubble>
  return (
    <>
      <Bubble own={false}>{text}</Bubble>
      {lookingUp === null ? null : (
        <li className="self-start px-3">{waitingFor}</li>
      )}
    </>
  )
}

function TypingDots() {
  return (
    <span className="flex h-5 items-center gap-1" aria-hidden="true">
      {["[animation-delay:-0.3s]", "[animation-delay:-0.15s]", ""].map(
        (delay) => (
          <span
            key={delay}
            className={cn(
              "size-1.5 animate-bounce rounded-full bg-current",
              delay
            )}
          />
        )
      )}
    </span>
  )
}

/**
 * The support chat's bubbles: the merchant on the primary colour, replies on
 * a card. A question opens a turn, so it keeps more room above it than the
 * reply below it has.
 */
function Bubble({
  own,
  children,
}: {
  readonly own: boolean
  readonly children: ReactNode
}) {
  return (
    <li
      className={cn(
        "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]",
        own
          ? "self-end bg-primary text-primary-foreground not-first:mt-3"
          : "self-start bg-card text-card-foreground ring-1 ring-foreground/10 ring-inset"
      )}
    >
      {children}
    </li>
  )
}
