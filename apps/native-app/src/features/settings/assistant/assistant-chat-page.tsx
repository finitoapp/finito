import { AbortError } from "@evolu/common"
import {
  type AssistantTurn,
  assistantConversationAtom,
  toAssistantMessages,
} from "@payky/app-shared/assistant-conversation"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { createAiModelDep } from "@payky/core/ai/ai-model"
import { askAssistant } from "@payky/core/ai/assistant"
import { createAssistantTools } from "@payky/core/ai/assistant-tools"
import type { AiAssistantAccess } from "@payky/core/evolu/device-client"
import { fetch as expoFetch } from "expo/fetch"
import Constants from "expo-constants"
import * as Crypto from "expo-crypto"
import { Redirect } from "expo-router"
import {
  atom,
  type PrimitiveAtom,
  useAtomValue,
  useSetAtom,
  useStore,
} from "jotai"
import CircleAlert from "lucide-react-native/icons/circle-alert"
import MessageSquarePlus from "lucide-react-native/icons/message-square-plus"
import RotateCw from "lucide-react-native/icons/rotate-cw"
import { useEffect, useRef, useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { evoluAtom } from "../../../atoms/evolu.ts"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { Icon } from "../../../components/ui/icon.tsx"
import { apiUrl } from "../../../core/native-env.ts"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize, radius } from "../../../theme/tokens.ts"
import { ChatComposer } from "../../shared/chat-composer.tsx"
import { usePrivacySettings } from "../privacy/use-privacy-settings.ts"

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
 * A chat with the assistant (ai/0004). It reads the merchant's local data
 * through its tools and answers through Payky's AI proxy. The conversation
 * stays in memory while the app runs; leaving the screen stops a reply that
 * is still coming. The assistant exists only on a device that allowed it
 * (ai/0004); anywhere else this sends the merchant to the privacy settings.
 */
export function AssistantChatPage() {
  const { aiAssistantAccess } = usePrivacySettings()
  if (aiAssistantAccess === "off") {
    return <Redirect href="/settings/about/privacy" />
  }
  return <AssistantChat access={aiAssistantAccess} />
}

function AssistantChat({ access }: { readonly access: Access }) {
  const { t } = useTranslation()
  const { turns, answeringAtom, ask, stop, startOver } =
    useAssistantConversation(access)
  const last = turns.at(-1)
  const answering = last?.status === "answering"

  return (
    <Screen
      followKey={answering ? last.id : null}
      // Web docks the composer card at the screen's edges, unframed.
      footer={
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
      }
    >
      <FadeHeader
        title={t("settings.assistant.title")}
        endAddon={
          turns.length === 0 ? undefined : (
            <Button
              size="icon"
              aria-label={t("settings.assistant.newConversation")}
              variant="ghost"
              onPress={startOver}
            >
              <Icon icon={MessageSquarePlus} size={20} color="primary" />
            </Button>
          )
        }
      />
      {turns.length === 0 ? (
        <EmptyConversation access={access} onAsk={ask} />
      ) : (
        // At the bottom, next to the composer, as web's `mt-auto` list.
        <YStack mt="auto" gap={8} aria-live="polite">
          {turns.map((turn, index) => (
            <Turn
              key={turn.id}
              turn={turn}
              first={index === 0}
              answeringAtom={answeringAtom}
              onRetry={() => ask(turn.question, turn.id)}
            />
          ))}
        </YStack>
      )}
    </Screen>
  )
}

/**
 * The conversation of the active account and access, and asking within it.
 * A conversation held with another access starts afresh, so replies about the
 * merchant's data are not sent again (ai/0004). The reply being streamed
 * lives in a screen-scoped atom that only its bubble reads, so a token
 * re-renders that bubble rather than the whole conversation; it joins the
 * conversation once it is complete.
 */
