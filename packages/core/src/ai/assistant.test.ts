import { createConsole, testCreateRun } from "@evolu/common"
import { simulateReadableStream } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { describe, expect, test } from "vitest"
import { createBill } from "../modules/bill/bill-actions.ts"
import { NonEmptyString255, PositiveInteger } from "../modules/shared/schema.ts"
import { createEvoluTest } from "../testing/evolu.ts"
import { evoluTestDeps } from "../testing/evolu-deps.ts"
import { askAssistant, createDataTools, recentMessages } from "./assistant.ts"

const usage = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
}

describe("askAssistant", () => {
  test("runs a data tool locally and hands its result back to the model", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const aiModel = new MockLanguageModelV4({
      doStream: [
        {
          stream: simulateReadableStream({
            chunks: [
              {
                type: "tool-call",
                toolCallId: "call-1",
                toolName: "listOpenBills",
                input: "{}",
              },
              {
                type: "finish",
                finishReason: { unified: "tool-calls", raw: undefined },
                usage,
              },
            ],
          }),
        },
        {
          stream: simulateReadableStream({
            chunks: [
              { type: "text-start", id: "text-1" },
              { type: "text-delta", id: "text-1", delta: "One open bill." },
              { type: "text-end", id: "text-1" },
              {
                type: "finish",
                finishReason: { unified: "stop", raw: undefined },
                usage,
              },
            ],
          }),
        },
      ],
    })
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      console: createConsole(),
      aiModel,
    })
    await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: NonEmptyString255("Dinner"),
        tableId: null,
        currency: "CZK",
      })
    )

    const streamed: string[] = []
    const toolCalls: string[] = []
    const reply = await run.orThrow(
      askAssistant({
        appName: "Finito",
        messages: [{ role: "user", content: "What is open?" }],
        tools: createDataTools(run),
        onText: (text) => streamed.push(text),
        onToolCall: (toolName) => toolCalls.push(toolName),
      })
    )

    expect(reply).toBe("One open bill.")
    expect(streamed.join("")).toBe(reply)
    expect(toolCalls).toEqual(["listOpenBills"])
    expect(JSON.stringify(aiModel.doStreamCalls[1]?.prompt)).toContain("Dinner")
    const systemPrompt = JSON.stringify(aiModel.doStreamCalls[0]?.prompt[0])
    expect(systemPrompt).toContain("assistant inside Finito")
    expect(systemPrompt).not.toContain("Payky")
  })

  test("returns AiRequestError when the model endpoint fails", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      console: createConsole(),
      aiModel: new MockLanguageModelV4({
        doStream: () => Promise.reject(new Error("connection refused")),
      }),
    })

    const result = await run(
      askAssistant({
        appName: "Finito",
        messages: [{ role: "user", content: "Hi" }],
        tools: {},
        onText: () => undefined,
      })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { type: "AiRequestError" },
    })
  })

  test("stops with the reply so far when its run is aborted", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      console: createConsole(),
      aiModel: new MockLanguageModelV4({
        doStream: {
          stream: simulateReadableStream({
            chunks: [
              { type: "text-start", id: "text-1" },
              { type: "text-delta", id: "text-1", delta: "Half" },
              { type: "text-delta", id: "text-1", delta: " of it." },
              { type: "text-end", id: "text-1" },
              {
                type: "finish",
                finishReason: { unified: "stop", raw: undefined },
                usage,
              },
            ],
            chunkDelayInMs: 50,
          }),
        },
      }),
    })

    const streamed: string[] = []
    const fiber = run.abortable(
      askAssistant({
        appName: "Finito",
        messages: [{ role: "user", content: "Hi" }],
        tools: {},
        onText: (text) => {
          streamed.push(text)
          fiber.abort()
        },
      })
    )

    expect(await fiber).toEqual({ ok: true, value: "Half" })
    expect(streamed).toEqual(["Half"])
  })
})

describe("recentMessages", () => {
  test("keeps the last twenty messages, starting at a question", () => {
    const conversation = Array.from({ length: 25 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: String(index),
    }))

    const recent = recentMessages(conversation)

    expect(recent.map((message) => message.content)).toEqual(
      Array.from({ length: 19 }, (_, index) => String(index + 6))
    )
  })
})
