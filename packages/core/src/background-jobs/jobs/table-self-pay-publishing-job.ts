import { DateIso, ok, type Run, sqliteTrue } from "@evolu/common"
import type { NostrEvent } from "../../integrations/nostr/nostr-event.ts"
import { fetchYadioBtcExchangeRate } from "../../integrations/yadio/yadio-client.ts"
import {
  fiatBankAccountQuery,
  sparkAccountQuery,
} from "../../modules/account/account-queries.ts"
import {
  selfPaySettingsQuery,
  settingsQuery,
} from "../../modules/app-settings/app-settings-queries.ts"
import { loadBillCoverage } from "../../modules/bill/bill-guards.ts"
import { catalogCategoriesQuery } from "../../modules/catalog-category/catalog-category-queries.ts"
import { catalogItemsQuery } from "../../modules/catalog-item/catalog-item-queries.ts"
import { activeFioPluginsQuery } from "../../modules/fio-plugin/fio-plugin-queries.ts"
import {
  dropReplacedMenuVersions,
  loadSelfPayMenu,
  saveSelfPayMenuVersion,
} from "../../modules/menu-order/menu-order-actions.ts"
import {
  recentMenuOrderClaimsQuery,
  recentMenuOrdersQuery,
} from "../../modules/menu-order/menu-order-queries.ts"
import {
  createSelfPayMenuEvent,
  createSelfPayOrderConfirmationEvent,
  type SelfPayOrderConfirmation,
} from "../../modules/menu-order/menu-order-utils.ts"
import { activeMonetaPluginsQuery } from "../../modules/moneta-plugin/moneta-plugin-queries.ts"
import {
  deriveSelfPayMenuKeys,
  deriveSelfPayRateKey,
  deriveSelfPaySelectionKey,
  deriveTableSelfPayKeys,
  type TableSelfPayKeys,
} from "../../modules/shared/key-derivation.ts"
import type { FiatCurrency, WssUrl } from "../../modules/shared/schema.ts"
import type { TableId } from "../../modules/table/table-types.ts"
import {
  dropExpiredSelfPayViewVersions,
  loadActiveSelfPayRelays,
  loadSelfPayInstructions,
  loadSelfPayViewPublishedAt,
  loadTableSelfPayView,
  saveSelfPayViewPublishResult,
  saveTableSelfPayViewSnapshot,
} from "../../modules/table-self-pay/table-self-pay-actions.ts"
import {
  selfPayRelaysQuery,
  selfPayTablesQuery,
  tableSelfPayVersionQuery,
} from "../../modules/table-self-pay/table-self-pay-queries.ts"
import {
  createSelfPayRate,
  signSelfPayRate,
} from "../../modules/table-self-pay/table-self-pay-rate-utils.ts"
import { hasSameRelays } from "../../modules/table-self-pay/table-self-pay-relay-utils.ts"
import {
  createDisabledSelfPayView,
  createSelfPayLivenessEvent,
  createSelfPayViewEvent,
  deriveSelfPayViewTag,
  type SelfPayLiveness,
  type SelfPayView,
} from "../../modules/table-self-pay/table-self-pay-view-utils.ts"
import type {
  AppBackgroundJob,
  AppBackgroundJobContext,
} from "../background-job-types.ts"
import { createKeyedTaskQueue } from "../keyed-task-queue.ts"

const PUBLISH_DEBOUNCE_MS = 2000
const LIVENESS_INTERVAL_MS = 5 * 60 * 1000
const CONFIRMED_ORDERS_WINDOW_MS = 24 * 60 * 60 * 1000

interface PublishedView {
  readonly content: string
  readonly createdAt: number
  readonly relays: ReadonlyArray<WssUrl>
}

interface LiveTable {
  readonly keys: TableSelfPayKeys
  readonly viewVersion: number
  readonly currencies: ReadonlySet<FiatCurrency>
  readonly lightning: boolean
}

export const createTableSelfPayPublishingJob =
  ({
    debounceMs = PUBLISH_DEBOUNCE_MS,
    livenessIntervalMs = LIVENESS_INTERVAL_MS,
  }: {
    readonly debounceMs?: number
    readonly livenessIntervalMs?: number
  } = {}): AppBackgroundJob =>
  (run) => {
    const jobRun = run.create({
      ...run.deps,
      console: run.deps.console.child("table-self-pay-publishing-job"),
    })
    const publishing = new TableSelfPayPublishing(jobRun, {
      debounceMs,
      livenessIntervalMs,
    })

    publishing.start()

    const disposer = new AsyncDisposableStack()
    disposer.use(jobRun)
    disposer.defer(() => publishing.dispose())

    return ok(disposer)
  }

export const startTableSelfPayPublishingJob = createTableSelfPayPublishingJob()

