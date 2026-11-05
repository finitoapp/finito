import { brandName, paykyBrand } from "@payky/app-shared/brand"
import { formatTransferCode } from "@payky/core/integrations/nostr/nostr-account-transfer"
import {
  type AccountShareFailureReason,
  type AccountShareRequest,
  createShareRequest,
} from "@payky/core/integrations/payky-app/account-share-protocol"
import { useQueryClient } from "@tanstack/react-query"
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right"
import RotateCcw from "lucide-react-native/icons/rotate-ccw"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useRef, useState } from "react"
import { ActivityIndicator } from "react-native"
import { Text, useTheme, XStack, YStack } from "tamagui"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../components/ui/alert.tsx"
import { Button } from "../../components/ui/button.tsx"
import { appBrand } from "../../core/app-brand.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { requestAccountFromPayky } from "../../platform/payky-account-request.ts"
import { accountFromPaykyFailureKeys } from "./account-from-payky-failures.ts"
import { useAddTransferredAccount } from "./use-add-transferred-account.ts"
import { invalidateCanRequestAccountFromPayky } from "./use-can-request-account-from-payky.ts"

type View =
  | { readonly phase: "intro"; readonly request: AccountShareRequest }
  | { readonly phase: "waiting"; readonly request: AccountShareRequest }
  | { readonly phase: "adding" }
  | { readonly phase: "failed"; readonly reason: AccountShareFailureReason }

/** The name the request gives for this app, shown in Payky as a claim only. */
const newRequest = () => createShareRequest(brandName(appBrand))

/**
 * Takes the account from Payky on this phone (account/0008): shows the code
 * first, so it can be compared, then opens Payky, which asks the user and
 * answers. The account it returns is added the way a QR transfer's is. Used
 * by the onboarding step and Settings → Accounts, and offered there only when
 * `useCanRequestAccountFromPayky` found a Payky that takes the request.
 */
export function AccountFromPayky({
  source,
  confirmBeforeAdding,
}: {
  readonly source: "onboarding" | "settings"
  /** A device that already has an account confirms before adding another. */
  readonly confirmBeforeAdding: boolean
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const queryClient = useQueryClient()
  const addTransferredAccount = useAddTransferredAccount({
    source,
    confirmBeforeAdding,
  })
  const [view, setView] = useState<View>(() => ({
    phase: "intro",
    request: newRequest(),
  }))
  // Only the latest request's answer counts.
  const latestRef = useRef<string | null>(null)
  const sourceApp = brandName(paykyBrand)

  const open = async (request: AccountShareRequest) => {
    latestRef.current = request.requestId
    setView({ phase: "waiting", request })
    const result = await requestAccountFromPayky(request)
    if (latestRef.current !== request.requestId) return
    latestRef.current = null
    if (!result.ok) {
      if (result.error.reason === "notInstalled") {
        void invalidateCanRequestAccountFromPayky(queryClient)
      }
      setView({ phase: "failed", reason: result.error.reason })
      return
    }
    setView({ phase: "adding" })
    if (!(await addTransferredAccount(result.value))) {
      setView({ phase: "intro", request: newRequest() })
    }
  }

  const startAgain = () => {
    latestRef.current = null
    setView({ phase: "intro", request: newRequest() })
  }

  return (
    <YStack gap="4">
      {view.phase === "intro" || view.phase === "waiting" ? (
        <YStack gap="3" aria-live="polite">
          {view.phase === "intro" ? (
            <Text color="muted-foreground">
              {t("accountFromPayky.intro", { sourceApp })}
            </Text>
          ) : null}
          <Text>{t("accountFromPayky.waiting", { sourceApp })}</Text>
          <Text
            fontSize="5xl"
            lineHeight="5xl"
            fontWeight="600"
            letterSpacing={4.8}
            text="center"
            // Read digit by digit, not as one number.
            aria-label={view.request.code.split("").join(" ")}
          >
            {formatTransferCode(view.request.code)}
          </Text>
          <Text color="muted-foreground">
            {t("accountFromPayky.waiting.hint", { sourceApp })}
          </Text>
        </YStack>
      ) : null}

      {view.phase === "intro" ? (
        <Button
          w="100%"
          iconEnd={ArrowUpRight}
          label={t("accountFromPayky.open", { sourceApp })}
          onPress={() => {
            void open(view.request)
          }}
        />
      ) : null}

      {view.phase === "waiting" ? (
        <YStack gap="3">
          <XStack items="center" gap="2">
            <ActivityIndicator
              size="small"
              color={theme["muted-foreground"].val}
            />
            <Text color="muted-foreground">
              {t("accountFromPayky.waitingForAnswer", { sourceApp })}
            </Text>
          </XStack>
          {/* For a launcher that brought the user back without an answer. */}
          <Button
            label={t("accountFromPayky.retry")}
            variant="outline"
            iconStart={RotateCcw}
            self="flex-start"
            onPress={startAgain}
          />
        </YStack>
      ) : null}

      {view.phase === "adding" ? (
        <XStack items="center" gap="2" aria-live="polite">
          <ActivityIndicator size="small" color={theme.primary.val} />
          <Text>{t("accountFromPayky.adding")}</Text>
        </XStack>
      ) : null}

      {view.phase === "failed" ? (
        <>
          <Alert variant="destructive" icon={TriangleAlert}>
            <AlertTitle>{t("accountFromPayky.failed.title")}</AlertTitle>
            <AlertDescription>
              {t(accountFromPaykyFailureKeys[view.reason], { sourceApp })}
            </AlertDescription>
          </Alert>
          <Button
            label={t("accountFromPayky.retry")}
            iconStart={RotateCcw}
            self="flex-start"
            onPress={startAgain}
          />
        </>
      ) : null}
    </YStack>
  )
}
