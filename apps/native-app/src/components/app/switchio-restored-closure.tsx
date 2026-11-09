import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  type CloseCardSwitchioBatchError,
  recordRestoredCardSwitchioClosure,
} from "@payky/core/modules/card-switchio-closure/card-switchio-closure-actions"
import { useAtomValue } from "jotai"
import { useCallback, useEffect } from "react"
import { AppState } from "react-native"
import { accountAtom } from "../../atoms/account.ts"
import { nativeConsole } from "../../core/native-runtime.ts"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { takeRestoredSwitchioClosureResult } from "../../platform/switchio.ts"
import { useLoadSwitchioResultOwner } from "./use-switchio-result-owner.ts"

const restoredClosureErrorKeys = {
  SwitchioClosureFailed: "settings.cardClosure.error.failed",
  SwitchioUnavailable: "settings.cardClosure.restored.unresolved",
  SwitchioResultUnreadable: "settings.cardClosure.restored.unresolved",
  CardSwitchioClosureAccountNotFound:
    "settings.cardClosure.restored.unresolved",
} satisfies Record<CloseCardSwitchioBatchError["type"], TranslationKey>

/**
 * Records a batch closure whose promise was lost when Android killed the app
 * while SwitchioPay was in the foreground: SwitchioPay closes the batch
 * anyway, and `MainActivity` stored its result before any JS ran
 * (payment/0008). Runs at start-up and whenever the app comes back to the
 * foreground, as `SwitchioRestoredResult` does for payments; the closure id
 * stored with the result makes a repeated result one row. A closure begun
 * and never answered is a warning to check SwitchioPay, with nothing to
 * record.
 */
export function SwitchioRestoredClosure() {
  const appRun = useAppRun()
  const deviceId = useAtomValue(accountAtom).device.id
  const loadOwner = useLoadSwitchioResultOwner()
  const toast = useToast()
  const { t } = useTranslation()

  const record = useCallback(async (): Promise<void> => {
    const restored = takeRestoredSwitchioClosureResult(await loadOwner())
    if (restored === null) return

    if (restored === "unanswered") {
      nativeConsole.warn("[switchio] Closure begun without an answer")
      toast.error(t("settings.cardClosure.restored.unanswered"))
      return
    }

    if (restored === "unusable") {
      nativeConsole.warn("[switchio] Unusable restored closure result")
      toast.error(t("settings.cardClosure.restored.unresolved"))
      return
    }

    await using run = appRun()
    const result = await run(
      recordRestoredCardSwitchioClosure({ restored, deviceId })
    )
    if (result.ok) {
      toast.success(t("settings.cardClosure.restored.closed"))
    } else {
      nativeConsole.warn("[switchio] Restored closure result", result.error)
      toast.error(t(restoredClosureErrorKeys[result.error.type]))
    }
  }, [appRun, deviceId, loadOwner, toast, t])

  useEffect(() => {
    void record()
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void record()
    })
    return () => subscription.remove()
  }, [record])

  return null
}