class TableSelfPayPublishing {
  private readonly run: Run<AppBackgroundJobContext>
  private readonly debounceMs: number
  private readonly root: Uint8Array
  private readonly queue = createKeyedTaskQueue({
    onError: (error) => this.run.deps.onError(error),
  })
  private readonly tableSubscriptions = new Map<TableId, () => void>()
  private readonly debounceTimers = new Map<
    TableId,
    ReturnType<typeof setTimeout>
  >()
  private readonly published = new Map<string, PublishedView>()
  private readonly liveTables = new Map<TableId, LiveTable>()
  private readonly confirmedOrders = new Map<
    string,
    { readonly shown: string; readonly createdAt: number }
  >()
  private liveMenu: LiveTable | null = null
  private liveMenuVersion: string | null = null
  private readonly unsubscribes: ReadonlyArray<() => void>
  private readonly refreshTimer: ReturnType<typeof setInterval>

  constructor(
    run: Run<AppBackgroundJobContext>,
    {
      debounceMs,
      livenessIntervalMs,
    }: { readonly debounceMs: number; readonly livenessIntervalMs: number }
  ) {
    this.run = run
    this.debounceMs = debounceMs
    this.root = run.deps.tableSelfPayRoot
    const { evolu } = run.deps
    this.unsubscribes = [
      evolu.subscribeQuery(selfPayTablesQuery)(() => {
        this.queueTableSync()
      }),
      evolu.subscribeQuery(selfPayRelaysQuery)(() => {
        this.queueRefresh()
      }),
      ...[
        selfPaySettingsQuery,
        fiatBankAccountQuery,
        sparkAccountQuery,
        activeFioPluginsQuery,
        activeMonetaPluginsQuery,
      ].map((query) =>
        evolu.subscribeQuery(query)(() => {
          this.queueTableSync()
          this.queueMenu()
        })
      ),
      ...[catalogItemsQuery, catalogCategoriesQuery, settingsQuery].map(
        (query) =>
          evolu.subscribeQuery(query)(() => {
            this.queueMenu()
          })
      ),
      ...[recentMenuOrdersQuery, recentMenuOrderClaimsQuery].map((query) =>
        evolu.subscribeQuery(
          query(
            DateIso.orThrow(
              new Date(
                run.deps.date.now().getTime() - CONFIRMED_ORDERS_WINDOW_MS
              ).toISOString()
            )
          )
        )(() => {
          this.queueConfirmations()
        })
      ),
    ]
    this.refreshTimer = setInterval(() => {
      this.queueRefresh()
    }, livenessIntervalMs)
    ;(this.refreshTimer as { readonly unref?: () => void }).unref?.()
  }

  start(): void {
    this.queueTableSync()
    this.queueMenu()
  }

  async dispose(): Promise<void> {
    if (this.queue.isDisposed) return

    for (const unsubscribe of this.unsubscribes) unsubscribe()
    for (const unsubscribe of this.tableSubscriptions.values()) unsubscribe()
    for (const timer of this.debounceTimers.values()) clearTimeout(timer)
    clearInterval(this.refreshTimer)
    await this.queue[Symbol.asyncDispose]()
  }

  private queueTableSync(): void {
    this.queue.enqueue("tables", () => this.syncTables())
  }

  private queueRefresh(): void {
    this.queue.enqueue("refresh", () => this.refresh())
  }

  private queueMenu(): void {
    this.queue.enqueue("menu", () => this.publishMenu())
  }

  private queueConfirmations(): void {
    this.queue.enqueue("confirmations", () => this.publishConfirmations())
  }

  private async takesOrders(): Promise<boolean> {
    const [settings] = await this.run.deps.evolu.loadQuery(selfPaySettingsQuery)
    return (
      settings?.menuOrdering === sqliteTrue &&
      settings.orderDeviceId === this.run.deps.deviceId
    )
  }

  private async publishMenu(): Promise<void> {
    if (!(await this.takesOrders())) {
      this.liveMenu = null
      this.liveMenuVersion = null
      return
    }
    const { menu } = await this.run.ok(loadSelfPayMenu())
    await this.run.ok(saveSelfPayMenuVersion(menu))
    this.liveMenuVersion = menu.version
    const relays = await this.run.ok(loadActiveSelfPayRelays())
    const { signingKey, publicKey, readKey } = deriveSelfPayMenuKeys(this.root)
    const createdAt = await this.publishContent({
      relays,
      tag: deriveSelfPayViewTag(readKey),
      content: JSON.stringify(menu),
      version: Math.floor(this.run.deps.date.now().getTime() / 1000),
      createEvent: (version) =>
        createSelfPayMenuEvent({
          signingKey,
          readKey,
          menu,
          createdAt: version,
        }),
    })
    const instructions = await this.run.ok(loadSelfPayInstructions())
    const wasLive = this.liveMenu !== null
    this.liveMenu = {
      keys: { signingKey, publicKey, viewKey: readKey },
      viewVersion: createdAt,
      currencies: new Set([menu.currency]),
      lightning: instructions.lightning !== null,
    }
    if (!wasLive) {
      const rates = await this.loadRates([this.liveMenu])
      await this.publishLiveness(relays, rates, this.liveMenu)
    }
  }