function useAssistantConversation(access: Access) {
  const appRun = useAppRun()
  const store = useStore()
  const ownerId = useAtomValue(evoluAtom).appOwner.id
  const conversation = useAtomValue(assistantConversationAtom)
  const setConversation = useSetAtom(assistantConversationAtom)
  const isCurrent = (current: typeof conversation) =>
    current.ownerId === ownerId && current.access === access
  const turns = isCurrent(conversation) ? conversation.turns : []
  const [answeringAtom] = useState(() =>
    atom<Answering>({ text: "", lookingUp: null })
  )
  const fiber = useRef<{ readonly abort: () => void } | null>(null)

  // Leaving the screen stops the reply; what came so far stays.
  useEffect(() => () => fiber.current?.abort(), [])

  const updateTurns = (
    update: (
      turns: ReadonlyArray<AssistantTurn>
    ) => ReadonlyArray<AssistantTurn>
  ) =>
    setConversation((current) => ({
      ownerId,
      access,
      turns: update(isCurrent(current) ? current.turns : []),
    }))

  /** Asks `question`, or asks the failed turn `retryOf` again. */
  const ask = async (question: string, retryOf?: string) => {
    const earlier = turns.filter((turn) => turn.id !== retryOf)
    const id = Crypto.randomUUID()
    updateTurns(() => [
      ...earlier,
      { id, question, reply: "", status: "answering" },
    ])
    store.set(answeringAtom, { text: "", lookingUp: null })

    await using run = appRun()
    const { tools, repoTools } = createAssistantTools(access, run, {
      // Served beside the API (ai/0003), which native reaches by URL.
      snapshotUrl: apiUrl("/repo-snapshot.json"),
      appVersion: Constants.expoConfig?.version ?? "unknown",
    })
    const current = run.abortable(
      askAssistant({
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
        // Expo's fetch, because React Native's own does not stream.
        ...createAiModelDep({
          baseURL: apiUrl("/api/ai/v1"),
          ownerId,
          fetch: expoFetch as unknown as typeof globalThis.fetch,
        }),
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
    <YStack mt="auto" self="center" maxW={320} gap={12} items="center">
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        color="muted-foreground"
        text="center"
      >
        {t(emptyKeys[access])}
      </Text>
      {suggestions[access].map((key) => (
        <Button
          size="sm"
          key={key}
          label={t(key)}
          variant="outline"
          onPress={() => onAsk(t(key))}
        />
      ))}
    </YStack>
  )
}

function Turn({
  turn,
  first,
  answeringAtom,
  onRetry,
}: {
  readonly turn: AssistantTurn
  readonly first: boolean
  readonly answeringAtom: PrimitiveAtom<Answering>
  readonly onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <Bubble own first={first}>
        {turn.question}
      </Bubble>
      {turn.status === "answering" ? (
        <AnsweringBubble answeringAtom={answeringAtom} />
      ) : turn.reply === "" ? null : (
        <Bubble own={false}>{turn.reply}</Bubble>
      )}
      {turn.status === "stopped" ? (
        <Text
          px={12}
          self="flex-start"
          fontSize={fontSize.xs}
          lineHeight={fontSize.xs}
          color="muted-foreground"
        >
          {t("settings.assistant.stopped")}
        </Text>
      ) : null}
      {turn.status === "failed" ? (
        <Button
          self="flex-start"
          size="xs"
          labelColor="destructive"
          label={t("settings.assistant.failed")}
          iconStart={CircleAlert}
          iconEnd={RotateCw}
          variant="ghost"
          onPress={onRetry}
        />
      ) : null}
    </>
  )
}

/**
 * The reply as it streams in. Until the first words it says it is thinking
 * or what a tool reads, if one does; a tool started after some words says it
 * below them.
 */
function AnsweringBubble({
  answeringAtom,
}: {
  readonly answeringAtom: PrimitiveAtom<Answering>
}) {
  const { t } = useTranslation()
  const { text, lookingUp } = useAtomValue(answeringAtom)
  const waitingFor = (
    <XStack
      items="center"
      gap={8}
      accessible
      aria-label={
        lookingUp === null
          ? t("settings.assistant.thinking")
          : t(lookingUpKeys[lookingUp])
      }
    >
      <TypingDots />
      {lookingUp === null ? null : (
        <Text
          fontSize={fontSize.xs}
          lineHeight={fontSize.xs}
          color="muted-foreground"
        >
          {t(lookingUpKeys[lookingUp])}
        </Text>
      )}
    </XStack>
  )
  if (text === "") return <Bubble own={false}>{waitingFor}</Bubble>
  return (
    <>
      <Bubble own={false}>{text}</Bubble>
      {lookingUp === null ? null : (
        <YStack px={12} self="flex-start">
          {waitingFor}
        </YStack>
      )}
    </>
  )
}

/**
 * Web's typing dots (`size-1.5 rounded-full bg-current`, muted).
 * ponytail: static; web bounces them, add an Animated loop if it matters.
 */
function TypingDots() {
  return (
    <XStack h={20} items="center" gap={4}>
      {[0, 1, 2].map((dot) => (
        <YStack
          key={dot}
          w={6}
          h={6}
          rounded={radius.full}
          bg="muted-foreground"
        />
      ))}
    </XStack>
  )
}

/**
 * Web's support-chat bubbles: the merchant on the primary colour, replies on
 * a card with the card ring. A question opens a turn, so it keeps more room
 * above it than the reply below it has.
 */
function Bubble({
  own,
  first = false,
  children,
}: {
  readonly own: boolean
  readonly first?: boolean
  readonly children: string | React.ReactNode
}) {
  return (
    <YStack
      maxW="85%"
      self={own ? "flex-end" : "flex-start"}
      mt={own && !first ? 12 : 0}
      px={12}
      py={8}
      rounded={radius["2xl"]}
      bg={own ? "primary" : "card"}
      borderWidth={own ? 0 : 1}
      borderColor="card-ring"
    >
      {typeof children === "string" ? (
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color={own ? "primary-foreground" : "card-foreground"}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </YStack>
  )
}
