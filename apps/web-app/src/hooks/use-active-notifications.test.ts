import type { NotificationStore } from "@payky/core/background-jobs/notifications"
import { createNotificationStore } from "@payky/core/background-jobs/notifications"
import type { Permission } from "@payky/core/modules/access/access-types"
import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  store: null as NotificationStore | null,
  effective: new Set<Permission>(),
}))

vi.mock("jotai", () => ({
  atom: (read: unknown) => read,
  useAtomValue: () => mocks.store,
}))

vi.mock("react", () => ({
  useMemo: (fn: () => unknown) => fn(),
  useSyncExternalStore: (
    _subscribe: unknown,
    getSnapshot: () => unknown
  ): unknown => getSnapshot(),
}))

vi.mock("@/hooks/use-access.ts", () => ({
  useAccess: () => ({ effective: mocks.effective }),
}))

import { useActiveNotifications } from "./use-active-notifications.ts"

describe("useActiveNotifications", () => {
  beforeEach(() => {
    const store = createNotificationStore()
    store.notifications
      .open("recovery-backup-reminder")
      .set([{ type: "recoveryPhraseBackup" }])
    mocks.store = store
  })

  test("hides the backup reminder from a device without admin", () => {
    mocks.effective = new Set<Permission>(["sell", "settings"])
    expect(useActiveNotifications()).toEqual([])
  })

  test("shows the backup reminder to a device with admin", () => {
    mocks.effective = new Set<Permission>(["admin"])
    expect(useActiveNotifications()).toEqual([{ type: "recoveryPhraseBackup" }])
  })

  test("shows the tables' notifications only to a device with catalog", () => {
    mocks.store?.notifications
      .open("table-self-pay-reach")
      .set([{ type: "guestsCannotPay" }, { type: "tableBillsUnseen" }])
    mocks.effective = new Set<Permission>(["admin"])
    expect(useActiveNotifications()).toEqual([{ type: "recoveryPhraseBackup" }])
    mocks.effective = new Set<Permission>(["catalog"])
    expect(useActiveNotifications()).toEqual([
      { type: "guestsCannotPay" },
      { type: "tableBillsUnseen" },
    ])
  })
})
