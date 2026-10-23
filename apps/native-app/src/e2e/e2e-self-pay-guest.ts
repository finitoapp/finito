import { hexToBytes, sleep } from "@evolu/common"
import { createNostrRelayClient } from "@payky/core/integrations/nostr/nostr-relay-client"
import { billByIdQuery } from "@payky/core/modules/bill/bill-queries"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import {
  deriveTableSelfPayKeys,
  deriveTableSelfPayRoot,
} from "@payky/core/modules/shared/key-derivation"
import type { TableId } from "@payky/core/modules/table/table-types"
import {
  createTableSelfPayAddress,
  parseTableSelfPayAddress,
  type TableSelfPayAddress,
} from "@payky/core/modules/table-self-pay/table-self-pay-address-utils"
import {
  createSelfPayViewFilter,
  pickNewestSelfPayContent,
  publishSelfPaySelection,
} from "@payky/core/modules/table-self-pay/table-self-pay-guest-utils"
import {
  createSelfPaySelectionEvent,
  createSelfPayShareSelectionText,
  deriveSelfPayShareBillVersion,
} from "@payky/core/modules/table-self-pay/table-self-pay-pointer-utils"
import { projectSelfPayViewBill } from "@payky/core/modules/table-self-pay/table-self-pay-projection-utils"
import {
  selfPayRelaysQuery,
  selfPayTablesQuery,
  tableSelfPayBillsQuery,
} from "@payky/core/modules/table-self-pay/table-self-pay-queries"
import {
  deriveBillSelfPayReference,
  type SelfPayPointer,
  type SelfPayReference,
} from "@payky/core/modules/table-self-pay/table-self-pay-reference-utils"
import {
  activeSelfPayRelays,
  listSelfPayRelays,
  selfPayAddressRelays,
  selfPayRelaysToRead,
} from "@payky/core/modules/table-self-pay/table-self-pay-relay-utils"
import {
  calculateSelfPayShare,
  type SelfPaySplit,
} from "@payky/core/modules/table-self-pay/table-self-pay-share-utils"
import {
  deriveSelfPayViewTag,
  type SelfPayView,
  type SelfPayViewBill,
  SelfPayViewSchema,
} from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { nativeEnv } from "../core/native-env.ts"
import type { NativeAppRun } from "../hooks/use-app-run.ts"

export interface GuestLineShare {
  readonly name: string
  readonly numerator: number
  readonly denominator: number
}

export interface GuestPick {
  readonly lines?: ReadonlyArray<GuestLineShare> | undefined
  readonly people?: number | undefined
}

export interface GuestSelection {
  readonly bill: SelfPayViewBill
  readonly amount: number
  readonly pointer: SelfPayPointer
}

const VIEW_READ_ATTEMPTS = 40

const guestRelays = createNostrRelayClient()

const guestRelaysOf = (address: TableSelfPayAddress) =>
  selfPayRelaysToRead(
    address.relays,
    nativeEnv.EXPO_PUBLIC_PAYKY_SELF_PAY_RELAYS
  )

export async function selectSelfPayShare(
  run: NativeAppRun,
  billId: BillId,
  pick: GuestPick
): Promise<GuestSelection> {
  const [billRow] = await run.deps.evolu.loadQuery(billByIdQuery(billId))
  const tableId = billRow?.tableId ?? null
  if (tableId === null) throw new Error(`Bill ${billId} is on no table.`)
  const address = await scanTableSticker(run, tableId)
  const { bill, selectionKey } = await readBillAsTheTillHasIt(run, address, {
    tableId,
    billId,
  })
  const split = chooseSplit(bill, pick)
  const { pointer, event } = createSelfPaySelectionEvent({
    selectionText: createSelfPayShareSelectionText({ bill, split }),
    selectionKey: hexToBytes(selectionKey),
    createdAt: Math.floor(run.deps.date.now().getTime() / 1000),
  })
  const isSeenByRestaurant = await publishSelfPaySelection({
    relayClient: guestRelays,
    relays: guestRelaysOf(address),
    event,
  })
  if (!isSeenByRestaurant) throw new Error("No relay took the selection.")
  return {
    bill,
    amount: calculateSelfPayShare(bill, split, bill.currency).amount,
    pointer,
  }
}

