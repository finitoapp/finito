import { insertDemoAccount } from "@payky/core/evolu/device-account"
import { runMutationWithCompletion } from "@payky/core/modules/shared/evolu-utils"
import { NonEmptyString255 } from "@payky/core/modules/shared/schema"
import { useNavigate } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import { DatabaseZap, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { FadeHeader } from "@/components/fade-header.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert.tsx"
import { Button } from "@/components/ui/button.tsx"
import { appDefaultTransports } from "@/core/app-brand.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useReloadAppEvolu } from "@/hooks/use-reload-app-evolu.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
/**
 * Creates a demo account and switches to it; `DemoDataSeed` then fills it
 * with its fictional history (demo-data/0001).
 */
export function DemoDataPage() {
  const { t } = useTranslation()
  const account = useAtomValue(accountAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const reloadAppEvolu = useReloadAppEvolu()
  const confirm = useConfirmDialog()
  const runToast = useRunToast()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const accountName = t("settings.demoData.accountName")

  const handleCreate = async () => {
    if (pending) return
    const confirmed = await confirm({
      title: t("settings.demoData.confirm.title"),
      description: t("settings.demoData.confirm.description"),
      confirmLabel: t("settings.demoData.confirm.confirm"),
      cancelLabel: t("settings.demoData.confirm.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return

    setPending(true)
    await runToast(async () => {
      await runMutationWithCompletion((options) =>
        insertDemoAccount(
          deviceEvolu,
          NonEmptyString255(accountName),
          appDefaultTransports,
          options
        )
      )
      reloadAppEvolu()
      await navigate({ to: "/" })
    })
    setPending(false)
  }

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.demoData.title")} />
      <div className="mt-8 flex flex-col gap-5">
        {account.demo === null ? null : (
          <Alert variant="info">
            <DatabaseZap />
            <AlertTitle>{t("settings.demoData.current.title")}</AlertTitle>
            <AlertDescription>
              {t("settings.demoData.current.description")}
            </AlertDescription>
          </Alert>
        )}
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t("settings.demoData.warning.title")}</AlertTitle>
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                {t("settings.demoData.warning.newAccount", {
                  name: accountName,
                })}
              </li>
              <li>{t("settings.demoData.warning.irreversible")}</li>
              <li>
                <strong>{t("settings.demoData.warning.relays")}</strong>
              </li>
              <li>{t("settings.demoData.warning.services")}</li>
              <li>{t("settings.demoData.warning.duration")}</li>
            </ul>
          </AlertDescription>
        </Alert>
        <Button
          type="button"
          variant="destructive"
          size="lg"
          disabled={pending}
          onClick={() => {
            void handleCreate()
          }}
        >
          {pending
            ? t("settings.demoData.action.pending")
            : t("settings.demoData.action")}
        </Button>
      </div>
    </>
  )
}
