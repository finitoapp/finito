import { describeDestination } from "@payky/app-shared/withdraw-destination"
import {
  amountFieldWarnings,
  buildWithdrawRequest,
  draftAmountSats,
  draftWithDestination,
  quoteErrorMessage,
  type WithdrawDraft,
  type WithdrawMethod,
  type WithdrawRequest,
  withdrawAllUnavailableKey,
} from "@payky/app-shared/withdraw-flow"
import type { AccountId } from "@payky/core/modules/account/account-types"
import {
  type PositiveInteger,
  PositiveIntegerSchema,
} from "@payky/core/modules/shared/schema"
import {
  quoteWithdrawal,
  type WithdrawalQuote,
} from "@payky/core/modules/withdraw/withdraw-actions"
import { parseWithdrawDestination } from "@payky/core/modules/withdraw/withdraw-destination-utils"
import { ONCHAIN_WITHDRAWAL_MIN_SATS } from "@payky/core/modules/withdraw/withdraw-utils"
import * as Clipboard from "expo-clipboard"
import ClipboardPaste from "lucide-react-native/icons/clipboard-paste"
import ScanLine from "lucide-react-native/icons/scan-line"
import { type ReactNode, useRef, useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { Field } from "../../components/field.tsx"
import {
  QR_SCAN_TYPES,
  ScanCodeScanner,
} from "../../components/scan-code-scanner.tsx"
import { Button } from "../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.tsx"
import { Checkbox } from "../../components/ui/checkbox.tsx"
import {
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Field as KitField,
} from "../../components/ui/field.tsx"
import { Input } from "../../components/ui/input.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../components/ui/toggle-group.tsx"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useBtcFiat, useLnurlPayMetadata } from "../../hooks/use-btc-fiat.ts"
import { useDebouncedValue } from "../../hooks/use-debounced-value.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatSatsAmount } from "../../lib/format-money.ts"
import type { LinkyContactState } from "./use-linky-contact.ts"
import { Collapsible, LightningAddress } from "./withdraw-parts.tsx"

/**
 * The typed destination as Spark sees it: parsed (`null` until it is one
 * that can be paid), its hint or error, and for a Lightning address the range
 * and comment length its LNURL metadata allows.
 */
function useWithdrawDestination(raw: string, method: WithdrawMethod) {
  const parsed = parseWithdrawDestination(raw)
  const { hint, error } = describeDestination(raw, parsed, method)
  const destination = parsed.ok && error === null ? parsed.value : null

  const lightningAddress = useDebouncedValue(
    destination?.kind === "lightning-address" ? destination.address : null,
    500
  )
  const metadata = useLnurlPayMetadata(lightningAddress)
  const addressSettled =
    destination?.kind === "lightning-address" &&
    lightningAddress === destination.address
  const checkingAddress =
    destination?.kind === "lightning-address" &&
    (!addressSettled || metadata.loading)
  const range = addressSettled && !metadata.loading ? metadata.data : null

  return {
    destination,
    hint,
    error,
    checkingAddress,
    range,
    addressUnavailable: addressSettled && !metadata.loading && metadata.failed,
    /** The longest LUD-12 comment the Lightning address accepts, 0 for none. */
    commentAllowed: range?.commentAllowed ?? 0,
    /** The invoice's own amount, which no amount typed can change. */
    invoiceAmountSats:
      destination?.kind === "lightning-invoice" ? destination.amountSats : null,
  }
}

export function WithdrawFormStep({
  accountId,
  availableSats,
  draft,
  onDraftChange,
  onReview,
}: {
  readonly accountId: AccountId
  readonly availableSats: number | null
  readonly draft: WithdrawDraft
  readonly onDraftChange: (draft: WithdrawDraft) => void
  readonly onReview: (request: WithdrawRequest, quote: WithdrawalQuote) => void
}) {
  const appRun = useAppRun()
  const { t } = useTranslation()
  return (
    <WithdrawFormFields
      method="spark"
      availableSats={availableSats}
      draft={draft}
      onDraftChange={onDraftChange}
      onQuote={async (request) => {
        await using run = appRun()
        const result = await run(quoteWithdrawal({ accountId, ...request }))
        if (!result.ok) return quoteErrorMessage(result.error, t)
        onReview(request, result.value)
        return null
      }}
    />
  )
}

