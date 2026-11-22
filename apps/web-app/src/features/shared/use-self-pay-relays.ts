import { selfPayRelaysQuery } from "@payky/core/modules/table-self-pay/table-self-pay-queries"
import {
  activeSelfPayRelays,
  listSelfPayRelays,
  selfPayAddressRelays,
} from "@payky/core/modules/table-self-pay/table-self-pay-relay-utils"
import { appEnv } from "@/core/app-env.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"

export const useSelfPayRelays = () => {
  const { data: rows } = useEvoluQuery(selfPayRelaysQuery)
  const defaults = appEnv.VITE_PAYKY_SELF_PAY_RELAYS
  const relays = listSelfPayRelays(defaults, rows)
  return {
    relays,
    addressRelays: selfPayAddressRelays(activeSelfPayRelays(relays), defaults),
  }
}
