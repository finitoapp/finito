import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { restoredAccountAtom } from "@payky/app-shared/restored-account"
import { createDateDep } from "@payky/core/deps"
import { createOrSelectAccount } from "@payky/core/evolu/device-account"
import {
  formatTransferCode,
  startTransferTarget,
  type TransferPayload,
  type TransferTargetState,
} from "@payky/core/integrations/nostr/nostr-account-transfer"
import { createNostrDep } from "@payky/core/integrations/nostr/nostr-client"
import {
  type PaykyUriError,
  parsePairUri,
  type WrongPaykyUriTypeError,
} from "@payky/core/modules/shared/payky-uri"
import { useNavigate } from "@tanstack/react-router"
import { useAtomValue, useSetAtom } from "jotai"
import { LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { accountAtom } from "@/atoms/account.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert.tsx"
import { ScanCodeScanner } from "@/components/scan-code-scanner.tsx"
import { Button } from "@/components/ui/button.tsx"
import { appDefaultTransports } from "@/core/app-brand.ts"
import { appEnv } from "@/core/app-env.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useReloadAppEvolu } from "@/hooks/use-reload-app-evolu.ts"
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

const scanErrorKeys = {
  NotPaykyUri: "accountTransfer.target.error.NotPaykyUri",
  UnknownPaykyUriType: "accountTransfer.target.error.UnknownPaykyUriType",
  UnsupportedPaykyUriVersion:
    "accountTransfer.target.error.UnsupportedPaykyUriVersion",
  InvalidPaykyUri: "accountTransfer.target.error.InvalidPaykyUri",
  WrongPaykyUriType: "accountTransfer.target.error.WrongPaykyUriType",
} satisfies Record<
  (PaykyUriError | WrongPaykyUriTypeError)["type"],
  TranslationKey
>

type FailureReason = Extract<TransferTargetState, { phase: "failed" }>["reason"]

const failureKeys = {
  cancelled: "accountTransfer.target.failed.cancelled",
  conflict: "accountTransfer.target.failed.conflict",
  codeMismatch: "accountTransfer.target.failed.codeMismatch",
  timeout: "accountTransfer.target.failed.timeout",
  network: "accountTransfer.target.failed.network",
  invalid: "accountTransfer.target.failed.invalid",
} satisfies Record<FailureReason, TranslationKey>

type View =
  | { readonly phase: "scan"; readonly error: TranslationKey | null }
  | { readonly phase: "adding" }
  | Exclude<TransferTargetState, { phase: "received" }>

/**
 * The new device's half of account/0001: scans the source's QR, shows the
 * code once the source has locked onto this device, and adds the account it
 * receives. Used by the onboarding step and the settings dialog.
 */
export function AccountTransferTarget({
  source,
  confirmBeforeAdding,
  onRestoreWithPhrase,
}: {
  readonly source: "onboarding" | "settings"
  /** A device that already has an account confirms before adding another. */
  readonly confirmBeforeAdding: boolean
  readonly onRestoreWithPhrase?: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const confirm = useConfirmDialog()
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const activeAccount = useAtomValue(accountAtom)
  const reloadAppEvolu = useReloadAppEvolu()
  const setRestoredAccount = useSetAtom(restoredAccountAtom)
  const [view, setView] = useState<View>({ phase: "scan", error: null })
  const cancelRef = useRef<(() => void) | null>(null)
  useScreenWakeLock(view.phase === "connecting" || view.phase === "code")

  // Leaving the page mid-session tells the source it was cancelled.
  useEffect(() => () => cancelRef.current?.(), [])

  const addAccount = async (payload: TransferPayload) => {
    if (confirmBeforeAdding) {
      const confirmed = await confirm({
        title: t("accountTransfer.target.confirm.title", {
          name: payload.accountName,
        }),
        description: t("accountTransfer.target.confirm.description", {
          name: payload.accountName,
        }),
        confirmLabel: t("accountTransfer.target.confirm.confirm"),
        cancelLabel: t("accountTransfer.target.confirm.cancel"),
      })
      if (!confirmed) {
        setView({ phase: "scan", error: null })
        return
      }
    }

    const previous = activeAccount.id
    const { created } = await createOrSelectAccount(
      deviceEvolu,
      payload.masterKey,
      {
        defaultTransports: appDefaultTransports,
        name: payload.accountName,
        transports: payload.transports,
      }
    )
    setRestoredAccount({ created, previous })
    reloadAppEvolu()
    toast.success(
      created
        ? t("accountTransfer.target.added", { name: payload.accountName })
        : t("accountTransfer.target.alreadyAdded")
    )
    await navigate({
      to: "/restore-account",
      search: { source },
    })
  }

  const onScan = (text: string) => {
    if (view.phase !== "scan") return
    const pair = parsePairUri(text)
    if (!pair.ok) {
      setView({ phase: "scan", error: scanErrorKeys[pair.error.type] })
      return
    }
    const session = startTransferTarget(
      { ...createNostrDep(appEnv.VITE_PAYKY_NOSTR_RELAYS), ...createDateDep() },
      {
        pair: pair.value,
        onState: (state) => {
          if (state.phase === "received") {
            cancelRef.current = null
            setView({ phase: "adding" })
            void addAccount(state.payload)
            return
          }
          if (state.phase === "failed") cancelRef.current = null
          setView(state)
        },
      }
    )
    cancelRef.current = session.cancel
  }

  const cancelSession = () => {
    cancelRef.current?.()
    cancelRef.current = null
    setView({ phase: "scan", error: null })
  }

  return (
    <div className="flex flex-col gap-4">
      {view.phase === "scan" ? (
        <>
          <p className="text-sm text-muted-foreground">
            {t("accountTransfer.target.instructions")}
          </p>
          <div className="aspect-square w-full overflow-hidden rounded-xl bg-black">
            <ScanCodeScanner onScan={onScan} />
          </div>
          {view.error !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {t(view.error)}
            </p>
          ) : null}
          <Alert variant="warning">
            <TriangleAlert />
            <AlertTitle>{t("accountTransfer.target.warning.title")}</AlertTitle>
            <AlertDescription>
              {t("accountTransfer.target.warning.description")}
            </AlertDescription>
          </Alert>
          {onRestoreWithPhrase ? (
            <Button
              type="button"
              variant="link"
              className="self-start px-0"
              onClick={onRestoreWithPhrase}
            >
              {t("accountTransfer.target.fallback")}
            </Button>
          ) : null}
        </>
      ) : null}

      <div aria-live="polite" className="flex flex-col gap-4">
        {view.phase === "connecting" || view.phase === "adding" ? (
          <p className="flex items-center gap-2 text-sm">
            <LoaderCircle className="size-4 animate-spin" />
            {t("accountTransfer.target.connecting")}
          </p>
        ) : null}

        {view.phase === "code" ? (
          <>
            <p className="text-sm">
              {t("accountTransfer.target.code.instructions")}
            </p>
            <p className="text-center font-mono text-5xl font-semibold tracking-widest">
              {/* Read digit by digit, not as one number. */}
              <span className="sr-only">{view.code.split("").join(" ")}</span>
              <span aria-hidden="true">{formatTransferCode(view.code)}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {t("accountTransfer.target.code.warning")}
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {t("accountTransfer.target.code.waiting")}
            </p>
          </>
        ) : null}

        {view.phase === "failed" ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>{t("accountTransfer.target.failed.title")}</AlertTitle>
            <AlertDescription>{t(failureKeys[view.reason])}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      {view.phase === "connecting" || view.phase === "code" ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={cancelSession}
        >
          {t("accountTransfer.cancel")}
        </Button>
      ) : null}

      {view.phase === "failed" ? (
        <Button
          type="button"
          className="self-start"
          onClick={() => setView({ phase: "scan", error: null })}
        >
          <RotateCcw data-icon="inline-start" />
          {t("accountTransfer.target.scanAgain")}
        </Button>
      ) : null}
    </div>
  )
}
