import { OwnerId } from "@evolu/common"
import { jsonCodec } from "@payky/core/zod-utils"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"
import {
  loadServerEnv,
  throwInvalidServerEnv,
} from "../../../../src/server/server-env.js"

/**
 * Payky's OpenAI-compatible chat endpoint (ai/0001): the app sends its
 * assistant's requests here with the account's Evolu owner id as the bearer
 * token, and the provider, its key and the model live only on the server.
 * Tool calls pass through untouched, because the tools run in the app over
 * its local data.
 */
export interface AiProxyConfig {
  /** An OpenAI-compatible base URL, without `/chat/completions`. */
  readonly upstreamUrl: string
  readonly upstreamApiKey: string | undefined
  readonly model: string
  readonly maxTokens: number
}

/** The deploy's configuration, read per request; `null` when invalid. */
const loadAiProxyConfig = (): AiProxyConfig | null => {
  const env = loadServerEnv(() =>
    createEnv({
      server: {
        // Gemini's OpenAI-compatible endpoint.
        PAYKY_AI_UPSTREAM_URL: z
          .url()
          .default("https://generativelanguage.googleapis.com/v1beta/openai"),
        PAYKY_AI_UPSTREAM_API_KEY: z.string().trim().min(1).optional(),
        PAYKY_AI_UPSTREAM_MODEL: z
          .string()
          .trim()
          .min(1)
          .default("gemini-3.5-flash-lite"),
        PAYKY_AI_MAX_TOKENS: z.coerce.number().int().positive().default(8192),
      },
      runtimeEnv: process.env,
      emptyStringAsUndefined: true,
      onValidationError: throwInvalidServerEnv,
    })
  )
  return env === null
    ? null
    : {
        upstreamUrl: env.PAYKY_AI_UPSTREAM_URL,
        upstreamApiKey: env.PAYKY_AI_UPSTREAM_API_KEY,
        model: env.PAYKY_AI_UPSTREAM_MODEL,
        maxTokens: env.PAYKY_AI_MAX_TOKENS,
      }
}

const ChatRequestJson = jsonCodec(
  z.looseObject({
    messages: z.array(z.unknown()).min(1),
    max_tokens: z.number().int().positive().optional(),
  })
)

const corsHeaders = {
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
} as const

/** OpenAI's error shape, so an OpenAI client shows the reason. */
const errorResponse = (status: number, message: string): Response =>
  Response.json(
    { error: { message, type: "payky_proxy_error" } },
    { status, headers: corsHeaders }
  )

const hasOwnerIdBearer = (request: Request): boolean =>
  OwnerId.is(
    /^Bearer (.+)$/u.exec(request.headers.get("authorization") ?? "")?.[1]
  )

export const handleAiChatRequest = async (
  request: Request,
  {
    config = loadAiProxyConfig(),
    fetch = globalThis.fetch,
  }: {
    readonly config?: AiProxyConfig | null
    readonly fetch?: typeof globalThis.fetch
  } = {}
): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        "access-control-allow-methods": "POST, OPTIONS",
        // The AI SDK adds headers of its own; allow whatever it asks for.
        "access-control-allow-headers":
          request.headers.get("access-control-request-headers") ??
          "authorization, content-type",
      },
    })
  }

  if (request.method !== "POST") {
    return errorResponse(405, "Method not allowed.")
  }

  // Every well-formed owner id is trusted (ai/0001).
  if (!hasOwnerIdBearer(request)) {
    return errorResponse(
      401,
      "Expected the account's owner id as the bearer token."
    )
  }

  if (config === null || config.upstreamApiKey === undefined) {
    return errorResponse(500, "The AI endpoint is not configured.")
  }

  const body = z.safeDecode(ChatRequestJson, await request.text())
  if (!body.success) {
    return errorResponse(400, "Expected a chat completion request.")
  }

  let upstream: Response
  try {
    upstream = await fetch(`${config.upstreamUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.upstreamApiKey}`,
        "content-type": "application/json",
      },
      body: z.encode(ChatRequestJson, {
        ...body.data,
        model: config.model,
        max_tokens: Math.min(
          body.data.max_tokens ?? config.maxTokens,
          config.maxTokens
        ),
        // Would otherwise get past the cap above: `n` multiplies it.
        max_completion_tokens: undefined,
        n: undefined,
      }),
      signal: request.signal,
    })
  } catch {
    return errorResponse(502, "The AI provider could not be reached.")
  }

  // Streamed as it arrives; an upstream error passes through with its status.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...corsHeaders,
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  })
}

const handleRequest = (request: Request): Promise<Response> =>
  handleAiChatRequest(request)

export const POST = handleRequest
export const OPTIONS = handleRequest

export default {
  fetch: handleRequest,
}
