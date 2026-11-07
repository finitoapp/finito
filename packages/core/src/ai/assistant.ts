import { type ConsoleDep, err, ok, type Run, type Task } from "@evolu/common"
import {
  isStepCount,
  type ModelMessage,
  streamText,
  type ToolSet,
  tool,
} from "ai"
import { z } from "zod"
import { defineError } from "../error.ts"
import { listOpenBills } from "../modules/bill/bill-actions.ts"
import { loadBill } from "../modules/bill/bill-guards.ts"
import { BillId } from "../modules/bill/bill-types.ts"
import { loadCalculatedBillLineSummaries } from "../modules/bill-line/bill-line-actions.ts"
import { latestPaymentsQuery } from "../modules/payment/payment-queries.ts"
import type { EvoluDep } from "../modules/shared/evolu-deps.ts"
import type { AiModelDep } from "./ai-model.ts"

/** The model endpoint failed: unreachable, rejected the key, or broke off. */
const createAiRequestError = defineError("AiRequestError")<{
  readonly error: unknown
}>()
export type AiRequestError = ReturnType<typeof createAiRequestError>

const maxSteps = 10

/** How much of a long conversation the model sees, to bound its tokens. */
const maxMessages = 20

/** The instructions the model gets, naming the app it answers inside. */
const systemPrompt = (
  appName: string
) => `You are the assistant inside ${appName}, a point-of-sale app for merchants that takes Bitcoin (Lightning), bank transfer, card and cash payments.
Answer the merchant's question. Use the data tools, when you have them, to look at their bills and payments, and the documentation and source code tools, when you have them, to explain how ${appName} behaves. Without the data tools you cannot see the merchant's data; say so when a question needs it.
Money amounts in the data are integer minor units of the row's currency (cents for fiat, sats for bitcoin).
If the code suggests a bug, say it only looks like one, and name the file and line that makes you think so.
Reply in the language of the question. Keep the answer short and readable for a merchant, not a developer.
Write plain text, never Markdown: no asterisks, hashes, backticks or tables. Use line breaks, and a hyphen at the start of a line for a list.`

/**
 * Read-only tools over the merchant's local Evolu data. Whatever they return
 * leaves the device to the model, so the app offers them only with the
 * merchant's consent (ai/0004).
 */
export const createDataTools = (run: Run<EvoluDep>) => ({
  listOpenBills: tool({
    description: "List open bills with their items.",
    inputSchema: z.object({}),
    execute: () => run.ok(listOpenBills()),
  }),
  getBill: tool({
    description: "Show one bill and its lines by id.",
    // Branded ids have no JSON Schema form, so the model sends a plain string.
    inputSchema: z.object({ id: z.string() }),
    execute: async (input) => {
      const parsed = BillId.safeParse(input.id)
      if (!parsed.success) return { error: "Not a bill id" }
      const id = parsed.data
      const bill = await run(loadBill(id))
      if (!bill.ok) return { error: "Bill not found" }
      return {
        bill: bill.value,
        lines: await run.ok(loadCalculatedBillLineSummaries(id)),
      }
    },
  }),
  latestPayments: tool({
    description: "List the most recent payments, newest first.",
    inputSchema: z.object({ limit: z.number().int().min(1).max(50) }),
    execute: ({ limit }) =>
      run.deps.evolu.loadQuery(latestPaymentsQuery(limit)),
  }),
})

/**
 * The last `maxMessages` of a conversation, starting at a question: a
 * provider may refuse a conversation that opens with its own reply.
 */
export const recentMessages = (
  messages: ReadonlyArray<ModelMessage>
): ModelMessage[] => {
  const recent = messages.slice(-maxMessages)
  const firstQuestion = recent.findIndex((message) => message.role === "user")
  return firstQuestion === -1 ? [] : recent.slice(firstQuestion)
}

/**
 * Answers the last question of a conversation with the model from
 * `AiModelDep`, streaming the reply through `onText`, and resolves to the full
 * reply. Text already streamed stays streamed when the request then fails
 * with `AiRequestError`. Aborting the run stops the request and resolves to
 * the reply so far.
 *
 * `tools` are all the model may call: the data tools (`createDataTools`), the
 * documentation and source code tools, or none.
 * `onToolCall` names each tool as the model starts it, so a caller can show
 * what the wait is for. `appName` is the brand the app ships as, which the
 * assistant introduces itself and the app by.
 */
export const askAssistant =
  ({
    appName,
    messages,
    tools,
    onText,
    onToolCall,
  }: {
    readonly appName: string
    readonly messages: ReadonlyArray<ModelMessage>
    readonly tools: ToolSet
    readonly onText: (text: string) => void
    readonly onToolCall?: (toolName: string) => void
  }): Task<string, AiRequestError, AiModelDep & ConsoleDep> =>
  async (run) => {
    let streamError: unknown = null
    const result = streamText({
      model: run.deps.aiModel,
      system: systemPrompt(appName),
      messages: recentMessages(messages),
      tools,
      stopWhen: isStepCount(maxSteps),
      abortSignal: run.signal,
      onToolExecutionStart: ({ toolCall }) => {
        run.deps.console.debug(
          `[ai] ${toolCall.toolName} ${JSON.stringify(toolCall.input)}`
        )
        onToolCall?.(toolCall.toolName)
      },
      onError: ({ error }) => {
        streamError = error
      },
    })

    let reply = ""
    for await (const text of result.textStream) {
      reply += text
      onText(text)
    }
    if (streamError !== null) {
      return err(createAiRequestError({ error: streamError }))
    }

    return ok(reply)
  }
