import type { NotificationsDep } from "../background-jobs/notifications.ts"
import { createNotificationStore } from "../background-jobs/notifications.ts"
import { deriveDeviceAccountId } from "../evolu/device-account.ts"
import type { DeviceAccountDep } from "../modules/shared/evolu-deps.ts"
import { MasterKey } from "../modules/shared/key-derivation.ts"
import { createTestDeviceEvolu } from "./device-evolu.ts"

/** A job context's notifications, in a store of their own nothing reads. */
export const testNotificationsDep = (): NotificationsDep => ({
  notifications: createNotificationStore().notifications,
})

/** The account every test device database is opened for. */
export const testDeviceAccountId = deriveDeviceAccountId(
  MasterKey("000102030405060708090a0b0c0d0e0f")
)

/**
 * The device database half of an app job context: an empty in-memory one
 * for `testDeviceAccountId`, disposed with the returned object. Spread
 * `deviceAccount` into the context, not the object itself.
 */
export const createTestDeviceAccountDep = async () => {
  const device = await createTestDeviceEvolu()
  const deviceAccount: DeviceAccountDep = {
    deviceEvolu: device.deviceEvolu,
    deviceAccountId: testDeviceAccountId,
  }
  return {
    deviceAccount,
    [Symbol.asyncDispose]: () => device[Symbol.asyncDispose](),
  } as const
}
