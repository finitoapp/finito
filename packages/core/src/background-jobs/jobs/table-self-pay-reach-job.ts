import { ok, sqliteTrue, type Task } from "@evolu/common"
import type { TableSelfPayRootDep } from "../../deps.ts"
import {
  fiatBankAccountQuery,
  sparkAccountQuery,
} from "../../modules/account/account-queries.ts"
import { activeFioPluginsQuery } from "../../modules/fio-plugin/fio-plugin-queries.ts"
import { activeMonetaPluginsQuery } from "../../modules/moneta-plugin/moneta-plugin-queries.ts"
import { deriveTableSelfPayKeys } from "../../modules/shared/key-derivation.ts"
import { NonEmptyString255 } from "../../modules/shared/schema.ts"
import {
  selfPayPublishResultsQuery,
  selfPayTablesQuery,
} from "../../modules/table-self-pay/table-self-pay-queries.ts"
import {
  deriveGuestsCannotPayReason,
  findNewestViewPublish,
  parseSelfPayPublishResults,
  pickSelfPayAccounts,
} from "../../modules/table-self-pay/table-self-pay-reach-utils.ts"
import { deriveSelfPayViewTag } from "../../modules/table-self-pay/table-self-pay-view-utils.ts"
import type { BackgroundJobContext } from "../background-job-types.ts"
import { createKeyedTaskQueue } from "../keyed-task-queue.ts"
import type { JobNotification } from "../notifications.ts"

export const startTableSelfPayReachJob: Task<
  AsyncDisposable,
  never,
  BackgroundJobContext & TableSelfPayRootDep
> = (run) => {
  const { evolu, tableSelfPayRoot, notifications, onError } = run.deps
  const scope = notifications.open("table-self-pay-reach")
  const queue = createKeyedTaskQueue<"recompute">({ onError })

  const recompute = async (): Promise<void> => {
    const [
      tables,
      bankAccounts,
      sparkAccounts,
      fioPlugins,
      monetaPlugins,
      publishResults,
    ] = await Promise.all([
      evolu.loadQuery(selfPayTablesQuery),
      evolu.loadQuery(fiatBankAccountQuery),
      evolu.loadQuery(sparkAccountQuery),
      evolu.loadQuery(activeFioPluginsQuery),
      evolu.loadQuery(activeMonetaPluginsQuery),
      evolu.loadQuery(selfPayPublishResultsQuery),
    ])
    if (queue.isDisposed) return

    const accounts = pickSelfPayAccounts({
      bankAccount: bankAccounts[0],
      sparkAccount: sparkAccounts[0],
      activeBankPlugins: [...fioPlugins, ...monetaPlugins],
    })
    const publishesByTag = Map.groupBy(publishResults, ({ tag }) => tag)
    const reasons = new Set(
      tables
        .filter(({ selfPayEnabled }) => selfPayEnabled === sqliteTrue)
        .map(({ id, selfPayEpoch }) => {
          const { viewKey } = deriveTableSelfPayKeys(
            tableSelfPayRoot,
            id,
            selfPayEpoch ?? 0
          )
          const publishes = publishesByTag.get(
            NonEmptyString255(deriveSelfPayViewTag(viewKey))
          )
          return deriveGuestsCannotPayReason({
            accounts,
            lastPublish: findNewestViewPublish(
              parseSelfPayPublishResults(publishes ?? [])
            ),
          })
        })
    )

    const list: ReadonlyArray<JobNotification> = [
      ...(reasons.has("noPaymentMethod")
        ? [{ type: "guestsCannotPay" } as const]
        : []),
      ...(reasons.has("noRelayAccepted")
        ? [{ type: "tableBillsUnseen" } as const]
        : []),
    ]
    scope.set(list)
  }

  const queueRecompute = () => {
    queue.enqueue("recompute", recompute)
  }

  const unsubscribes = [
    evolu.subscribeQuery(selfPayTablesQuery)(queueRecompute),
    evolu.subscribeQuery(fiatBankAccountQuery)(queueRecompute),
    evolu.subscribeQuery(sparkAccountQuery)(queueRecompute),
    evolu.subscribeQuery(activeFioPluginsQuery)(queueRecompute),
    evolu.subscribeQuery(activeMonetaPluginsQuery)(queueRecompute),
    evolu.subscribeQuery(selfPayPublishResultsQuery)(queueRecompute),
  ]
  queueRecompute()

  const disposer = new AsyncDisposableStack()
  disposer.use(scope)
  disposer.defer(async () => {
    for (const unsubscribe of unsubscribes) unsubscribe()
    await queue[Symbol.asyncDispose]()
  })

  return ok(disposer)
}
