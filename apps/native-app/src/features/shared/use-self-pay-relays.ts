import { selfPayRelaysQuery } from "@payky/core/modules/table-self-pay/table-self-pay-queries"
import {
  activeSelfPayRelays,
  listSelfPayRelays,
  selfPayAddressRelays,
} from "@payky/core/modules/table-self-pay/table-self-pay-relay-utils"
import { nativeEnv } from "../../core/native-env.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"

/** Native counterpart of web's `useSelfPayRelays`. */
export const useSelfPayRelays = () => {
  const { data: rows } = useEvoluQuery(selfPayRelaysQuery)
  const defaults = nativeEnv.EXPO_PUBLIC_PAYKY_SELF_PAY_RELAYS
  const relays = listSelfPayRelays(defaults, rows)
  return {
    relays,
    addressRelays: selfPayAddressRelays(activeSelfPayRelays(relays), defaults),
  }
}
