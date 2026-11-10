import {
  type ConsoleDep,
  type LockManagerDep,
  ok,
  type Task,
} from "@evolu/common"
import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import type { AccountId } from "../account/account-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { markWithdrawalFailed } from "./withdraw-actions.ts"
import { pendingLightningWithdrawalsQuery } from "./withdraw-queries.ts"
import {
  classifyPendingWithdrawal,
  type PendingWithdrawalTransfer,
  WITHDRAWAL_CHECK_WINDOW_MS,
} from "./withdraw-utils.ts"

/**
 * Settles what it can of an account's Lightning withdrawals still waiting for
 * an outcome (withdraw/0003): marks returned and never-created ones failed,
 * and hands back the transfers to record. Recording stays with the Spark sync
 * job, which calls this after every history sweep, so the movement has one
 * writer and this module never learns the job's internals.
 *
 * Independent of the sweep's 72-hour window, so a preimage that arrives late
 * still gets its withdrawal recorded. One withdrawal's failure is logged and
 * skipped, never the rest.
 */
export const checkPendingWithdrawals =
  <TTransfer extends PendingWithdrawalTransfer>({
    accountId,
    deviceId,
    getTransfer,
  }: {
    readonly accountId: AccountId
    readonly deviceId: DeviceId
    readonly getTransfer: (
      sparkTransferId: string
    ) => Promise<TTransfer | undefined>
  }): Task<
    ReadonlyArray<TTransfer>,
    never,
    EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep & ConsoleDep
  > =>
  async (run) => {
    const now = run.deps.date.now().getTime()
    const pending = await run.deps.evolu.loadQuery(
      pendingLightningWithdrawalsQuery(accountId)
    )
    const toRecord: TTransfer[] = []

    for (const withdrawal of pending) {
      const createdAt = Date.parse(withdrawal.createdAt)
      if (now - createdAt >= WITHDRAWAL_CHECK_WINDOW_MS) continue

      try {
        const transfer = await getTransfer(withdrawal.sparkTransferId)
        const createdOnThisDevice = withdrawal.deviceId === deviceId
        const isSending =
          transfer === undefined &&
          createdOnThisDevice &&
          (await run.deps.lockManager.request(
            `withdrawal-${withdrawal.id}`,
            { ifAvailable: true },
            (lock) => lock === null
          ))

        const verdict = classifyPendingWithdrawal({
          withdrawal: { createdAt, createdOnThisDevice },
          transfer,
          now,
          isSending,
        })
        if (verdict === "record" && transfer !== undefined) {
          toRecord.push(transfer)
        } else if (verdict === "returned" || verdict === "not-created") {
          await run.ok(
            markWithdrawalFailed({
              withdrawalId: withdrawal.id,
              reason: verdict,
            })
          )
        }
      } catch (error) {
        run.deps.console.warn("Could not check a pending withdrawal.", {
          withdrawalId: withdrawal.id,
          error,
        })
      }
    }

    return ok(toRecord)
  }
