import { createIdFromString } from "@evolu/common"

import type { DeviceId } from "../device/device-types.ts"

/**
 * The Fio plugin is a singleton, like the accounts it syncs against: there is
 * one fiat bank account (`fiatBankAccountQuery`) and so at most one Fio
 * integration for it, re-pointed whenever that account is replaced
 * (`updateFioPluginAccountRow`). Its id is therefore fixed rather than generated, which
 * is what lets every part of the settings page — including adding tokens —
 * work before the `fioPlugin` row itself exists.
 *
 * A missing row means the integration is off. Nothing needs to distinguish
 * "not created yet" from "disabled": `activeFioPluginsQuery` inner-joins
 * `fioPlugin`, so tokens saved ahead of it simply sit unused until the row is
 * written and active.
 */
export const fioPluginId = createIdFromString<"FioPlugin">("payky-fio-plugin")

export const fioSyncDeviceUptimeId = (deviceId: DeviceId) =>
  createIdFromString<"FioSyncDeviceUptime">(deviceId)
