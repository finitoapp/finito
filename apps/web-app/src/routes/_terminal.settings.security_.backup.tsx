import { createFileRoute } from "@tanstack/react-router"

import { RecoveryBackupPage } from "@/features/settings/security/recovery-backup-page.tsx"

export const Route = createFileRoute("/_terminal/settings/security_/backup")({
  component: RecoveryBackupPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