async function scanTableSticker(
  run: NativeAppRun,
  tableId: TableId
): Promise<TableSelfPayAddress> {
  const tables = await run.deps.evolu.loadQuery(selfPayTablesQuery)
  const table = tables.find(({ id }) => id === tableId)
  if (table === undefined) throw new Error(`Table ${tableId} has no sticker.`)
  const defaults = nativeEnv.EXPO_PUBLIC_PAYKY_SELF_PAY_RELAYS
  const relayRows = await run.deps.evolu.loadQuery(selfPayRelaysQuery)
  const address = parseTableSelfPayAddress(
    createTableSelfPayAddress(nativeEnv.EXPO_PUBLIC_PAYKY_SELF_PAY_ORIGIN, {
      ...deriveTableSelfPayKeys(
        deriveTableSelfPayRoot(run.deps.masterKey),
        table.id,
        table.selfPayEpoch ?? 0
      ),
      relays: selfPayAddressRelays(
        activeSelfPayRelays(listSelfPayRelays(defaults, relayRows)),
        defaults
      ),
    })
  )
  if (address === null) throw new Error(`Table ${tableId} has no address.`)
  return address
}

async function readBillAsTheTillHasIt(
  run: NativeAppRun,
  address: TableSelfPayAddress,
  { tableId, billId }: { readonly tableId: TableId; readonly billId: BillId }
): Promise<{ readonly bill: SelfPayViewBill; readonly selectionKey: string }> {
  const reference = deriveBillSelfPayReference(billId)
  for (let attempt = 1; attempt <= VIEW_READ_ATTEMPTS; attempt++) {
    const view = await readTableView(address)
    const bill = view?.bills.find(
      (candidate) => candidate.reference === reference
    )
    const selectionKey = view?.selectionKey ?? null
    if (
      bill !== undefined &&
      selectionKey !== null &&
      deriveSelfPayShareBillVersion(bill) ===
        (await tillBillVersion(run, { tableId, billId, reference }))
    )
      return { bill, selectionKey }
    await run.ok(sleep("500ms"))
  }
  throw new Error(`The relays never showed bill ${billId} as the till has it.`)
}

async function readTableView(
  address: TableSelfPayAddress
): Promise<SelfPayView | undefined> {
  const events = await guestRelays.query(
    guestRelaysOf(address),
    createSelfPayViewFilter(address)
  )
  return pickNewestSelfPayContent({
    events,
    publicKey: address.publicKey,
    viewKey: address.viewKey,
    tag: deriveSelfPayViewTag(address.viewKey),
    schema: SelfPayViewSchema,
  })?.value
}

async function tillBillVersion(
  run: NativeAppRun,
  {
    tableId,
    billId,
    reference,
  }: {
    readonly tableId: TableId
    readonly billId: BillId
    readonly reference: SelfPayReference
  }
): Promise<string | null> {
  const rows = await run.deps.evolu.loadQuery(tableSelfPayBillsQuery(tableId))
  const row = rows.find(({ id }) => id === billId)
  return row === undefined
    ? null
    : deriveSelfPayShareBillVersion(projectSelfPayViewBill(row, reference))
}

const chooseSplit = (
  bill: SelfPayViewBill,
  { lines, people }: GuestPick
): SelfPaySplit => {
  if (lines !== undefined)
    return {
      kind: "lines",
      fractions: lines.map(({ name, numerator, denominator }) => ({
        key: lineKeyNamed(bill, name),
        numerator,
        denominator,
      })),
    }
  if (people !== undefined)
    return { kind: "fractionOfBill", denominator: people }
  return { kind: "remainder" }
}

const lineKeyNamed = (bill: SelfPayViewBill, name: string): string => {
  const line = bill.lines.find((candidate) => candidate.name === name)
  if (line === undefined) throw new Error(`The bill has no line ${name}.`)
  return line.key
}
