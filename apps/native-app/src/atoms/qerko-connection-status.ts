import { createQerkoConnectionStatusStore } from "@payky/core/integrations/qerko/qerko-connection-status"

/**
 * This device's Qerko payment connection (qerko/0011), as web's: written by
 * the connection job, read by the settings and payment screens through
 * `useQerkoConnectionStatus`.
 */
export const qerkoConnectionStatusStore = createQerkoConnectionStatusStore()
