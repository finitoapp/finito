import { sqliteTrue } from "@evolu/common"
import {
  optionalIdCodec,
  optionalTextCodec,
} from "@payky/app-shared/inline-edit-codecs"
import {
  setMenuOrdering,
  setOrderDevice,
  setSelfPayBillsHidden,
  updateSettings,
} from "@payky/core/modules/app-settings/app-settings-actions"
import { selfPaySettingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { devicesQuery } from "@payky/core/modules/device/device-queries"
import type { DeviceId } from "@payky/core/modules/device/device-types"
import { loadSelfPayMenu } from "@payky/core/modules/menu-order/menu-order-actions"
import { countSelfPayMenuItems } from "@payky/core/modules/menu-order/menu-order-utils"
import { evoluHistoryMaxRowidQuery } from "@payky/core/modules/shared/evolu-history-queries"
import type { NonEmptyString255 } from "@payky/core/modules/shared/schema"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import { TriangleAlertIcon } from "lucide-react"
import { accountAtom } from "@/atoms/account.ts"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { NoPaymentMethodAlert } from "@/features/catalog/tables/table-self-pay-card.tsx"
import { TableStickerCheck } from "@/features/catalog/tables/table-sticker-check.tsx"
import {
  useBankReachesGuests,
  useGuestsHaveNoPaymentMethod,
} from "@/features/catalog/tables/use-guests-cannot-pay-reason.ts"
import { InlineEditField } from "@/features/shared/forms/inline-edit-field.tsx"
import { InlineEditSelect } from "@/features/shared/forms/inline-edit-select.tsx"
import { InlineEditSwitch } from "@/features/shared/forms/inline-edit-switch.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

const deviceCodec = optionalIdCodec<DeviceId>()

export function SelfPayOptionsCard() {
  const { t } = useTranslation()
  const { data: tables } = useEvoluQuery(tablesQuery)
  const withQrCode = tables.filter(
    ({ selfPayEnabled }) => selfPayEnabled === sqliteTrue
  ).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("catalog.tables.selfPayOptions.title")}</CardTitle>
        <CardDescription>
          {withQrCode === 0
            ? t("catalog.tables.selfPay.description")
            : t("catalog.tables.selfPayOptions.withQrCode", {
                count: withQrCode,
                total: tables.length,
              })}
        </CardDescription>
      </CardHeader>
      {withQrCode > 0 && <SelfPayOptions />}
    </Card>
  )
}

function SelfPayOptions() {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const thisDeviceId = useAtomValue(accountAtom).device.id
  const {
    data: [settings],
  } = useEvoluQuery(selfPaySettingsQuery)
  const billPaying = settings?.selfPayBillsHidden !== sqliteTrue
  const menuOrdering = settings?.menuOrdering === sqliteTrue
  const optionsOn = [billPaying, menuOrdering].filter((on) => on).length
  const isLastOn = (on: boolean) => on && optionsOn === 1
  const guestsHaveNoPaymentMethod = useGuestsHaveNoPaymentMethod()
  const bankReachesGuests = useBankReachesGuests()

  const saveGuestName = async (selfPayGuestName: NonEmptyString255 | null) => {
    await using run = appRun()
    await run.ok(updateSettings({ selfPayGuestName }))
  }

  const saveBillsShown = async (shown: boolean) => {
    await using run = appRun()
    await run.ok(setSelfPayBillsHidden(!shown))
  }

  const saveMenuOrdering = async (on: boolean) => {
    await using run = appRun()
    await run.ok(setMenuOrdering({ on, deviceId: thisDeviceId }))
  }

  return (
    <CardContent className="flex flex-col gap-4">
      {guestsHaveNoPaymentMethod && (
        <NoPaymentMethodAlert
          title={t("catalog.tables.selfPayOptions.noPaymentMethod.title")}
        />
      )}
      <InlineEditField
        label={t("catalog.tables.selfPayGuestName.label")}
        description={t("catalog.tables.selfPayGuestName.description")}
        placeholder={t("catalog.tables.selfPayGuestName.placeholder")}
        defaultValue={settings?.selfPayGuestName ?? null}
        codec={optionalTextCodec}
        errorKey="catalog.tables.selfPayGuestName.error"
        onSave={saveGuestName}
      />
      <InlineEditSwitch
        label={t("catalog.tables.selfPayOptions.payBill")}
        defaultValue={billPaying}
        disabled={isLastOn(billPaying)}
        onSave={saveBillsShown}
      />
      {isLastOn(billPaying) && <LastGuestOptionNote />}
      <InlineEditSwitch
        label={t("catalog.tables.selfPayOptions.order")}
        description={t("catalog.tables.selfPayOptions.order.description")}
        defaultValue={menuOrdering}
        disabled={isLastOn(menuOrdering)}
        onSave={saveMenuOrdering}
      />
      {isLastOn(menuOrdering) && <LastGuestOptionNote />}
      {menuOrdering && <MenuStatus />}
      {menuOrdering && (
        <OrderDeviceSelect orderDeviceId={settings?.orderDeviceId ?? null} />
      )}
      {bankReachesGuests && (
        <p className="text-xs text-muted-foreground">
          {t("catalog.tables.selfPay.bankNote")}
        </p>
      )}
      <TableStickerCheck />
    </CardContent>
  )
}

