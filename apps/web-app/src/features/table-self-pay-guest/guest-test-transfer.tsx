import { hexToBytes } from "@noble/hashes/utils.js"
import {
  NonEmptyStringSchema,
  PositiveInteger,
  VariableSymbol,
} from "@payky/core/modules/shared/schema"
import type { TableSelfPayAddress } from "@payky/core/modules/table-self-pay/table-self-pay-address-utils"
import {
  formatSelfPayBankMessage,
  type SelfPayPointer,
} from "@payky/core/modules/table-self-pay/table-self-pay-reference-utils"
import { createSelfPayTestTransferEvent } from "@payky/core/modules/table-self-pay/table-self-pay-test-transfer-utils"
import type { SelfPayViewBill } from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { FlaskConicalIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { useGuestTranslation } from "./use-guest-translation.ts"
import { publishGuestSelection } from "./use-self-pay-view.ts"

type TestTransferState = "idle" | "sending" | "sent" | "failed"

/**
 * A test deployment's stand-in for the bank transfer: it sends what the bank
 * QR asks for, the bill's reference and the pointer message included, and the
 * till books it as money from the bank (table-self-pay/0025).
 */
export function GuestTestTransfer({
  address,
  selectionKey,
  bill,
  amount,
  pointer,
}: {
  readonly address: TableSelfPayAddress
  readonly selectionKey: string
  readonly bill: Pick<SelfPayViewBill, "reference" | "currency">
  readonly amount: number
  readonly pointer: SelfPayPointer
}) {
  const { t } = useGuestTranslation()
  const [state, setState] = useState<TestTransferState>("idle")

  const send = async () => {
    setState("sending")
    const event = createSelfPayTestTransferEvent({
      transfer: {
        amount: PositiveInteger(amount),
        currency: bill.currency,
        variableSymbol: VariableSymbol(bill.reference),
        recipientMessage: NonEmptyStringSchema.decode(
          formatSelfPayBankMessage({ pointer })
        ),
      },
      selectionKey: hexToBytes(selectionKey),
      createdAt: Math.floor(Date.now() / 1000),
    })
    setState((await publishGuestSelection(address, event)) ? "sent" : "failed")
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">
        {t("selfPay.test.hint")}
      </p>
      <Button
        type="button"
        size="lg"
        className="h-12 w-full max-w-64 text-base"
        disabled={state === "sending" || state === "sent"}
        onClick={() => {
          void send()
        }}
      >
        <FlaskConicalIcon />
        {t(state === "sent" ? "selfPay.test.sent" : "selfPay.test.send")}
      </Button>
      {state === "failed" ? (
        <p className="text-center text-sm text-destructive">
          {t("selfPay.test.failed")}
        </p>
      ) : null}
    </div>
  )
}
