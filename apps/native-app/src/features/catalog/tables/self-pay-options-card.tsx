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
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { Text, YStack } from "tamagui"
import { z } from "zod"
import { accountAtom } from "../../../atoms/account.ts"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert.tsx"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select.tsx"
import { Switch } from "../../../components/ui/switch.tsx"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize } from "../../../theme/tokens.ts"

const deviceCodec = optionalIdCodec<DeviceId>()

/** Self-pay options of the account, as web's `SelfPayOptionsCard`. */
export function SelfPayOptionsCard() {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const thisDeviceId = useAtomValue(accountAtom).device.id
  const {
    data: [settings],
  } = useEvoluQuery(selfPaySettingsQuery)
  const menuOrdering = settings?.menuOrdering === sqliteTrue
  const writtenOrders = settings?.writtenOrders === sqliteTrue

  const billsShown = useInlineChoice(
    settings?.selfPayBillsHidden !== sqliteTrue,
    (shown) =>
      runToast(async (run) => {
        await run.ok(setSelfPayBillsHidden(!shown))
      })
  )
  const ordering = useInlineChoice(menuOrdering, (on) =>
    runToast(async (run) => {
      await run.ok(setMenuOrdering({ on, deviceId: thisDeviceId }))
    })
  )
  const writing = useInlineChoice(writtenOrders, (on) =>
    runToast(async (run) => {
      await run.ok(setWrittenOrders({ on, deviceId: thisDeviceId }))
    })
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("catalog.tables.selfPayOptions.title")}</CardTitle>
      </CardHeader>
      <CardContent gap={16}>
        <Field orientation="horizontal">
          <Switch
            aria-label={t("catalog.tables.selfPayOptions.payBill")}
            checked={billsShown.value}
            disabled={billsShown.saving}
            onCheckedChange={(checked) => {
              void billsShown.choose(checked)
            }}
          />
          <FieldContent>
            <FieldLabel>
              {t("catalog.tables.selfPayOptions.payBill")}
            </FieldLabel>
          </FieldContent>
        </Field>
        <Field orientation="horizontal">
          <Switch
            aria-label={t("catalog.tables.selfPayOptions.order")}
            checked={ordering.value}
            disabled={ordering.saving}
            onCheckedChange={(checked) => {
              void ordering.choose(checked)
            }}
          />
          <FieldContent>
            <FieldLabel>{t("catalog.tables.selfPayOptions.order")}</FieldLabel>
            <FieldDescription>
              {t("catalog.tables.selfPayOptions.order.description")}
            </FieldDescription>
          </FieldContent>
        </Field>
        {menuOrdering && <MenuStatus />}
        <Field orientation="horizontal">
          <Switch
            aria-label={t("catalog.tables.selfPayOptions.written")}
            checked={writing.value}
            disabled={writing.saving}
            onCheckedChange={(checked) => {
              void writing.choose(checked)
            }}
          />
          <FieldContent>
            <FieldLabel>
              {t("catalog.tables.selfPayOptions.written")}
            </FieldLabel>
            <FieldDescription>
              {t("catalog.tables.selfPayOptions.written.description")}
            </FieldDescription>
          </FieldContent>
        </Field>
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
  const runToast = useRunToast()
  const thisDeviceId = useAtomValue(accountAtom).device.id
  const { data: devices } = useEvoluQuery(devicesQuery)
  const listed = devices.some(({ id }) => id === orderDeviceId)
  const orderDevice = useInlineChoice(
    listed ? orderDeviceId : null,
    (deviceId) =>
      runToast(async (run) => {
        if (deviceId !== null) await run.ok(setOrderDevice(deviceId))
      })
  )
  const options = devices.map(({ id, name }) => ({
    value: id,
    label:
      id === thisDeviceId
        ? t("catalog.tables.selfPayOptions.orderDevice.this", { name })
        : name,
  }))

  return (
    <Field>
      <FieldLabel>
        {t("catalog.tables.selfPayOptions.orderDevice.label")}
      </FieldLabel>
      <Select
        value={z.encode(deviceCodec, orderDevice.value)}
        disabled={orderDevice.saving}
        onValueChange={(value) => {
          const parsed = z.safeDecode(deviceCodec, value)
          if (parsed.success) void orderDevice.choose(parsed.data)
        }}
        items={Object.fromEntries(
          options.map((option) => [option.value, option.label])
        )}
      >
        <SelectTrigger
          fullWidth
          aria-label={t("catalog.tables.selfPayOptions.orderDevice.label")}
        >
          <SelectValue
            placeholder={t(
              "catalog.tables.selfPayOptions.orderDevice.placeholder"
            )}
          />
        </SelectTrigger>
        <SelectContent
          title={t("catalog.tables.selfPayOptions.orderDevice.label")}
        >
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <FieldDescription>
        {t("catalog.tables.selfPayOptions.orderDevice.description")}
      </FieldDescription>
    </Field>
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
    <YStack gap={8}>
      {count === 0 ? (
        <Alert variant="warning" icon={TriangleAlert}>
          <AlertTitle numberOfLines={0}>
            {t("catalog.tables.selfPayOptions.menu.empty.title")}
          </AlertTitle>
          <AlertDescription>
            {t("catalog.tables.selfPayOptions.menu.empty.description")}
          </AlertDescription>
        </Alert>
      ) : (
        <Text fontSize={fontSize.sm} lineHeight={fontSize.sm}>
          {t("catalog.tables.selfPayOptions.menu.visible", { count })}
        </Text>
      )}
      {snapshot.leftOut > 0 && (
        <Text fontSize={fontSize.sm} lineHeight={fontSize.sm} color="warning">
          {t("catalog.tables.selfPayOptions.menu.leftOut", {
            count: snapshot.leftOut,
          })}
        </Text>
      )}
      {snapshot.otherCurrency > 0 && (
        <Text fontSize={fontSize.sm} lineHeight={fontSize.sm} color="warning">
          {t("catalog.tables.selfPayOptions.menu.otherCurrency", {
            count: snapshot.otherCurrency,
            currency: snapshot.menu.currency,
          })}
        </Text>
      )}
    </YStack>
  )
}
