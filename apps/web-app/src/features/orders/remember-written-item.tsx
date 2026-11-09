import { parseCatalogItemForm } from "@payky/app-shared/catalog-item-form-schema"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { useNow } from "@payky/app-shared/use-now"
import {
  selfPaySettingsQuery,
  settingsQuery,
} from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import { setCatalogItemInMenu } from "@payky/core/modules/catalog-item/catalog-item-actions"
import { catalogItemByIdQuery } from "@payky/core/modules/catalog-item/catalog-item-queries"
import { isInMenu } from "@payky/core/modules/catalog-item/catalog-item-utils"
import {
  deriveRememberedCatalogItemId,
  type MenuOrderToServe,
  rememberWrittenItem,
} from "@payky/core/modules/menu-order/menu-order-actions"
import {
  menuDayEndAfter,
  menuDayEndHourOf,
} from "@payky/core/modules/menu-order/menu-order-utils"
import { minorUnitsToDecimalString } from "@payky/core/modules/shared/money"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { useRequirePermission } from "@/hooks/use-access.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatTime } from "@/lib/format-utils.ts"

export function RememberWrittenItem({
  billId,
  line,
}: {
  readonly billId: MenuOrderToServe["billId"]
  readonly line: NonNullable<MenuOrderToServe["written"]>["lines"][number]
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const [dialogForGood, setDialogForGood] = useState<boolean | null>(null)
  const id = deriveRememberedCatalogItemId(line.id)
  const {
    data: [remembered],
  } = useEvoluQuery(catalogItemByIdQuery(id))
  const now = useNow([remembered?.inMenuUntil ?? null])

  const keepForGood = async () => {
    if (!(await require("catalog", "access.action.rememberItem"))) return
    await runToast(async (run) => {
      await run.ok(setCatalogItemInMenu({ id, inMenu: true }))
    })
  }

  if (remembered !== undefined && isInMenu(remembered, now)) {
    const { inMenuUntil } = remembered
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {inMenuUntil === null
            ? t("catalog.items.inMenu")
            : t("orders.written.remembered", {
                time: formatTime(new Date(inMenuUntil), locale),
              })}
        </span>
        {inMenuUntil === null ? null : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void keepForGood()}
          >
            {t("orders.written.keepForGood")}
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialogForGood(false)}
        >
          {t("orders.written.remember")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialogForGood(true)}
        >
          {t("orders.written.addForGood")}
        </Button>
      </div>
      {dialogForGood === null ? null : (
        <RememberWrittenItemDialog
          billId={billId}
          line={line}
          forGood={dialogForGood}
          onClose={() => setDialogForGood(null)}
        />
      )}
    </>
  )
}

function RememberWrittenItemDialog({
  billId,
  line,
  forGood,
  onClose,
}: {
  readonly billId: MenuOrderToServe["billId"]
  readonly line: NonNullable<MenuOrderToServe["written"]>["lines"][number]
  readonly forGood: boolean
  readonly onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const formId = useId()
  const {
    data: [settings],
  } = useEvoluQuery(settingsQuery)
  const {
    data: [selfPaySettings],
  } = useEvoluQuery(selfPaySettingsQuery)
  const [name, setName] = useState(line.text)
  const [price, setPrice] = useState<string>(
    minorUnitsToDecimalString(line.named)
  )
  const [nameError, setNameError] = useState<TranslationKey | null>(null)
  const [priceError, setPriceError] = useState<TranslationKey | null>(null)
  const [pending, setPending] = useState(false)
  const until = formatTime(
    menuDayEndAfter(new Date(), menuDayEndHourOf(selfPaySettings)),
    locale
  )

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {forGood
              ? t("orders.remember.forGood.title", { text: line.text })
              : t("orders.remember.title", { text: line.text })}
          </DialogTitle>
          <DialogDescription>
            {forGood
              ? t("orders.remember.forGood.description")
              : t("orders.remember.description", { time: until })}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const parsed = parseCatalogItemForm(
              {
                name,
                price,
                description: "",
                internalName: "",
                internalDescription: "",
                sku: "",
                scanCode: "",
              },
              getFiatCurrency(settings)
            )
            if (!parsed.ok) {
              setNameError(parsed.error.name ?? null)
              setPriceError(parsed.error.price ?? null)
              return
            }
            const values = parsed.value

            void (async () => {
              if (!(await require("catalog", "access.action.rememberItem"))) {
                return
              }
              setPending(true)
              await runToast(async (run) => {
                const remembered = await run(
                  rememberWrittenItem({
                    billId,
                    lineId: line.id,
                    name: values.name,
                    unitAmount: values.price,
                    forGood,
                  })
                )
                if (!remembered.ok) return "app.saveFailed"
                onClose()
              })
              setPending(false)
            })()
          }}
        >
          <FieldGroup>
            <Field data-invalid={nameError !== null}>
              <FieldLabel htmlFor={`${formId}-name`}>
                {t("catalog.items.form.name.label")}
              </FieldLabel>
              <Input
                id={`${formId}-name`}
                value={name}
                disabled={pending}
                aria-invalid={nameError !== null}
                autoComplete="off"
                onChange={(event) => {
                  setName(event.currentTarget.value)
                  setNameError(null)
                }}
              />
              <FieldError>{nameError ? t(nameError) : null}</FieldError>
            </Field>
            <Field data-invalid={priceError !== null}>
              <FieldLabel htmlFor={`${formId}-price`}>
                {t("catalog.items.form.price.label")}
              </FieldLabel>
              <Input
                id={`${formId}-price`}
                value={price}
                disabled={pending}
                aria-invalid={priceError !== null}
                autoComplete="off"
                inputMode="decimal"
                onChange={(event) => {
                  setPrice(event.currentTarget.value)
                  setPriceError(null)
                }}
              />
              <FieldError>{priceError ? t(priceError) : null}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {t("orders.remember.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
