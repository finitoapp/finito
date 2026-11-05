import { formatMintLabel } from "@payky/app-shared/cashu-withdraw-flow"
import { formatDateTime } from "@payky/app-shared/format-date"
import { useNow } from "@payky/app-shared/use-now"
import {
  cashuSendRecipientText,
  reusableWithdrawalDestination,
  withdrawalFailureKeys,
  withdrawalKindKeys,
  withdrawalMethod,
} from "@payky/app-shared/withdraw-display"
import {
  pendingLightningText,
  pendingLightningTimes,
} from "@payky/app-shared/withdraw-flow"
import { activeSparkAccountByIdQuery } from "@payky/core/modules/account/account-spark-queries"
import type { AccountId } from "@payky/core/modules/account/account-types"
import { TimestampMs } from "@payky/core/modules/shared/schema"
import {
  confirmOnchainWithdrawalSent,
  markWithdrawalFailed,
} from "@payky/core/modules/withdraw/withdraw-actions"
import {
  toWithdrawalView,
  type WithdrawalView,
  withdrawalDetailQuery,
} from "@payky/core/modules/withdraw/withdraw-queries"
import { WithdrawalId } from "@payky/core/modules/withdraw/withdraw-types"
import { router, useLocalSearchParams } from "expo-router"
import { useAtomValue, useStore } from "jotai"
import ExternalLink from "lucide-react-native/icons/external-link"
import { Suspense } from "react"
import { Linking, ScrollView } from "react-native"
import { Text, useTheme, XStack, YStack } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import { evoluCounterAtom } from "../../atoms/evolu-counter.ts"
import { DetailRow } from "../../components/detail-row.tsx"
import { FadeHeader } from "../../components/fade-header.tsx"
import { LoadingView } from "../../components/loading-view.tsx"
import { NotFoundCard } from "../../components/not-found-card.tsx"
import { SafeAreaView } from "../../components/safe-area-view.tsx"
import { screenPaddingX } from "../../components/screen.tsx"
import { Button } from "../../components/ui/button.tsx"
import { Card, CardContent } from "../../components/ui/card.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { useRequirePermission } from "../../core/use-access.ts"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useAsyncValue } from "../../hooks/use-async-value.ts"
import { useConfirm } from "../../hooks/use-confirm.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatSatsAmount } from "../../lib/format-money.ts"
import { BitcoinAmount } from "../shared/bitcoin-amount.tsx"
import { useSparkBalance } from "../shared/use-spark-balance.ts"
import { Collapsible, Mono, WithdrawalStatusBadge } from "./withdraw-parts.tsx"
import { withdrawRoutes } from "./withdraw-routes.ts"

const TXID_REFETCH_INTERVAL_MS = 30_000

/** `/withdraw/[withdrawalId]`: one withdrawal; its state is derived from what is recorded (withdraw/0003). */
export function WithdrawDetailPage() {
  const theme = useTheme()
  const { t } = useTranslation()
  const { withdrawalId } = useLocalSearchParams<{ withdrawalId: string }>()
  const parsed = WithdrawalId.safeParse(withdrawalId)

  return (
    <SafeAreaView
      style={{
        flex: 1,
        paddingHorizontal: screenPaddingX,
        backgroundColor: theme.background.val,
      }}
    >
      <FadeHeader title={t("withdraw.detail.title")} />
      {parsed.success ? (
        <Suspense fallback={<LoadingView />}>
          <WithdrawDetail withdrawalId={parsed.data} />
        </Suspense>
      ) : (
        <NotFoundCard messageKey="withdraw.detail.notFound" />
      )}
    </SafeAreaView>
  )
}

function WithdrawDetail({
  withdrawalId,
}: {
  readonly withdrawalId: WithdrawalId
}) {
  const [row] = useEvoluQuery(withdrawalDetailQuery(withdrawalId)).data
  const view = row === undefined ? null : toWithdrawalView(row)
  if (view === null) {
    return <NotFoundCard messageKey="withdraw.detail.notFound" />
  }
  return (
    <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
      <WithdrawalStatusCard view={view} />
      <WithdrawalDetailsCard view={view} />
    </ScrollView>
  )
}

