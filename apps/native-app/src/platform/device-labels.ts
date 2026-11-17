import { NonEmptyString255 } from "@payky/core/modules/shared/schema"
import { Platform } from "react-native"

const toOptionalLabel = (value: string | undefined) =>
  value === undefined || value === ""
    ? null
    : NonEmptyString255(value.slice(0, 255))

/** What this device is, for the device rows; the native twin of web's UA labels. */
export const getNativeDeviceLabels = () => ({
  deviceType: toOptionalLabel("mobile"),
  deviceVendor: toOptionalLabel(
    Platform.OS === "android" ? Platform.constants.Brand : "Apple"
  ),
  browserName: null,
  osName: toOptionalLabel(Platform.OS === "android" ? "Android" : "iOS"),
})

/** The maker and model a new device is named after (access/0013). */
export const getNativeDeviceModel = () =>
  Platform.OS === "android"
    ? {
        vendor: Platform.constants.Manufacturer || Platform.constants.Brand,
        model: Platform.constants.Model,
      }
    : { vendor: undefined, model: undefined }
