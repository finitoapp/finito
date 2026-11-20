import {
  type ConsoleDep,
  type LockManagerDep,
  ok,
  sqliteTrue,
  type Task,
} from "@evolu/common"

import type {
  EvoluOwnerDep,
  SelfPayDefaultRelaysDep,
  TableSelfPayRootDep,
} from "../../deps.ts"
import type { NostrRelayDep } from "../../integrations/nostr/nostr-relay-client.ts"
import { fiatBankAccountQuery } from "../../modules/account/account-queries.ts"
import {
  loadUnrecordedBankTransactions,
  reconcileUnclaimedBankTransactions,
  recordBankTransactions,
} from "../../modules/reconciliation-claim/bank-sync-actions.ts"
import { deriveSelfPaySelectionKey } from "../../modules/shared/key-derivation.ts"
import {
  loadActiveSelfPayRelays,
  type SelfPayArrivalDeps,
} from "../../modules/table-self-pay/table-self-pay-actions.ts"
import {
  createSelfPayTestTransferFilter,
  openSelfPayTestTransfers,
} from "../../modules/table-self-pay/table-self-pay-test-transfer-utils.ts"
import type { AppBackgroundJob } from "../background-job-types.ts"
import { createKeyedTaskQueue } from "../keyed-task-queue.ts"

const CHECK_INTERVAL_MS = 10_000

/**
 * Books the guests' test transfers to the account's bank account and matches
 * them as a bank sync matches what the bank reports (table-self-pay/0025).
 */
export const recordSelfPayTestTransfers: Task<
  void,
  never,
  EvoluOwnerDep &
    ConsoleDep &
    LockManagerDep &
    SelfPayArrivalDeps &
    NostrRelayDep &
    SelfPayDefaultRelaysDep &
    TableSelfPayRootDep
> = async (run) => {
  const [account] = await run.deps.evolu.loadQuery(fiatBankAccountQuery)
  if (account === undefined || account.isDeleted === sqliteTrue) return ok()

  const relays = [
    ...new Set([
      ...(await run.ok(loadActiveSelfPayRelays())),
      ...run.deps.selfPayDefaultRelays,
    ]),
  ]
  const selectionKey = deriveSelfPaySelectionKey(run.deps.tableSelfPayRoot)
  const events = await run.deps.nostrRelayClient.query(
    relays,
    createSelfPayTestTransferFilter(selectionKey)
  )
  const transactions = openSelfPayTestTransfers({
    events,
    selectionKey,
  }).filter(({ currency }) => currency === account.currency)
  const { unrecorded, unclaimed } = await run.ok(
    loadUnrecordedBankTransactions({ accountId: account.id, transactions })
  )
  await run.ok(
    recordBankTransactions({ accountId: account.id, transactions: unrecorded })
  )
  await run.ok(
    reconcileUnclaimedBankTransactions({ accountTransactionIds: unclaimed })
  )
  return ok()
}

export const createSelfPayTestTransferJob =
  ({
    intervalMs = CHECK_INTERVAL_MS,
  }: {
    readonly intervalMs?: number
  } = {}): AppBackgroundJob =>
  (run) => {
    const jobRun = run.create({
      ...run.deps,
      console: run.deps.console.child("self-pay-test-transfer-job"),
    })
    const queue = createKeyedTaskQueue<"check">({
      onError: (error) => jobRun.deps.onError(error),
    })
    const check = () =>
      queue.enqueue("check", async () => {
        await jobRun.ok(recordSelfPayTestTransfers)
      })
    check()
    const timer = setInterval(check, intervalMs)
    ;(timer as { readonly unref?: () => void }).unref?.()

    const disposer = new AsyncDisposableStack()
    disposer.use(jobRun)
    disposer.use(queue)
    disposer.defer(() => clearInterval(timer))
    return ok(disposer)
  }

export const startSelfPayTestTransferJob = createSelfPayTestTransferJob()