/** The pending Lightning text, which changes at two moments (withdraw/0003, withdraw/0007). */
function PendingLightningText({ view }: { readonly view: WithdrawalView }) {
  const { t } = useTranslation()
  const { device } = useAtomValue(accountAtom)
  const ownDevice = view.deviceId !== null && view.deviceId === device.id
  const times = pendingLightningTimes({ createdAt: view.createdAt, ownDevice })
  const now = useNow([
    TimestampMs(times.timeoutAt),
    TimestampMs(times.windowEndsAt),
  ])
  return (
    <Text>
      {pendingLightningText({
        times,
        now: now.getTime(),
        ownDevice,
        deviceName: view.deviceName,
        t,
      })}
    </Text>
  )
}

/** Offered only after a failure confirmed by something other than time (withdraw/0007). */
function NewWithdrawalButton({ view }: { readonly view: WithdrawalView }) {
  const { t } = useTranslation()
  const destination = reusableWithdrawalDestination(view.target)
  const route = withdrawRoutes[withdrawalMethod(view.target)].new
  return (
    <>
      {destination === null ? (
        <Text color="muted-foreground">
          {t("withdraw.detail.invoiceRenewHint")}
        </Text>
      ) : null}
      <Button
        size="lg"
        label={t("withdraw.detail.newWithdrawal")}
        onPress={() =>
          router.push(
            destination === null
              ? route
              : { pathname: route, params: { destination } }
          )
        }
      />
    </>
  )
}

/**
 * "The money did not leave" / "The money left" for an on-chain withdrawal
 * whose outcome is not certain (withdraw/0002). Neither moves money, so the
 * owner's ordinary `admin` gate is enough (access/0007).
 */
