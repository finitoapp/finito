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
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { router } from "expo-router"
import { useAtomValue } from "jotai"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { Text, YStack } from "tamagui"
import { z } from "zod"
import { accountAtom } from "../../../atoms/account.ts"
import { InlineEditField } from "../../../components/inline-edit-field.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert.tsx"
import {
  Card,
  CardContent,
  CardDescription,
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
import { AlertLink, NoPaymentMethodAlert } from "./table-self-pay-card.tsx"
import { TableStickerCheck } from "./table-sticker-check.tsx"
import {
  useBankReachesGuests,
  useGuestsHaveNoPaymentMethod,
} from "./use-guests-cannot-pay-reason.ts"

const deviceCodec = optionalIdCodec<DeviceId>()

/** Self-pay options of the account, as web's `SelfPayOptionsCard`. */
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
  const runToast = useRunToast()
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

  const billsShown = useInlineChoice(billPaying, (shown) =>
    runToast(async (run) => {
      await run.ok(setSelfPayBillsHidden(!shown))
    })
  )
  const ordering = useInlineChoice(menuOrdering, (on) =>
    runToast(async (run) => {
      await run.ok(setMenuOrdering({ on, deviceId: thisDeviceId }))
    })
  )

  return (
    <CardContent gap={16}>
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
        onSave={(selfPayGuestName) =>
          runToast(async (run) => {
            await run.ok(updateSettings({ selfPayGuestName }))
          })
        }
      />
      <Field orientation="horizontal">
        <Switch
          aria-label={t("catalog.tables.selfPayOptions.payBill")}
          checked={billsShown.value}
          disabled={billsShown.saving || isLastOn(billPaying)}
          onCheckedChange={(checked) => {
            void billsShown.choose(checked)
          }}
        />
        <FieldContent>
          <FieldLabel>{t("catalog.tables.selfPayOptions.payBill")}</FieldLabel>
        </FieldContent>
      </Field>
      {isLastOn(billPaying) && <LastGuestOptionNote />}
      <Field orientation="horizontal">
        <Switch
          aria-label={t("catalog.tables.selfPayOptions.order")}
          checked={ordering.value}
          disabled={ordering.saving || isLastOn(menuOrdering)}
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
      {isLastOn(menuOrdering) && <LastGuestOptionNote />}
      {menuOrdering && <MenuStatus />}
      {menuOrdering && (
        <OrderDeviceSelect orderDeviceId={settings?.orderDeviceId ?? null} />
      )}
      {bankReachesGuests && (
        <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
          {t("catalog.tables.selfPay.bankNote")}
        </Text>
      )}
      <TableStickerCheck />
    </CardContent>
  )
}

function LastGuestOptionNote() {
  const { t } = useTranslation()

  return (
    <Text mt={-8} fontSize="xs" lineHeight="xs" color="muted-foreground">
      {t("catalog.tables.selfPayOptions.lastOn")}
    </Text>
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
            <AlertLink
              label={t("catalog.tables.selfPayOptions.menu.empty.link")}
              onPress={() => router.push("/settings/items")}
            />
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
