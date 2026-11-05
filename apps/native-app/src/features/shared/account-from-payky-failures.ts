import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { AccountShareFailureReason } from "@payky/core/integrations/payky-app/account-share-protocol"

/**
 * What `AccountFromPayky` says for each way the request can end without an
 * account. A request Finito built that Payky still found malformed is, to the
 * user, the same as an answer Finito cannot read.
 */
export const accountFromPaykyFailureKeys = {
  rejected: "accountFromPayky.failed.rejected",
  busy: "accountFromPayky.failed.busy",
  expired: "accountFromPayky.failed.expired",
  noAccount: "accountFromPayky.failed.noAccount",
  demo: "accountFromPayky.failed.demo",
  unsupportedVersion: "accountFromPayky.failed.unsupportedVersion",
  invalidRequest: "accountFromPayky.failed.invalid",
  cancelled: "accountFromPayky.failed.cancelled",
  invalid: "accountFromPayky.failed.invalid",
  notInstalled: "accountFromPayky.failed.notInstalled",
} satisfies Record<AccountShareFailureReason, TranslationKey>
