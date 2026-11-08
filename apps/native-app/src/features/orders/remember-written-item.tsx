import {
  type CatalogItemFormErrors,
  createPriceCodec,
  parseCatalogItemForm,
} from "@payky/app-shared/catalog-item-form-schema"
import { formatTime } from "@payky/app-shared/format-date"
import { useNow } from "@payky/app-shared/use-now"
import {
  selfPaySettingsQuery,
  settingsQuery,
} from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import { catalogItemByIdQuery } from "@payky/core/modules/catalog-item/catalog-item-queries"
import { isInMenu } from "@payky/core/modules/catalog-item/catalog-item-utils"
import {
  deriveRememberedCatalogItemId,
  type MenuOrderToServe,
  rememberWrittenItemForToday,
} from "@payky/core/modules/menu-order/menu-order-actions"
import {
  menuDayEndAfter,
  menuDayEndHourOf,
} from "@payky/core/modules/menu-order/menu-order-utils"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { useState } from "react"
import { Text } from "tamagui"
import { z } from "zod"
import { Button } from "../../components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../components/ui/field.tsx"
import { Input } from "../../components/ui/input.tsx"
import { useRequirePermission } from "../../core/use-access.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { fontSize } from "../../theme/tokens.ts"

export function RememberWrittenItem({
  billId,
  line,
}: {
  readonly billId: MenuOrderToServe["billId"]
  readonly line: NonNullable<MenuOrderToServe["written"]>["lines"][number]
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [isOpen, setIsOpen] = useState(false)
  const {
    data: [remembered],
  } = useEvoluQuery(
    catalogItemByIdQuery(deriveRememberedCatalogItemId(line.id))
  )
  const now = useNow([remembered?.inMenuUntil ?? null])

  if (remembered !== undefined && isInMenu(remembered, now)) {
    return (
      <Text
        testID="written-line-remembered"
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        color="muted-foreground"
      >
        {remembered.inMenuUntil === null
          ? t("catalog.items.inMenu")
          : t("orders.written.remembered", {
              time: formatTime(new Date(remembered.inMenuUntil), locale),
            })}
      </Text>
    )
  }

  return (
    <>
      <Button
        self="flex-start"
        variant="secondary"
        size="sm"
        testID="remember-written-line"
        aria-label={t("orders.remember.title", { text: line.text })}
        label={t("orders.written.remember")}
        onPress={() => setIsOpen(true)}
      />
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {isOpen ? (
          <RememberWrittenItemForm
            billId={billId}
            line={line}
            onRemembered={() => setIsOpen(false)}
          />
        ) : null}
      </Dialog>
    </>
  )
}

function RememberWrittenItemForm({
  billId,
  line,
  onRemembered,
}: {
  readonly billId: MenuOrderToServe["billId"]
  readonly line: NonNullable<MenuOrderToServe["written"]>["lines"][number]
  readonly onRemembered: () => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const [settings] = useEvoluQuery(settingsQuery).data
  const [selfPaySettings] = useEvoluQuery(selfPaySettingsQuery).data
  const currency = getFiatCurrency(settings)
  const [name, setName] = useState(line.text)
  const [price, setPrice] = useState(() =>
    z.encode(createPriceCodec(currency), NonNegativeInteger(line.named.value))
  )
  const [errors, setErrors] = useState<CatalogItemFormErrors>({})
  const [pending, setPending] = useState(false)

  const error = (field: "name" | "price") => {
    const key = errors[field]
    return key === undefined ? undefined : t(key)
  }

  const submit = async () => {
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
      currency
    )
    if (!parsed.ok) {
      setErrors(parsed.error)
      return
    }
    if (!(await require("catalog", "access.action.rememberItem"))) return
    setPending(true)
    await runToast(async (run) => {
      const result = await run(
        rememberWrittenItemForToday({
          billId,
          lineId: line.id,
          name: parsed.value.name,
          unitAmount: parsed.value.price,
        })
      )
      if (!result.ok) return "app.saveFailed"
      onRemembered()
      return undefined
    })
    setPending(false)
  }

  return (
    <DialogContent closeLabel={t("dialog.close")}>
      <DialogHeader>
        <DialogTitle>
          {t("orders.remember.title", { text: line.text })}
        </DialogTitle>
        <DialogDescription>
          {t("orders.remember.description", {
            time: formatTime(
              menuDayEndAfter(new Date(), menuDayEndHourOf(selfPaySettings)),
              locale
            ),
          })}
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel>{t("catalog.items.form.name.label")}</FieldLabel>
          <Input
            value={name}
            disabled={pending}
            invalid={errors.name !== undefined}
            autoComplete="off"
            autoCorrect={false}
            onChangeText={(next) => {
              setName(next)
              setErrors((current) => ({ ...current, name: undefined }))
            }}
          />
          <FieldError>{error("name")}</FieldError>
        </Field>
        <Field>
          <FieldLabel>{t("catalog.items.form.price.label")}</FieldLabel>
          <Input
            value={price}
            disabled={pending}
            invalid={errors.price !== undefined}
            autoComplete="off"
            keyboardType="decimal-pad"
            onChangeText={(next) => {
              setPrice(next)
              setErrors((current) => ({ ...current, price: undefined }))
            }}
          />
          <FieldError>{error("price")}</FieldError>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button
          testID="remember-written-line-save"
          label={t("orders.remember.save")}
          pending={pending}
          onPress={() => void submit()}
        />
      </DialogFooter>
    </DialogContent>
  )
}
