import {
  createDefaultDeviceSettings,
  createDeviceEvolu,
  createDeviceQuery,
  deviceSettingsId,
} from "@payky/core/evolu/device-client"
import { getPreferredDeviceLanguage } from "@payky/core/modules/device/device-utils"
import { atom } from "jotai"
import { runAtom } from "@/atoms/run.ts"
import { appBrand } from "@/core/app-brand.ts"

const deviceSettingsQuery = createDeviceQuery((db) =>
  db
    .selectFrom("deviceSettings")
    .select("id")
    .where("id", "=", deviceSettingsId)
)

export const deviceEvoluAtom = atom(async (get) => {
  const run = get(runAtom)
  const deviceEvolu = await run.ok(createDeviceEvolu)
  const deviceSettings = await deviceEvolu.loadQuery(deviceSettingsQuery)

  if (deviceSettings.length === 0) {
    deviceEvolu.upsert(
      "deviceSettings",
      createDefaultDeviceSettings(
        getPreferredDeviceLanguage(navigator.language, appBrand.languages)
      )
    )
  }

  return deviceEvolu
})
