import { type Evolu as BaseEvolu, createQueryBuilder } from "@evolu/common"
import type { IndexesConfig } from "@evolu/common/local-first"

import { accessControl } from "../modules/access/access.ts"
import {
  account,
  accountCardSwitchio,
  accountCashRegister,
  accountCashu,
  accountIban,
  accountIndexes,
  accountLightningAddress,
  accountQerkoPayment,
  accountQerkoTerminal,
  accountSpark,
  sparkAccountSyncPointer,
} from "../modules/account/account.ts"
import {
  accountTransaction,
  accountTransactionCashu,
  accountTransactionIban,
  accountTransactionIndexes,
  accountTransactionLightning,
  accountTransactionOnchain,
  accountTransactionSource,
  accountTransactionSpark,
  accountTransactionSparkInvoice,
} from "../modules/account-transaction/account-transaction.ts"
import { appSettings } from "../modules/app-settings/app-settings.ts"
import { bill, billIndexes } from "../modules/bill/bill.ts"
import { billLine, billLineIndexes } from "../modules/bill-line/bill-line.ts"
import {
  cardSwitchioClosure,
  cardSwitchioClosureIndexes,
} from "../modules/card-switchio-closure/card-switchio-closure.ts"
import {
  _cashuBookingCursor,
  cashuIndexes,
  cashuOperation,
  cashuProof,
  setting,
  shardPointer,
} from "../modules/cashu/cashu.ts"
import { catalogCategory } from "../modules/catalog-category/catalog-category.ts"
import {
  catalogItem,
  catalogItemIndexes,
} from "../modules/catalog-item/catalog-item.ts"
import { device, deviceIndexes } from "../modules/device/device.ts"
import {
  eetCertificate,
  eetIndexes,
  eetReversal,
  eetReversalConfirmation,
  eetSale,
  eetSaleConfirmation,
  eetSettings,
} from "../modules/eet/eet.ts"
import {
  fioPlugin,
  fioPluginIndexes,
  fioPluginSyncLease,
  fioPluginSyncPointer,
  fioPluginToken,
  fioSyncDeviceUptime,
} from "../modules/fio-plugin/fio-plugin.ts"
import { item, itemIndexes } from "../modules/item/item.ts"
import { legalEntity } from "../modules/legal-entity/legal-entity.ts"
import {
  monetaPlugin,
  monetaPluginIndexes,
  monetaPluginSyncPointer,
} from "../modules/moneta-plugin/moneta-plugin.ts"
import {
  payment,
  paymentBtc,
  paymentBtcLightning,
  paymentBtcSpark,
  paymentCardSwitchio,
  paymentCashRegister,
  paymentCashu,
  paymentIban,
  paymentIndexes,
  paymentLightningAddress,
  paymentQerkoPayment,
  paymentQerkoTerminal,
  paymentSelfPay,
  qerkoPaymentAttempt,
} from "../modules/payment/payment.ts"
import {
  paymentLine,
  paymentLineIndexes,
} from "../modules/payment-line/payment-line.ts"
import {
  paymentLastNumber,
  paymentNumber,
} from "../modules/payment-number/payment-number.ts"
import { paymentNumberSeries } from "../modules/payment-number-series/payment-number-series.ts"
import { qerkoPlugin } from "../modules/qerko-plugin/qerko-plugin.ts"
import {
  reconciliationClaim,
  reconciliationClaimIndexes,
} from "../modules/reconciliation-claim/reconciliation-claim.ts"
import {
  cardSwitchioRefundAttempt,
  qerkoTerminalRefundAttempt,
  refund,
  refundCardSwitchio,
  refundCashRegister,
  refundIndexes,
  refundLine,
  refundQerkoTerminal,
} from "../modules/refund/refund.ts"
import { table } from "../modules/table/table.ts"
import {
  billSelfPayReference,
  selfPayAllocation,
  selfPayRelay,
  selfPayViewPublication,
  selfPayViewVersion,
  tableSelfPayIndexes,
} from "../modules/table-self-pay/table-self-pay.ts"
import { taxRate, taxRateIndexes } from "../modules/tax-rate/tax-rate.ts"
import {
  withdrawal,
  withdrawalCashuSend,
  withdrawalIndexes,
  withdrawalLightning,
  withdrawalLightningCashu,
  withdrawalOnchain,
} from "../modules/withdraw/withdraw.ts"

export const AppSchema = {
  accessControl,
  device,
  account,
  accountIban,
  accountSpark,
  sparkAccountSyncPointer,
  accountCashRegister,
  accountCardSwitchio,
  accountQerkoTerminal,
  accountQerkoPayment,
  accountCashu,
  accountLightningAddress,
  accountTransaction,
  accountTransactionIban,
  accountTransactionSpark,
  accountTransactionSparkInvoice,
  accountTransactionLightning,
  accountTransactionOnchain,
  accountTransactionCashu,
  accountTransactionSource,
  catalogCategory,
  catalogItem,
  item,
  legalEntity,
  taxRate,
  table,
  bill,
  billLine,
  payment,
  paymentCashRegister,
  paymentBtc,
  paymentBtcLightning,
  paymentBtcSpark,
  paymentIban,
  paymentCardSwitchio,
  cardSwitchioClosure,
  paymentQerkoTerminal,
  paymentQerkoPayment,
  qerkoPaymentAttempt,
  paymentCashu,
  paymentLightningAddress,
  paymentSelfPay,
  paymentLine,
  paymentNumber,
  paymentLastNumber,
  reconciliationClaim,
  appSettings,
  paymentNumberSeries,
  fioPlugin,
  fioPluginSyncPointer,
  fioPluginSyncLease,
  fioSyncDeviceUptime,
  fioPluginToken,
  monetaPlugin,
  monetaPluginSyncPointer,
  qerkoPlugin,
  eetSettings,
  eetCertificate,
  eetSale,
  eetSaleConfirmation,
  eetReversal,
  eetReversalConfirmation,
  refund,
  refundCashRegister,
  refundCardSwitchio,
  refundQerkoTerminal,
  refundLine,
  cardSwitchioRefundAttempt,
  qerkoTerminalRefundAttempt,
  withdrawal,
  withdrawalOnchain,
  withdrawalLightning,
  withdrawalLightningCashu,
  withdrawalCashuSend,
  // Linky's tables, under Linky's owners only (src/core/modules/cashu/cashu.ts).
  shardPointer,
  setting,
  cashuProof,
  cashuOperation,
  // Local-only: never synced (src/core/modules/cashu/cashu.ts).
  _cashuBookingCursor,
  billSelfPayReference,
  selfPayAllocation,
  selfPayViewVersion,
  selfPayViewPublication,
  selfPayRelay,
} as const

export const createQuery = createQueryBuilder(AppSchema)

export const createAppIndexes: IndexesConfig = (create) => [
  ...accountIndexes(create),
  ...accountTransactionIndexes(create),
  ...itemIndexes(create),
  ...catalogItemIndexes(create),
  ...taxRateIndexes(create),
  ...billIndexes(create),
  ...billLineIndexes(create),
  ...paymentIndexes(create),
  ...cardSwitchioClosureIndexes(create),
  ...paymentLineIndexes(create),
  ...reconciliationClaimIndexes(create),
  ...deviceIndexes(create),
  ...fioPluginIndexes(create),
  ...monetaPluginIndexes(create),
  ...eetIndexes(create),
  ...refundIndexes(create),
  ...withdrawalIndexes(create),
  ...cashuIndexes(create),
  ...tableSelfPayIndexes(create),
]

export type EvoluSchema = typeof AppSchema
export type Evolu = BaseEvolu<EvoluSchema>
