import { activeSparkAccountByIdQuery } from "@payky/core/modules/account/account-spark-queries"
import type { AccountId } from "@payky/core/modules/account/account-types"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useAsyncValue } from "../../hooks/use-async-value.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"

/**
 * The spendable balance in sats of the Spark wallet `accountId` names, `null`
 * while it loads or when it cannot be read.
 */
export function useSparkBalance(accountId: AccountId): number | null {
  const appRun = useAppRun()
  const [sparkAccount] = useEvoluQuery(
    activeSparkAccountByIdQuery(accountId)
  ).data
  const secret = sparkAccount?.secret
  const { data } = useAsyncValue(
    secret === undefined ? null : `balance:${accountId}`,
    async () => {
      if (secret === undefined) return null
      await using run = appRun()
      await using wallet = await run.deps.sparkWallet.create(secret)
      return (await wallet.getBalance()).availableSats
    }
  )
  return data
}
