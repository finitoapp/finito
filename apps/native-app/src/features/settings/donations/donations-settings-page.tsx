import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  fetchLnurlPayInvoice,
  type LnurlPayMetadata,
} from "@payky/core/integrations/lnurl/lnurl-pay-client"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import {
  currencyFractionDigits,
  decimalAmountToMinorUnits,
  fiatMinorUnitsToSats,
  minorUnitsToDecimalString,
  satsToFiat,
} from "@payky/core/modules/shared/money"
import {
  type FiatCurrency as FiatCurrencyType,
  Integer,
} from "@payky/core/modules/shared/schema"
import { router } from "expo-router"
import HeartHandshake from "lucide-react-native/icons/heart-handshake"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useEffect, useState } from "react"
import { z } from "zod"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Alert, AlertDescription } from "../../../components/ui/alert.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import { Input } from "../../../components/ui/input.tsx"
import { nativeEnv } from "../../../core/native-env.ts"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useBtcFiat, useLnurlPayMetadata } from "../../../hooks/use-btc-fiat.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { DonationHistory } from "./donation-history.tsx"

const DonationAmountSchema = z.number().int().positive().safe()

type EditedAmount = "fiat" | "sats"

const parseSatsInput = (value: string): number | null => {
  const parsed = DonationAmountSchema.safeParse(Number(value.trim()))
  return parsed.success ? parsed.data : null
}

const formatFiatInput = (
  fiatAmount: number,
  currency: FiatCurrencyType
): string =>
  minorUnitsToDecimalString({
    value: Integer(
      Math.round(fiatAmount * 10 ** currencyFractionDigits[currency])
    ),
    currency,
  })

const getAmountErrorKey = ({
  amountSats,
  metadata,
  satsInput,
}: {
  readonly amountSats: number | null
  readonly metadata: LnurlPayMetadata | null
  readonly satsInput: string
}): TranslationKey | null => {
  if (satsInput.trim().length === 0) return "settings.donations.amount.required"
  if (amountSats === null) return "settings.donations.amount.invalid"
  if (
    metadata !== null &&
    (amountSats < metadata.minSendableSats ||
      amountSats > metadata.maxSendableSats)
  ) {
    return "settings.donations.amount.range"
  }
  return null
}

/**
 * Donation amount (A04): type fiat or sats, the other follows the BTC rate,
 * then create a Lightning invoice against the donation address. The server
 * wallet and its keys stay behind the app's own `/api/lnurlp/donate`.
 */
export function DonationsSettingsPage() {
  const appRun = useAppRun()
  const { t } = useTranslation()
  const [settings] = useEvoluQuery(settingsQuery).data
  const currency = getFiatCurrency(settings)
  const { rate: exchangeRate, rateFailed } = useBtcFiat()
  const metadataState = useLnurlPayMetadata(
    nativeEnv.EXPO_PUBLIC_PAYKY_DONATE_LUD16_ADDRESS
  )
  const metadata = metadataState.data
  const [fiatInput, setFiatInput] = useState("")
  const [satsInput, setSatsInput] = useState("")
  const [editedAmount, setEditedAmount] = useState<EditedAmount>("fiat")
  const [creating, setCreating] = useState(false)
  const [invoiceFailed, setInvoiceFailed] = useState(false)

  // As web: the rate's error first, then the address's.
  const loadErrorKey: TranslationKey | null = rateFailed
    ? "settings.donations.rate.error"
    : metadataState.failed
      ? "settings.donations.metadata.error"
      : null
  const isLoading = exchangeRate === null || metadata === null

  useEffect(() => {
    if (exchangeRate === null) return
    if (editedAmount === "fiat") {
      const amount = decimalAmountToMinorUnits({ currency, value: fiatInput })
      setSatsInput(
        amount === null
          ? ""
          : String(fiatMinorUnitsToSats({ amount, exchangeRate, currency }))
      )
      return
    }
    const satsAmount = parseSatsInput(satsInput)
    setFiatInput(
      satsAmount === null
        ? ""
        : formatFiatInput(
            satsToFiat({ sats: satsAmount, exchangeRate }),
            currency
          )
    )
  }, [currency, editedAmount, exchangeRate, fiatInput, satsInput])

  const amountSats = parseSatsInput(satsInput)
  const amountErrorKey = getAmountErrorKey({ amountSats, metadata, satsInput })
  const showAmountError =
    fiatInput.trim().length > 0 || satsInput.trim().length > 0
  const visibleAmountError = showAmountError ? amountErrorKey : null
  const canCreate =
    amountSats !== null &&
    amountErrorKey === null &&
    metadata !== null &&
    !creating

  const createInvoice = async () => {
    if (!canCreate || amountSats === null || metadata === null) return
    setCreating(true)
    setInvoiceFailed(false)
    try {
      await using run = appRun()
      const result = await run(fetchLnurlPayInvoice({ amountSats, metadata }))
      if (!result.ok) {
        setInvoiceFailed(true)
        return
      }
      router.push({
        pathname: "/settings/donations-invoice",
        params: { invoice: result.value.pr, verify: result.value.verify ?? "" },
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Screen>
      <FadeHeader title={t("settings.donations.title")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.donations.form.title")}</CardTitle>
          <CardDescription>
            {t("settings.donations.form.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>{t("settings.donations.fiat.label")}</FieldLabel>
              <Input
                value={fiatInput}
                keyboardType="decimal-pad"
                invalid={visibleAmountError !== null}
                onChangeText={(next) => {
                  setEditedAmount("fiat")
                  setFiatInput(next)
                }}
              />
              <FieldDescription>
                {t("settings.donations.fiat.description")}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>{t("settings.donations.sats.label")}</FieldLabel>
              <Input
                value={satsInput}
                keyboardType="number-pad"
                invalid={visibleAmountError !== null}
                onChangeText={(next) => {
                  setEditedAmount("sats")
                  setSatsInput(next)
                }}
              />
              <FieldDescription>
                {metadata === null
                  ? t("settings.donations.sats.description")
                  : t("settings.donations.sats.range", {
                      min: metadata.minSendableSats,
                      max: metadata.maxSendableSats,
                    })}
              </FieldDescription>
              <FieldError>
                {visibleAmountError === null
                  ? undefined
                  : t(visibleAmountError)}
              </FieldError>
            </Field>
            {/* No retry: the rate and the address are loaded once, by
                shared hooks without a refetch; leaving and coming back
                loads them again. Creating the invoice again is the
                button below. */}
            {loadErrorKey === null ? null : (
              <Alert variant="destructive" icon={TriangleAlert}>
                <AlertDescription>{t(loadErrorKey)}</AlertDescription>
              </Alert>
            )}
            {invoiceFailed ? (
              <Alert variant="destructive" icon={TriangleAlert}>
                <AlertDescription>
                  {t("settings.donations.invoice.error")}
                </AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        </CardContent>
        <CardFooter justify="flex-end">
          <Button
            label={t(
              creating
                ? "settings.donations.create.pending"
                : "settings.donations.create"
            )}
            iconStart={HeartHandshake}
            disabled={!canCreate || isLoading}
            pending={creating}
            onPress={() => {
              void createInvoice()
            }}
          />
        </CardFooter>
      </Card>
      <DonationHistory />
    </Screen>
  )
}
