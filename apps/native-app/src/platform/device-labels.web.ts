import { NonEmptyString255 } from "@payky/core/modules/shared/schema"
import { UAParser } from "ua-parser-js"

const toOptionalLabel = (value: string | undefined) =>
  value === undefined || value === ""
    ? null
    : NonEmptyString255(value.slice(0, 255))

/**
 * What this device is, for the device rows: on the PWA, what the browser
 * says, as web's `getDeviceLabels` (`apps/web-app/src/atoms/account.ts`).
 */
export const getNativeDeviceLabels = () => {
  const uap = new UAParser()
  return {
    deviceType: toOptionalLabel(uap.getDevice().type),
    deviceVendor: toOptionalLabel(uap.getDevice().vendor),
    browserName: toOptionalLabel(uap.getBrowser().name),
    osName: toOptionalLabel(uap.getOS().name),
  }
}

/** The maker and model a new device is named after (access/0013). */
export const getNativeDeviceModel = () => {
  const device = new UAParser().getDevice()
  return { vendor: device.vendor, model: device.model }
}