  private async publishConfirmations(): Promise<void> {
    if (!(await this.takesOrders())) return
    const now = this.run.deps.date.now().getTime()
    const orders = await this.run.deps.evolu.loadQuery(
      recentMenuOrdersQuery(
        DateIso.orThrow(
          new Date(now - CONFIRMED_ORDERS_WINDOW_MS).toISOString()
        )
      )
    )
    const relays = await this.run.ok(loadActiveSelfPayRelays())
    const menuSigningKey = deriveSelfPayMenuKeys(this.root).signingKey
    const selectionKey = deriveSelfPaySelectionKey(this.root)
    for (const order of orders) {
      const { billTotal, claimedSum } = await this.run.ok(
        loadBillCoverage(order.billId)
      )
      const last = this.confirmedOrders.get(order.pointer)
      const confirmation: SelfPayOrderConfirmation = {
        v: 1,
        number: order.number,
        total: billTotal,
        covered: Math.min(claimedSum, billTotal),
        at: Math.max(Math.floor(now / 1000), (last?.createdAt ?? 0) + 1),
      }
      const shown = JSON.stringify([confirmation.number, confirmation.covered])
      if (last?.shown === shown) continue
      const results = await this.run.deps.nostrRelayClient.publish(
        relays,
        createSelfPayOrderConfirmationEvent({
          menuSigningKey,
          pointer: order.pointer,
          selectionKey,
          confirmation,
          createdAt: confirmation.at,
        })
      )
      if (results.some(({ accepted }) => accepted)) {
        this.confirmedOrders.set(order.pointer, {
          shown,
          createdAt: confirmation.at,
        })
      }
    }
  }

  private async syncTables(): Promise<void> {
    const { evolu } = this.run.deps
    const tables = await evolu.loadQuery(selfPayTablesQuery)
    if (this.queue.isDisposed) return
    const tableIds = new Set(tables.map(({ id }) => id))

    for (const [tableId, unsubscribe] of this.tableSubscriptions) {
      if (tableIds.has(tableId)) continue
      unsubscribe()
      this.tableSubscriptions.delete(tableId)
      this.liveTables.delete(tableId)
    }
    for (const tableId of tableIds) {
      if (!this.tableSubscriptions.has(tableId)) {
        this.tableSubscriptions.set(
          tableId,
          evolu.subscribeQuery(tableSelfPayVersionQuery(tableId))(() => {
            this.schedulePublish(tableId)
          })
        )
      }
      this.schedulePublish(tableId)
    }
  }

  private schedulePublish(tableId: TableId): void {
    const pending = this.debounceTimers.get(tableId)
    if (pending !== undefined) clearTimeout(pending)
    const timer = setTimeout(() => {
      this.debounceTimers.delete(tableId)
      this.queue.enqueue(`publish:${tableId}`, () => this.publishTable(tableId))
    }, this.debounceMs)
    ;(timer as { readonly unref?: () => void }).unref?.()
    this.debounceTimers.set(tableId, timer)
  }

  private async publishTable(tableId: TableId): Promise<void> {
    const table = (
      await this.run.deps.evolu.loadQuery(selfPayTablesQuery)
    ).find(({ id }) => id === tableId)
    if (table === undefined) return

    const snapshot = await this.run.ok(loadTableSelfPayView(table))
    await this.run.ok(saveTableSelfPayViewSnapshot(snapshot))

    const relays = await this.run.ok(loadActiveSelfPayRelays())
    const epoch = table.selfPayEpoch ?? 0
    const keys = deriveTableSelfPayKeys(this.root, table.id, epoch)
    const viewVersion = await this.publishView(
      relays,
      keys,
      snapshot.view,
      snapshot.version
    )
    const versionAfterEveryEarlierView = snapshot.version + 1
    for (let earlier = 0; earlier < epoch; earlier++) {
      await this.publishView(
        relays,
        deriveTableSelfPayKeys(this.root, table.id, earlier),
        createDisabledSelfPayView(table.name),
        versionAfterEveryEarlierView
      )
    }

    const wasLive = this.liveTables.has(table.id)
    if (snapshot.view.bills.length === 0) {
      this.liveTables.delete(table.id)
    } else {
      const live = {
        keys,
        viewVersion,
        currencies: snapshot.currencies,
        lightning: snapshot.view.lightning !== null,
      }
      this.liveTables.set(table.id, live)
      if (!wasLive) {
        const rates = await this.loadRates([live])
        await this.publishTableLiveness(relays, rates, table.id)
      }
    }
  }