/**
 * The form both wallets share: destination, amount, "withdraw all" and
 * options. `onQuote` fetches the wallet's quote and opens the review; it
 * returns the message to show, or `null` once the review is open.
 */
const idleContact: LinkyContactState = { kind: "idle" }

export function WithdrawFormFields({
  method,
  availableSats,
  draft,
  onDraftChange,
  onQuote,
  contact = idleContact,
  onQuoteContact,
  beforeDestination,
  canSubmit = true,
}: {
  readonly method: WithdrawMethod
  readonly availableSats: number | null
  readonly draft: WithdrawDraft
  readonly onDraftChange: (draft: WithdrawDraft) => void
  readonly onQuote: (request: WithdrawRequest) => Promise<string | null>
  /**
   * Finito's Cashu form also takes a Linky contact (withdraw/0015): where
   * the lookup of the typed text stands, and the quote for a resolved one.
   * `idle` leaves the Lightning parsing in charge.
   */
  readonly contact?: LinkyContactState
  readonly onQuoteContact?: (
    contact: Extract<LinkyContactState, { kind: "resolved" }>["contact"],
    amountSats: PositiveInteger | undefined
  ) => Promise<string | null>
  /** The wallet's own field above the destination, such as Cashu's mint. */
  readonly beforeDestination?: ReactNode
  readonly canSubmit?: boolean
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const fiat = useBtcFiat()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [scanning, setScanning] = useState(false)
  const toast = useToast()
  // `pending` lags a render behind: a second tap must not quote twice.
  const pendingRef = useRef(false)

  const update = (patch: Partial<WithdrawDraft>) => {
    setSubmitError(null)
    onDraftChange({ ...draft, ...patch })
  }

  const pasteDestination = async () => {
    try {
      update(
        draftWithDestination(draft, (await Clipboard.getStringAsync()).trim())
      )
    } catch {
      toast.error(t("withdraw.destination.pasteError"))
    }
  }

  const state = useWithdrawDestination(draft.destination, method)
  const { destination, invoiceAmountSats } = state
  const isContact = contact.kind !== "idle"
  const withdrawAllUnavailable = withdrawAllUnavailableKey(destination)
  const effectiveWithdrawAll =
    draft.withdrawAll && withdrawAllUnavailable === null
  const typedSats = draftAmountSats(draft, fiat)
  const onchainMinimumSats =
    destination?.kind === "onchain" ? ONCHAIN_WITHDRAWAL_MIN_SATS : null
  const { outOfRange, belowOnchainMinimum } = amountFieldWarnings({
    typedSats,
    range: state.range,
    withdrawAll: effectiveWithdrawAll,
    onchainMinimumSats,
  })
  const sats = (amount: number) => formatSatsAmount(amount, locale)

  const submit = async () => {
    if (pendingRef.current) return
    setSubmitError(null)
    if (isContact) {
      if (contact.kind === "resolving") return
      if (contact.kind === "failed") {
        setSubmitError(t(contact.key, { address: contact.address }))
        return
      }
      if (onQuoteContact === undefined) {
        setSubmitError(t("withdraw.destination.invalid"))
        return
      }
      const amount = PositiveIntegerSchema.safeParse(typedSats)
      if (!effectiveWithdrawAll && !amount.success) {
        setSubmitError(t("withdraw.amount.invalid"))
        return
      }
      pendingRef.current = true
      setPending(true)
      try {
        setSubmitError(
          await onQuoteContact(
            contact.contact,
            effectiveWithdrawAll || !amount.success ? undefined : amount.data
          )
        )
      } catch {
        setSubmitError(t("withdraw.quoteError.generic"))
      } finally {
        pendingRef.current = false
        setPending(false)
      }
      return
    }
    const built = buildWithdrawRequest({
      destination,
      destinationError: state.error,
      draft,
      typedSats,
      withdrawAll: effectiveWithdrawAll,
    })
    if (!built.ok) {
      setSubmitError(t(built.error))
      return
    }
    pendingRef.current = true
    setPending(true)
    try {
      setSubmitError(await onQuote(built.value))
    } catch {
      setSubmitError(t("withdraw.quoteError.generic"))
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("withdraw.form.title")}</CardTitle>
        <CardDescription>
          {t(
            method === "spark"
              ? "withdraw.form.description"
              : "withdraw.cashu.form.description"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {beforeDestination}

          <YStack gap="1.5">
            <Field
              label={t("withdraw.destination.label")}
              value={draft.destination}
              placeholder={t(
                method === "spark"
                  ? "withdraw.destination.placeholder"
                  : "withdraw.cashu.destinationPlaceholder"
              )}
              autoCapitalize="none"
              autoCorrect={false}
              error={
                state.error === null || isContact ? undefined : t(state.error)
              }
              onChangeText={(value) => {
                setSubmitError(null)
                onDraftChange(draftWithDestination(draft, value))
              }}
            />
            <XStack gap="2">
              <Button
                flex={1}
                size="default"
                variant="outline"
                iconStart={ClipboardPaste}
                label={t("withdraw.destination.paste")}
                onPress={() => void pasteDestination()}
              />
              <Button
                flex={1}
                size="default"
                variant="outline"
                iconStart={ScanLine}
                label={t("withdraw.destination.scan")}
                onPress={() => setScanning((on) => !on)}
              />
            </XStack>
            {scanning ? (
              // A scan only fills the field: parsing, review and PIN run as usual.
              <ScanCodeScanner
                types={QR_SCAN_TYPES}
                onScan={(raw) => {
                  setScanning(false)
                  update({ ...draftWithDestination(draft, raw.trim()) })
                }}
              />
            ) : null}
            {destination?.kind === "lightning-address" ? (
              <LightningAddress address={destination.address} />
            ) : null}
            {contact.kind === "resolved" ? (
              <Text fontSize={13} color="muted-foreground">
                {`${t("withdraw.destination.kind.linkyContact")} · ${contact.contact.address ?? contact.contact.npub}`}
              </Text>
            ) : contact.kind === "resolving" ? (
              <Text fontSize={13} color="muted-foreground">
                {t("withdraw.contact.checking")}
              </Text>
            ) : contact.kind === "failed" ? (
              <Text fontSize={13} color="destructive" role="alert">
                {t(contact.key, { address: contact.address })}
              </Text>
            ) : null}
            {state.hint === null || isContact ? null : (
              <Text fontSize={13} color="muted-foreground">
                {t(state.hint)}
              </Text>
            )}
            {state.checkingAddress ? (
              <Text fontSize={13} color="muted-foreground">
                {t("withdraw.destination.checkingAddress")}
              </Text>
            ) : null}
            {state.addressUnavailable ? (
              <Text fontSize={13} color="destructive" role="alert">
                {t("withdraw.error.lightningAddressUnavailable")}
              </Text>
            ) : null}
          </YStack>

          <YStack gap="1.5">
            <KitField>
              <XStack justify="space-between" items="center" gap="2">
                <FieldLabel>{t("withdraw.amount.label")}</FieldLabel>
                {invoiceAmountSats === null ? (
                  <ToggleGroup<WithdrawDraft["unit"]>
                    value={draft.unit}
                    onValueChange={(unit) => update({ unit, amount: "" })}
                    variant="outline"
                    size="sm"
                    aria-label={t("withdraw.amount.unit")}
                    disabled={effectiveWithdrawAll}
                  >
                    <ToggleGroupItem value="sats">
                      {t("withdraw.amount.unitSats")}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="fiat" disabled={fiat.rate === null}>
                      {fiat.currency}
                    </ToggleGroupItem>
                  </ToggleGroup>
                ) : null}
              </XStack>
              <Input
                aria-label={t("withdraw.amount.label")}
                value={
                  invoiceAmountSats !== null
                    ? String(invoiceAmountSats)
                    : draft.amount
                }
                disabled={effectiveWithdrawAll || invoiceAmountSats !== null}
                invalid={outOfRange || belowOnchainMinimum}
                keyboardType={
                  draft.unit === "sats" ? "number-pad" : "decimal-pad"
                }
                placeholder={
                  draft.unit === "sats"
                    ? t("withdraw.amount.placeholder")
                    : t("withdraw.amount.placeholderFiat", {
                        currency: fiat.currency,
                      })
                }
                onChangeText={(amount) => update({ amount })}
              />
              {invoiceAmountSats !== null ? (
                <Text fontSize={13} color="muted-foreground">
                  {t("withdraw.amount.fromInvoice")}
                </Text>
              ) : null}
              {state.range === null ? null : (
                <Text
                  fontSize={13}
                  color={outOfRange ? "destructive" : "muted-foreground"}
                >
                  {t("withdraw.amount.range", {
                    min: sats(state.range.minSendableSats),
                    max: sats(state.range.maxSendableSats),
                  })}
                </Text>
              )}
              {onchainMinimumSats === null ? null : (
                <Text
                  fontSize={13}
                  color={
                    belowOnchainMinimum ? "destructive" : "muted-foreground"
                  }
                >
                  {t("withdraw.amount.onchainMinimum", {
                    amount: sats(onchainMinimumSats),
                  })}
                </Text>
              )}
              {availableSats === null ? null : (
                <Text fontSize={13} color="muted-foreground">
                  {t("withdraw.amount.available", {
                    amount: sats(availableSats),
                  })}
                </Text>
              )}
            </KitField>
          </YStack>

          <KitField orientation="horizontal">
            <Checkbox
              checked={effectiveWithdrawAll}
              aria-label={t("withdraw.all.label")}
              disabled={withdrawAllUnavailable !== null}
              onCheckedChange={(withdrawAll) => update({ withdrawAll })}
            />
            <FieldContent>
              <FieldLabel>{t("withdraw.all.label")}</FieldLabel>
              <FieldDescription>
                {t(withdrawAllUnavailable ?? "withdraw.all.description")}
              </FieldDescription>
            </FieldContent>
          </KitField>

          <Collapsible
            label={t("withdraw.options.label")}
            defaultOpen={draft.recipientComment !== "" || draft.comment !== ""}
          >
            {state.commentAllowed > 0 ? (
              <YStack gap="1">
                <Field
                  label={t("withdraw.recipientComment.label")}
                  value={draft.recipientComment}
                  maxLength={state.commentAllowed}
                  onChangeText={(recipientComment) =>
                    update({ recipientComment })
                  }
                />
                <Text fontSize={13} color="muted-foreground">
                  {t("withdraw.recipientComment.hint", {
                    max: state.commentAllowed,
                  })}
                </Text>
              </YStack>
            ) : null}
            <YStack gap="1">
              <Field
                label={t("withdraw.comment.label")}
                value={draft.comment}
                maxLength={255}
                onChangeText={(comment) => update({ comment })}
              />
              <Text fontSize={13} color="muted-foreground">
                {t("withdraw.comment.hint")}
              </Text>
            </YStack>
          </Collapsible>

          <FieldError>{submitError ?? undefined}</FieldError>
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button
          size="default"
          label={pending ? t("withdraw.quotePending") : t("withdraw.continue")}
          pending={pending}
          disabled={!canSubmit}
          onPress={() => void submit()}
        />
      </CardFooter>
    </Card>
  )
}
