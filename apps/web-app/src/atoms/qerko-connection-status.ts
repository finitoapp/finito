import { createQerkoConnectionStatusStore } from "@payky/core/integrations/qerko/qerko-connection-status"

/**
 * This device's Qerko payment connection (qerko/0011): written by the
 * connection job, read by the settings and payment screens through
 * `useQerkoConnectionStatus`. One per app, like the job it reports on.
 */
export const qerkoConnectionStatusStore = createQerkoConnectionStatusStore()
