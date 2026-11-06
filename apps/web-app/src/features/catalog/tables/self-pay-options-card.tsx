import { sqliteTrue } from "@evolu/common"
import { optionalIdCodec } from "@payky/app-shared/inline-edit-codecs"
import {
  setMenuOrdering,
  setOrderDevice,
  setSelfPayBillsHidden,
  setWrittenOrders,
} from "@payky/core/modules/app-settings/app-settings-actions"
import { selfPaySettingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { devicesQuery } from "@payky/core/modules/device/device-queries"
import type { DeviceId } from "@payky/core/modules/device/device-types"
import { loadSelfPayMenu } from "@payky/core/modules/menu-order/menu-order-actions"
import { countSelfPayMenuItems } from "@payky/core/modules/menu-order/menu-order-utils"
import { evoluHistoryMaxRowidQuery } from "@payky/core/modules/shared/evolu-history-queries"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { InlineEditSelect } from "@/features/shared/forms/inline-edit-select.tsx"
import { InlineEditSwitch } from "@/features/shared/forms/inline-edit-switch.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

const deviceCodec = optionalIdCodec<DeviceId>()

export function SelfPayOptionsCard() {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const thisDeviceId = useAtomValue(accountAtom).device.id
  const {
    data: [settings],
  } = useEvoluQuery(selfPaySettingsQuery)
  const menuOrdering = settings?.menuOrdering === sqliteTrue
  const writtenOrders = settings?.writtenOrders === sqliteTrue

  const saveBillsShown = async (shown: boolean) => {
    await using run = appRun()
    await run.ok(setSelfPayBillsHidden(!shown))
  }

  const saveMenuOrdering = async (on: boolean) => {
    await using run = appRun()
    await run.ok(setMenuOrdering({ on, deviceId: thisDeviceId }))
  }

  const saveWrittenOrders = async (on: boolean) => {
    await using run = appRun()
    await run.ok(setWrittenOrders({ on, deviceId: thisDeviceId }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("catalog.tables.selfPayOptions.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <InlineEditSwitch
          label={t("catalog.tables.selfPayOptions.payBill")}
          defaultValue={settings?.selfPayBillsHidden !== sqliteTrue}
          onSave={saveBillsShown}
        />
        <InlineEditSwitch
          label={t("catalog.tables.selfPayOptions.order")}
          description={t("catalog.tables.selfPayOptions.order.description")}
          defaultValue={menuOrdering}
          onSave={saveMenuOrdering}
        />
        {menuOrdering && <MenuStatus />}
        <InlineEditSwitch
          label={t("catalog.tables.selfPayOptions.written")}
          description={t("catalog.tables.selfPayOptions.written.description")}
          defaultValue={writtenOrders}
          onSave={saveWrittenOrders}
        />
        {(menuOrdering || writtenOrders) && (
          <OrderDeviceSelect orderDeviceId={settings?.orderDeviceId ?? null} />
        )}
      </CardContent>
    </Card>
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
            {t("catalog.tables.selfPayOptions.menu.empty.description")}
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
