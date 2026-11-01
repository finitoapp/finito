import {
  accountListQuery,
  createAccountMasterKey,
  insertAccount,
  selectAccount,
} from "@payky/core/evolu/device-account"
import { useAtomValue, useSetAtom, useStore } from "jotai"
import { Text, View } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import { deviceEvoluAtom } from "../../atoms/device-evolu.ts"
import {
  evoluCounterAtom,
  reloadAppEvoluAtom,
} from "../../atoms/evolu-counter.ts"
import { Button } from "../../components/ui/button.tsx"
import { appDefaultTransports } from "../../core/app-brand.ts"
import { useRequirePermission } from "../../core/use-access.ts"
import { useDeviceEvoluQuery } from "../../hooks/use-evolu-query.ts"

export function AccountsCard() {
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const active = useAtomValue(accountAtom)
  const reload = useSetAtom(reloadAppEvoluAtom)
  const { require } = useRequirePermission()
  const store = useStore()
  const accountVersion = useAtomValue(evoluCounterAtom)
  const isCurrentAccount = () => store.get(evoluCounterAtom) === accountVersion
  const accounts = useDeviceEvoluQuery(accountListQuery).data

  return (
    <View gap="2">
      <Text fontWeight="600">Accounts</Text>
      {accounts.map((a) => (
        <View key={a.id} gap="1">
          <Text>
            {a.id === active.id ? "* " : ""}
            {a.name} ({a.id.slice(0, 8)})
          </Text>
          {a.id === active.id ? null : (
            <Button
              variant="outline"
              onPress={async () => {
                if (!isCurrentAccount()) return
                if (!(await require("admin", "access.action.switchAccount")))
                  return
                if (!isCurrentAccount()) return
                selectAccount(deviceEvolu, a.id)
                reload()
              }}
            >
              Switch
            </Button>
          )}
        </View>
      ))}
      <Button
        variant="outline"
        onPress={async () => {
          if (!isCurrentAccount()) return
          if (
            !(await require("admin", "settings.accounts.create.confirm.confirm"))
          )
            return
          if (!isCurrentAccount()) return
          insertAccount(deviceEvolu, createAccountMasterKey(), {
            defaultTransports: appDefaultTransports,
          })
          reload()
        }}
      >
        Add diagnostic account
      </Button>
    </View>
  )
}