function OnchainResolutionButtons({
  view,
  offerNotSent,
}: {
  readonly view: WithdrawalView
  readonly offerNotSent: boolean
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const { require } = useRequirePermission()
  const confirm = useConfirm()
  const runToast = useRunToast()
  const store = useStore()
  const { device } = useAtomValue(accountAtom)
  const balance = useSparkBalance(view.accountId)
  if (view.target.kind !== "onchain") return null
  const debited = formatSatsAmount(
    view.amountSats + view.target.quotedFeeSats,
    locale
  )

  const resolve = async (sent: boolean) => {
    const accountVersion = store.get(evoluCounterAtom)
    const isCurrentAccount = () =>
      store.get(evoluCounterAtom) === accountVersion
    if (!isCurrentAccount()) return
    if (!(await require("admin", "access.action.withdraw"))) return
    if (!isCurrentAccount()) return
    const confirmed = await confirm({
      title: t(
        sent
          ? "withdraw.detail.markSent.title"
          : "withdraw.detail.markNotSent.title"
      ),
      description: sent
        ? t("withdraw.detail.markSent.description", { amount: debited })
        : t("withdraw.detail.markNotSent.description", { amount: debited }),
      confirmLabel: t(
        sent ? "withdraw.detail.markSent" : "withdraw.detail.markNotSent"
      ),
      cancelLabel: t("withdraw.detail.cancel"),
    })
    if (!confirmed || !isCurrentAccount()) return
    await runToast(async (run) => {
      if (sent) {
        await run.orThrow(
          confirmOnchainWithdrawalSent({
            withdrawalId: view.id,
            deviceId: device.id,
          })
        )
      } else {
        await run.ok(
          markWithdrawalFailed({ withdrawalId: view.id, reason: "manual" })
        )
      }
      return undefined
    })
  }

  return (
    <YStack gap="2">
      {balance === null ? null : (
        <Text fontSize={13} color="muted-foreground">
          {t("withdraw.detail.balanceNow", {
            balance: formatSatsAmount(balance, locale),
            amount: debited,
          })}
        </Text>
      )}
      {offerNotSent ? (
        <Button
          size="lg"
          label={t("withdraw.detail.markNotSent")}
          variant="outline"
          onPress={() => void resolve(false)}
        />
      ) : null}
      <Button
        size="lg"
        label={t("withdraw.detail.markSent")}
        variant="outline"
        onPress={() => void resolve(true)}
      />
    </YStack>
  )
}

function WithdrawalStatusCard({ view }: { readonly view: WithdrawalView }) {
  const { t } = useTranslation()
  const { state, target } = view

  return (
    <Card>
      <CardContent>
        <YStack gap="3">
          <XStack justify="space-between" items="flex-start" gap="2">
            <BitcoinAmount sats={view.amountSats} align="start" />
            <WithdrawalStatusBadge view={view} />
          </XStack>
          {state.status === "pending" ? (
            target.kind === "lightning" ? (
              <PendingLightningText view={view} />
            ) : target.kind === "cashu" ? (
              <Text>{t("withdraw.detail.pending.cashu")}</Text>
            ) : target.kind === "cashuSend" ? (
              <Text>{t("withdraw.detail.pending.cashuSend")}</Text>
            ) : (
              <>
                <Text>{t("withdraw.detail.onchainUncertain")}</Text>
                <OnchainResolutionButtons view={view} offerNotSent />
              </>
            )
          ) : state.status === "failed" ? (
            <>
              <Text>{t(withdrawalFailureKeys[state.reason])}</Text>
              {state.reason === "not-created" ? (
                // Derived from time, not confirmed: a new withdrawal to the same
                // Lightning address could pay twice (withdraw/0007).
                <Text color="muted-foreground">
                  {t("withdraw.detail.failed.notCreatedHint")}
                </Text>
              ) : (
                <NewWithdrawalButton view={view} />
              )}
              {state.reason === "manual" ? (
                <OnchainResolutionButtons view={view} offerNotSent={false} />
              ) : null}
            </>
          ) : (
            <>
              {target.kind === "onchain" && state.coopExitRequestId === null ? (
                <Text color="muted-foreground">
                  {t("withdraw.detail.manualConfirmed")}
                </Text>
              ) : null}
              {state.movementDeleted ? (
                <Text color="muted-foreground">
                  {t("withdraw.detail.movementDeleted")}
                </Text>
              ) : null}
            </>
          )}
        </YStack>
      </CardContent>
    </Card>
  )
}

/**
 * The on-chain txid the withdrawal action recorded is often still `null` (the
 * SDK returns before broadcasting) and nobody writes it later, so the detail
 * reads it from the SDK for display only (withdraw/0002).
 */
function OnchainTxid({
  accountId,
  txid,
  coopExitRequestId,
}: {
  readonly accountId: AccountId
  readonly txid: string | null
  readonly coopExitRequestId: string | null
}) {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const [sparkAccount] = useEvoluQuery(
    activeSparkAccountByIdQuery(accountId)
  ).data
  const secret = sparkAccount?.secret
  const lookup = useAsyncValue(
    txid === null && coopExitRequestId !== null && secret !== undefined
      ? `txid:${coopExitRequestId}`
      : null,
    async () => {
      if (coopExitRequestId === null || secret === undefined) return null
      await using run = appRun()
      await using wallet = await run.deps.sparkWallet.create(secret)
      return (await wallet.getCoopExitRequest(coopExitRequestId))?.txid ?? null
    },
    // The SSP broadcasts after the withdrawal returns: keep asking until the
    // txid shows up, then stop.
    { refetchMs: TXID_REFETCH_INTERVAL_MS, done: (found) => found !== null }
  )
  const shown = txid ?? lookup.data

  if (coopExitRequestId === null && txid === null) return null

  return (
    <DetailRow label={t("withdraw.detail.txid")} stacked>
      {shown !== null ? (
        <YStack gap="2">
          <Mono value={shown} />
          <XStack
            items="center"
            gap="1"
            role="link"
            aria-label={t("withdraw.detail.viewOnExplorer")}
            cursor="web:pointer"
            onPress={() =>
              void Linking.openURL(`https://mempool.space/tx/${shown}`)
            }
          >
            <Icon icon={ExternalLink} size={12} />
            <Text fontSize="xs" lineHeight="xs" textDecorationLine="underline">
              {t("withdraw.detail.viewOnExplorer")}
            </Text>
          </XStack>
        </YStack>
      ) : (
        <Text color="muted-foreground">
          {lookup.failed
            ? t("withdraw.detail.txidError")
            : t("withdraw.detail.txidPending")}
        </Text>
      )}
    </DetailRow>
  )
}

function WithdrawalDetailsCard({ view }: { readonly view: WithdrawalView }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const { state, target } = view
  // A Cashu melt's fee reserve is the mint's and is not recorded.
  const feeSats =
    state.status === "done"
      ? state.feeSats
      : target.kind === "onchain"
        ? target.quotedFeeSats
        : target.kind === "lightning"
          ? target.maxFeeSats
          : null
  const isMaxFee = state.status !== "done" && target.kind === "lightning"

  return (
    <Card>
      <CardContent>
        <YStack gap="3">
          <DetailRow label={t("withdraw.detail.type")}>
            {t(withdrawalKindKeys[target.kind])}
          </DetailRow>
          {target.kind === "onchain" ? (
            <DetailRow label={t("withdraw.detail.destination")} stacked>
              <Mono value={target.onchainAddress} />
            </DetailRow>
          ) : target.kind === "cashuSend" ? (
            <DetailRow label={t("withdraw.detail.destination")} stacked>
              {target.recipientAddress === null ? (
                <Mono value={cashuSendRecipientText(target)} />
              ) : (
                <Text>{target.recipientAddress}</Text>
              )}
            </DetailRow>
          ) : (
            <DetailRow label={t("withdraw.detail.destination")}>
              {target.lightningAddress ??
                t("withdraw.destination.kind.lightningInvoice")}
            </DetailRow>
          )}
          {target.kind === "cashu" || target.kind === "cashuSend" ? (
            <DetailRow label={t("withdraw.detail.mint")}>
              {formatMintLabel(target.mintUrl)}
            </DetailRow>
          ) : null}
          {view.comment === null ? null : (
            <DetailRow label={t("withdraw.detail.comment")} stacked>
              {view.comment}
            </DetailRow>
          )}
          <DetailRow label={t("withdraw.detail.amount")}>
            <BitcoinAmount sats={view.amountSats} />
          </DetailRow>
          {feeSats === null ? null : (
            <>
              <DetailRow
                label={t(
                  isMaxFee ? "withdraw.detail.maxFee" : "withdraw.detail.fee"
                )}
              >
                <BitcoinAmount sats={feeSats} />
              </DetailRow>
              <DetailRow label={t("withdraw.detail.total")} emphasize>
                <BitcoinAmount
                  sats={
                    state.status === "done"
                      ? state.debitedSats
                      : view.amountSats + feeSats
                  }
                />
              </DetailRow>
            </>
          )}
          <DetailRow label={t("withdraw.detail.date")}>
            {formatDateTime(new Date(view.createdAt), locale)}
          </DetailRow>
          {view.deviceName === null ? null : (
            <DetailRow label={t("withdraw.detail.device")}>
              {view.deviceName}
            </DetailRow>
          )}
          {state.status === "done" && target.kind === "onchain" ? (
            <OnchainTxid
              accountId={view.accountId}
              txid={state.txid}
              coopExitRequestId={state.coopExitRequestId}
            />
          ) : null}
          {target.kind === "cashu" ? (
            <Collapsible label={t("withdraw.detail.technical")}>
              <DetailRow label={t("withdraw.detail.invoice")} stacked>
                <Mono value={target.lnInvoice} />
              </DetailRow>
              <DetailRow label={t("withdraw.detail.cashuQuoteId")} stacked>
                <Mono value={target.quoteId} />
              </DetailRow>
            </Collapsible>
          ) : null}
          {target.kind === "cashuSend" && target.sendOperationId !== null ? (
            <Collapsible label={t("withdraw.detail.technical")}>
              <DetailRow label={t("withdraw.detail.cashuOperationId")} stacked>
                <Mono value={target.sendOperationId} />
              </DetailRow>
            </Collapsible>
          ) : null}
          {target.kind === "lightning" ? (
            <Collapsible label={t("withdraw.detail.technical")}>
              <DetailRow label={t("withdraw.detail.invoice")} stacked>
                <Mono value={target.lnInvoice} />
              </DetailRow>
              {state.status === "done" && state.preImage !== null ? (
                <DetailRow label={t("withdraw.detail.preimage")} stacked>
                  <Mono value={state.preImage} />
                </DetailRow>
              ) : null}
              <DetailRow label={t("withdraw.detail.sparkTransferId")} stacked>
                <Mono value={target.sparkTransferId} />
              </DetailRow>
            </Collapsible>
          ) : null}
        </YStack>
      </CardContent>
    </Card>
  )
}
