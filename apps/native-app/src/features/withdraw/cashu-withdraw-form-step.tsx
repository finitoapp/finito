import {
  type CashuSendRequest,
  type CashuWithdrawRequest,
  cashuQuoteErrorMessage,
  cashuSendQuoteErrorMessage,
  formatMintLabel,
} from "@payky/app-shared/cashu-withdraw-flow"
import type { WithdrawDraft } from "@payky/app-shared/withdraw-flow"
import type { MintUrl } from "@payky/core/modules/cashu/cashu-types"
import {
  type CashuWithdrawalQuote,
  quoteCashuWithdrawal,
} from "@payky/core/modules/withdraw/withdraw-cashu-actions"
import {
  type CashuSendQuote,
  quoteCashuSend,
} from "@payky/core/modules/withdraw/withdraw-cashu-send-actions"
import { Text, XStack, YStack } from "tamagui"
import { Button } from "../../components/ui/button.tsx"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "../../components/ui/field.tsx"
import { useCashuAppRun } from "../../hooks/use-app-run.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatSatsAmount } from "../../lib/format-money.ts"
import { useLinkyContact } from "./use-linky-contact.ts"
import { WithdrawFormFields } from "./withdraw-form-step.tsx"

/**
 * The Cashu withdrawal form: which mint (only when more than one holds
 * ecash), then the same destination, amount, "withdraw all" and options as
 * Spark's, minus on-chain and amountless invoices (withdraw/0011,
 * withdraw/0014). The destination also takes a Linky contact, a name, an
 * npub or a profile link, which gets a token instead of a melt
 * (withdraw/0015).
 */
export function CashuWithdrawFormStep({
  funded,
  mint,
  onMintChange,
  draft,
  onDraftChange,
  onReview,
  onReviewSend,
}: {
  /** The mints holding ecash, with their balances. */
  readonly funded: ReadonlyArray<readonly [MintUrl, number]>
  readonly mint: MintUrl | null
  readonly onMintChange: (mint: MintUrl) => void
  readonly draft: WithdrawDraft
  readonly onDraftChange: (draft: WithdrawDraft) => void
  readonly onReview: (
    request: CashuWithdrawRequest,
    quote: CashuWithdrawalQuote
  ) => void
  readonly onReviewSend: (
    request: CashuSendRequest,
    quote: CashuSendQuote
  ) => void
}) {
  const cashuAppRun = useCashuAppRun()
  const { t } = useTranslation()
  const locale = useLocale()
  const mintBalance =
    funded.find(([candidate]) => candidate === mint)?.[1] ?? null
  const contact = useLinkyContact(draft.destination)

  return (
    <WithdrawFormFields
      method="cashu"
      availableSats={mintBalance}
      draft={draft}
      onDraftChange={onDraftChange}
      canSubmit={mint !== null}
      contact={contact}
      onQuoteContact={async (resolved, amountSats) => {
        if (mint === null) return null
        const request: CashuSendRequest = {
          mint,
          recipient: resolved,
          amountSats,
        }
        await using run = await cashuAppRun()
        const result = await run(quoteCashuSend(request))
        if (!result.ok) return cashuSendQuoteErrorMessage(result.error, t)
        onReviewSend(request, result.value)
        return null
      }}
      beforeDestination={
        funded.length <= 1 ? null : (
          <Field>
            <FieldLabel>{t("withdraw.cashu.mint")}</FieldLabel>
            {funded.length === 0 ? (
              <FieldDescription>{t("withdraw.cashu.noFunds")}</FieldDescription>
            ) : (
              <YStack gap="2">
                {funded.map(([candidate, balance]) => (
                  <Button
                    key={candidate}
                    size="default"
                    variant={candidate === mint ? "default" : "outline"}
                    aria-selected={candidate === mint}
                    onPress={() => onMintChange(candidate)}
                  >
                    <XStack
                      flex={1}
                      justify="space-between"
                      items="center"
                      gap="3"
                    >
                      <Text flex={1} numberOfLines={1}>
                        {formatMintLabel(candidate)}
                      </Text>
                      <Text>
                        {t("withdraw.sats", {
                          amount: formatSatsAmount(balance, locale),
                        })}
                      </Text>
                    </XStack>
                  </Button>
                ))}
              </YStack>
            )}
          </Field>
        )
      }
      onQuote={async (built) => {
        if (mint === null) return null
        const request: CashuWithdrawRequest = { mint, ...built }
        await using run = await cashuAppRun()
        const result = await run(quoteCashuWithdrawal(request))
        if (!result.ok) return cashuQuoteErrorMessage(result.error, t)
        onReview(request, result.value)
        return null
      }}
    />
  )
}