  private publishView(
    relays: ReadonlyArray<WssUrl>,
    keys: TableSelfPayKeys,
    view: SelfPayView,
    version: number
  ): Promise<number> {
    return this.publishContent({
      relays,
      tag: deriveSelfPayViewTag(keys.viewKey),
      content: JSON.stringify(view),
      version,
      createEvent: (createdAt) =>
        createSelfPayViewEvent({ ...keys, view, version: createdAt }),
    })
  }

  private async publishContent({
    relays,
    tag,
    content,
    version,
    createEvent,
  }: {
    readonly relays: ReadonlyArray<WssUrl>
    readonly tag: string
    readonly content: string
    readonly version: number
    readonly createEvent: (createdAt: number) => NostrEvent
  }): Promise<number> {
    const last = this.published.get(tag)
    if (last?.content === content && hasSameRelays(last.relays, relays)) {
      return last.createdAt
    }

    const lastCreatedAt =
      last?.createdAt ?? (await this.run.ok(loadSelfPayViewPublishedAt(tag)))
    const createdAt =
      lastCreatedAt !== null && version <= lastCreatedAt
        ? lastCreatedAt + 1
        : version
    const results = await this.run.deps.nostrRelayClient.publish(
      relays,
      createEvent(createdAt)
    )
    const accepted = results.filter((result) => result.accepted).length
    if (accepted > 0) {
      this.published.set(tag, { content, createdAt, relays })
    }
    await this.run.ok(
      saveSelfPayViewPublishResult({
        tag,
        createdAt,
        version,
        content,
        relays: relays.map((url) => ({
          url,
          accepted: results.some(
            (result) => result.url === url && result.accepted
          ),
        })),
      })
    )
    this.run.deps.console.debug("Published table self-pay content.", {
      accepted,
      createdAt,
    })
    return createdAt
  }

  private async refresh(): Promise<void> {
    for (const tableId of this.tableSubscriptions.keys()) {
      this.schedulePublish(tableId)
    }
    const relays = await this.run.ok(loadActiveSelfPayRelays())
    const liveMenu = this.liveMenu
    const rates = await this.loadRates([
      ...this.liveTables.values(),
      ...(liveMenu === null ? [] : [liveMenu]),
    ])
    for (const tableId of this.liveTables.keys()) {
      if (this.queue.isDisposed) return
      await this.publishTableLiveness(relays, rates, tableId)
    }
    if (liveMenu !== null) await this.publishLiveness(relays, rates, liveMenu)
    this.queueConfirmations()
    await this.run.ok(dropExpiredSelfPayViewVersions())
    if (this.liveMenuVersion !== null) {
      await this.run.ok(dropReplacedMenuVersions(this.liveMenuVersion))
    }
  }

  private async publishTableLiveness(
    relays: ReadonlyArray<WssUrl>,
    rates: SelfPayLiveness["rates"],
    tableId: TableId
  ): Promise<void> {
    const live = this.liveTables.get(tableId)
    if (live === undefined) return
    await this.publishLiveness(relays, rates, live)
  }

  private async publishLiveness(
    relays: ReadonlyArray<WssUrl>,
    rates: SelfPayLiveness["rates"],
    live: LiveTable
  ): Promise<void> {
    const liveness: SelfPayLiveness = {
      v: 1,
      viewVersion: live.viewVersion,
      rates: live.lightning
        ? rates.filter(({ currency }) => live.currencies.has(currency))
        : [],
    }
    await this.run.deps.nostrRelayClient.publish(
      relays,
      createSelfPayLivenessEvent({
        ...live.keys,
        liveness,
        now: Math.floor(this.run.deps.date.now().getTime() / 1000),
      })
    )
  }

  private async loadRates(
    tables: ReadonlyArray<LiveTable>
  ): Promise<SelfPayLiveness["rates"]> {
    const currencies = new Set(
      tables.flatMap(({ lightning, currencies }) =>
        lightning ? [...currencies] : []
      )
    )
    const rateKey = deriveSelfPayRateKey(this.root)
    const rates: SelfPayLiveness["rates"][number][] = []
    for (const currency of currencies) {
      const quote = await this.run(fetchYadioBtcExchangeRate(currency))
      if (!quote.ok) {
        this.run.deps.console.warn("Skipped a self-pay rate.", {
          currency,
          reason: quote.error.type,
        })
        continue
      }
      const rate = createSelfPayRate({
        currency,
        exchangeRate: quote.value.exchangeRate,
        now: this.run.deps.date.now(),
      })
      rates.push({ currency, ...signSelfPayRate(rateKey, rate) })
    }
    return rates
  }
}
