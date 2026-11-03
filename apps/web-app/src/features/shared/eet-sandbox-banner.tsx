import { Link } from "@tanstack/react-router"
import { FlaskConicalIcon } from "lucide-react"

import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * Pinned above every terminal screen while EET reports to the sandbox. On a
 * large monitor it centres over the content column, beside the menu
 * section's sidebar (navigation/0001), as the screen's header does.
 */
export function EetSandboxBanner() {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-background px-3 pt-[env(safe-area-inset-top,0px)] lg:pl-[calc(0.75rem+var(--menu-sidebar-width,0px))]">
      <Link
        to="/settings/eet"
        className="mx-auto flex h-(--terminal-banner-height) max-w-xl items-center gap-2 rounded-b-lg border border-t-0 border-warning/30 bg-warning/10 px-3 text-xs font-medium text-warning"
        data-testid="eet-sandbox-banner"
      >
        <FlaskConicalIcon aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{t("eet.sandbox.banner")}</span>
      </Link>
    </div>
  )
}
