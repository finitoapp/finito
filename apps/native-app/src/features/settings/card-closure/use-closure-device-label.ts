import type { DeviceId } from "@payky/core/modules/device/device-types"
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { accountAtom } from "../../../atoms/account.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

/**
 * Names the terminal that closed a batch the same way everywhere on the
 * closure screens: this phone as "This phone", another by its device name,
 * and one whose device row has not synced yet as an unknown device.
 */
export function useClosureDeviceLabel(): (closure: {
  readonly deviceId: DeviceId
  readonly deviceName: string | null
}) => string {
  const { t } = useTranslation()
  const thisDeviceId = useAtomValue(accountAtom).device.id

  return useCallback(
    (closure) =>
      closure.deviceId === thisDeviceId
        ? t("settings.cardClosure.terminals.thisDevice")
        : (closure.deviceName ??
          t("settings.cardClosure.terminals.unknownDevice")),
    [t, thisDeviceId]
  )
}
