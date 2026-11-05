import {
  Capacitor,
  type PluginListenerHandle,
  registerPlugin,
} from "@capacitor/core"
import {
  type AccountShareRefusal,
  AccountShareRequestSchema,
} from "@payky/core/integrations/payky-app/account-share-protocol"
import { z } from "zod"

/**
 * Bridge to the account request another app on this phone sends
 * (account/0008); the native side is
 * `android/app/src/main/java/me/payky/AccountSharePlugin.java` with its
 * `AccountShareActivity` trampoline. Android only: everywhere else there is
 * never a request and every call does nothing.
 */
interface AccountShareNativePlugin {
  getPendingRequest(): Promise<unknown>
  respond(options: {
    readonly requestId: string
    readonly approved: boolean
    readonly account?: string
    readonly error?: AccountShareRefusal
  }): Promise<{ readonly delivered: boolean }>
  setOverlayProtection(options: { readonly enabled: boolean }): Promise<void>
  addListener(
    eventName: "accountShareRequest",
    listener: (event: unknown) => void
  ): Promise<PluginListenerHandle>
}

const AccountShareNative =
  registerPlugin<AccountShareNativePlugin>("AccountShare")

/**
 * An open request as Payky's native half holds it: what the requester sent,
 * and who Android says the requester is.
 */
export const PendingAccountShareRequestSchema =
  AccountShareRequestSchema.extend({
    callerPackage: z.string().min(1),
    callerLabel: z.string().min(1),
    callerIcon: z
      .string()
      .startsWith("data:image/png;base64,")
      .nullable()
      .default(null),
    receivedAt: z.number(),
    expiresAt: z.number(),
  })
export type PendingAccountShareRequest = z.output<
  typeof PendingAccountShareRequestSchema
>

/**
 * The native event and `getPendingRequest` both carry `{ request }`; a request
 * that does not decode is `invalid`, with the id it can still be answered by.
 */
export type AccountShareRequestState =
  | { readonly kind: "none" }
  | { readonly kind: "open"; readonly request: PendingAccountShareRequest }
  | {
      readonly kind: "invalid"
      readonly requestId: string | null
      readonly unsupportedVersion: boolean
    }

const EnvelopeSchema = z.object({ request: z.unknown().optional() })
const LooseRequestSchema = z.object({
  requestId: z.string().optional(),
  v: z.unknown(),
})

export const readAccountShareRequestState = (
  raw: unknown
): AccountShareRequestState => {
  const envelope = EnvelopeSchema.safeParse(raw)
  const request = envelope.success ? envelope.data.request : undefined
  if (request === undefined || request === null) return { kind: "none" }
  const parsed = PendingAccountShareRequestSchema.safeParse(request)
  if (parsed.success) return { kind: "open", request: parsed.data }
  const loose = LooseRequestSchema.safeParse(request)
  return {
    kind: "invalid",
    requestId: loose.success ? (loose.data.requestId ?? null) : null,
    unsupportedVersion: loose.success && loose.data.v !== 1,
  }
}

export const isAccountSharePlatform = (): boolean =>
  Capacitor.getPlatform() === "android"

export const getPendingAccountShareRequest =
  async (): Promise<AccountShareRequestState> =>
    isAccountSharePlatform()
      ? readAccountShareRequestState(
          await AccountShareNative.getPendingRequest()
        )
      : { kind: "none" }

/** Calls `onChange` with every change of the open request; returns the unsubscribe. */
export const watchAccountShareRequest = async (
  onChange: (state: AccountShareRequestState) => void
): Promise<() => Promise<void>> => {
  if (!isAccountSharePlatform()) return async () => undefined
  const listener = await AccountShareNative.addListener(
    "accountShareRequest",
    (event) => onChange(readAccountShareRequestState(event))
  )
  return async () => {
    await listener.remove()
  }
}

/**
 * Answers request `requestId`: the approval carries the encoded account
 * (`encodeShareAnswer`), a refusal its reason. `false` when the request was no
 * longer open (expired, replaced, or the requester went away).
 */
export const respondToAccountShare = async (
  answer:
    | {
        readonly requestId: string
        readonly approved: true
        readonly account: string
      }
    | {
        readonly requestId: string
        readonly approved: false
        readonly error: AccountShareRefusal
      }
): Promise<boolean> => {
  if (!isAccountSharePlatform()) return false
  return (await AccountShareNative.respond(answer)).delivered
}

export const setAccountShareOverlayProtection = async (
  enabled: boolean
): Promise<void> => {
  if (isAccountSharePlatform()) {
    await AccountShareNative.setOverlayProtection({ enabled })
  }
}
