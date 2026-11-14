import { err, type Result } from "@evolu/common"
import type { TransferPayload } from "@payky/core/integrations/nostr/nostr-account-transfer"
import {
  type AccountShareFailedError,
  type AccountShareRequest,
  accountShareNotInstalled,
  parseShareResult,
} from "@payky/core/integrations/payky-app/account-share-protocol"
import { NativeModule, requireOptionalNativeModule } from "expo"
import { Platform } from "react-native"
import { z } from "zod"

/**
 * `modules/finito-account-request`: asks Payky on this phone for its account
 * (account/0008) with an Android intent launched for a result. There is no
 * iOS or web equivalent, so outside Android nothing is offered.
 */
declare class FinitoAccountRequestNativeModule extends NativeModule {
  canRequestAccount(): boolean
  requestAccount(
    version: number,
    requestId: string,
    code: string,
    requesterName: string
  ): Promise<unknown>
}

/** Matched by the Kotlin module: no activity took the intent. */
const PAYKY_NOT_INSTALLED_CODE = "PAYKY_NOT_INSTALLED"

const RawResultSchema = z.object({
  resultCode: z.number(),
  account: z.string().nullable().default(null),
  error: z.string().nullable().default(null),
})

/** The module's surface, so a test can stand in for it. */
interface FinitoAccountRequestModule {
  canRequestAccount(): boolean
  requestAccount: FinitoAccountRequestNativeModule["requestAccount"]
}

export interface FinitoAccountRequestDeps {
  /** `null` off Android and in a binary built before the module existed. */
  readonly module: FinitoAccountRequestModule | null
}

const defaultDeps = (): FinitoAccountRequestDeps => ({
  module:
    Platform.OS === "android"
      ? requireOptionalNativeModule<FinitoAccountRequestNativeModule>(
          "FinitoAccountRequest"
        )
      : null,
})

/**
 * Whether the installed Payky takes the request — not merely whether Payky is
 * installed. Always `false` off Android.
 */
export const canRequestAccountFromPayky = (
  deps: FinitoAccountRequestDeps = defaultDeps()
): boolean => deps.module?.canRequestAccount() === true

const isNotInstalledRejection = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === PAYKY_NOT_INSTALLED_CODE

/**
 * Opens Payky with `request` and waits for its answer, checked against the
 * request's id. A launch no activity took is `notInstalled`; any other
 * rejection (the bridge call dropped) is `cancelled`.
 */
export const requestAccountFromPayky = async (
  request: AccountShareRequest,
  deps: FinitoAccountRequestDeps = defaultDeps()
): Promise<Result<TransferPayload, AccountShareFailedError>> => {
  if (deps.module === null) return err(accountShareNotInstalled())
  try {
    const raw = RawResultSchema.safeParse(
      await deps.module.requestAccount(
        request.v,
        request.requestId,
        request.code,
        request.requesterName ?? ""
      )
    )
    if (!raw.success) {
      return err({ type: "AccountShareFailed", reason: "invalid" })
    }
    return parseShareResult(raw.data, request.requestId)
  } catch (error) {
    return err(
      isNotInstalledRejection(error)
        ? accountShareNotInstalled()
        : { type: "AccountShareFailed", reason: "cancelled" }
    )
  }
}
