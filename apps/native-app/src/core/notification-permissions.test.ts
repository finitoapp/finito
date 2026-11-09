import type { JobNotification } from "@payky/core/background-jobs/notifications"
import type { Permission } from "@payky/core/modules/access/access-types"
import { expect, test } from "vitest"
import { visibleNotifications } from "./notification-permissions.ts"

const backup: JobNotification = { type: "recoveryPhraseBackup" }

test("the backup notification needs admin", () => {
  expect(visibleNotifications([backup], new Set<Permission>())).toEqual([])
  expect(
    visibleNotifications([backup], new Set<Permission>(["admin"]))
  ).toEqual([backup])
})
