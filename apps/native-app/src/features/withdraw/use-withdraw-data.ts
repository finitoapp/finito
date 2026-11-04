import { activeSparkAccountsQuery } from "@payky/core/modules/account/account-spark-queries"
import type { AccountId } from "@payky/core/modules/account/account-types"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"

/** The account the Spark withdrawals are booked to: the active Spark wallet. */
export const useSparkAccountId = (): AccountId | undefined =>
  useEvoluQuery(activeSparkAccountsQuery).data[0]?.id