function LastGuestOptionNote() {
  const { t } = useTranslation()

  return (
    <p className="-mt-2 text-xs text-muted-foreground">
      {t("catalog.tables.selfPayOptions.lastOn")}
    </p>
  )
}

function OrderDeviceSelect({
  orderDeviceId,
}: {
  readonly orderDeviceId: DeviceId | null
}) {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const thisDeviceId = useAtomValue(accountAtom).device.id
  const { data: devices } = useEvoluQuery(devicesQuery)
  const listed = devices.some(({ id }) => id === orderDeviceId)

  const save = async (deviceId: DeviceId | null) => {
    if (deviceId === null) return
    await using run = appRun()
    await run.ok(setOrderDevice(deviceId))
  }

  return (
    <InlineEditSelect
      label={t("catalog.tables.selfPayOptions.orderDevice.label")}
      description={t("catalog.tables.selfPayOptions.orderDevice.description")}
      placeholder={t("catalog.tables.selfPayOptions.orderDevice.placeholder")}
      defaultValue={listed ? orderDeviceId : undefined}
      codec={deviceCodec}
      options={devices.map(({ id, name }) => ({
        value: id,
        label:
          id === thisDeviceId
            ? t("catalog.tables.selfPayOptions.orderDevice.this", { name })
            : name,
      }))}
      onSave={save}
    />
  )
}

function MenuStatus() {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const {
    data: [history],
  } = useEvoluQuery(evoluHistoryMaxRowidQuery)
  const { data: snapshot } = useQuery({
    queryKey: ["selfPayMenu", history?.maxRowid ?? null],
    queryFn: async () => {
      await using run = appRun()
      return await run.ok(loadSelfPayMenu())
    },
    placeholderData: keepPreviousData,
  })

  if (snapshot === undefined) return null
  const count = countSelfPayMenuItems(snapshot.menu)

  return (
    <div className="flex flex-col gap-2 text-sm">
      {count === 0 ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle className="line-clamp-none">
            {t("catalog.tables.selfPayOptions.menu.empty.title")}
          </AlertTitle>
          <AlertDescription>
            <p>{t("catalog.tables.selfPayOptions.menu.empty.description")}</p>
            <Link
              to="/catalog/items"
              className="font-medium text-foreground underline underline-offset-4"
            >
              {t("catalog.tables.selfPayOptions.menu.empty.link")}
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <p>{t("catalog.tables.selfPayOptions.menu.visible", { count })}</p>
      )}
      {snapshot.leftOut > 0 && (
        <p className="text-warning">
          {t("catalog.tables.selfPayOptions.menu.leftOut", {
            count: snapshot.leftOut,
          })}
        </p>
      )}
      {snapshot.otherCurrency > 0 && (
        <p className="text-warning">
          {t("catalog.tables.selfPayOptions.menu.otherCurrency", {
            count: snapshot.otherCurrency,
            currency: snapshot.menu.currency,
          })}
        </p>
      )}
    </div>
  )
}
