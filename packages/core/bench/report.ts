import type { CashuRun, ProbesRun } from "./cashu-bench.ts"
import type { WriteBatchCounts } from "./probes.ts"
import type { SparkRun } from "./spark-bench.ts"

export const formatMs = (ms: number): string =>
  `${Math.round(ms).toLocaleString("en-US")} ms`

const formatBatches = ({ app, device }: WriteBatchCounts): string =>
  `${app} app + ${device} device`

const printTable = (
  title: string,
  header: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string>>
) => {
  const widths = header.map((_, column) =>
    Math.max(...[header, ...rows].map((row) => (row[column] ?? "").length))
  )
  const formatRow = (row: ReadonlyArray<string>) =>
    row
      .map((cell, column) =>
        column === 0
          ? cell.padEnd(widths[column] ?? 0)
          : cell.padStart(widths[column] ?? 0)
      )
      .join("  ")
      .trimEnd()
  console.log(`\n${title}`)
  console.log(formatRow(header))
  console.log(widths.map((width) => "-".repeat(width)).join("  "))
  for (const row of rows) console.log(formatRow(row))
}

export const printCashu = (cashu: ReadonlyArray<CashuRun>) => {
  const header = ["", ...cashu.map((r) => `${r.priorPayments} prior payments`)]
  const row = (label: string, read: (r: CashuRun) => string) => [
    label,
    ...cashu.map(read),
  ]

  printTable("1. Cashu Lightning: quote paid -> Paid", header, [
    row("paid -> detected by poll", (r) =>
      formatMs(r.lightning.paidToDetectedMs)
    ),
    row("detected -> Paid", (r) => formatMs(r.lightning.detectedToPaidMs)),
    row("paid -> Paid (total)", (r) => formatMs(r.lightning.paidToPaidMs)),
    row("poll sweeps after payment", (r) =>
      String(r.lightning.sweepsWhileWaiting)
    ),
    row("  sweeps that skipped quote", (r) =>
      String(r.lightning.sweepsThatSkippedQuote)
    ),
    row("quote checks in detecting sweep", (r) =>
      String(r.lightning.quoteChecksInSweep)
    ),
    row("  paid quote position", (r) =>
      String(r.lightning.quotePositionInSweep)
    ),
    row("full proof scans, sweep -> detected", (r) =>
      String(r.lightning.proofScansBeforeDetection)
    ),
    row("full proof scans, detected -> Paid", (r) =>
      String(r.lightning.proofScansDetectedToPaidCount)
    ),
    row("mint calls, detected -> Paid", (r) =>
      String(r.lightning.mintCallsDetectedToPaidCount)
    ),
    row("write batches, detected -> Paid", (r) =>
      formatBatches(r.lightning.writeBatchesDetectedToPaid)
    ),
  ])
  for (const r of cashu)
    console.log(
      `  ${r.priorPayments} prior, mint calls: ${r.lightning.mintCallsDetectedToPaidSummary}`
    )

  printTable("2. Cashu NIP-17 token: delivered -> receiving -> Paid", header, [
    row("A. delivered -> receiving", (r) =>
      formatMs(r.token.deliveredToReceivingMs)
    ),
    row("   quote checks ahead in queue", (r) =>
      String(r.token.quoteChecksAheadOfToken)
    ),
    row("B. receiving -> Paid", (r) => formatMs(r.token.receivingToPaidMs)),
    row("delivered -> Paid (total)", (r) =>
      formatMs(r.token.deliveredToPaidMs)
    ),
    row("B: POST /v1/checkstate", (r) => String(r.token.checkstateCalls)),
    row("B: POST /v1/swap", (r) => String(r.token.swapCalls)),
    row("B: mint calls", (r) => String(r.token.mintCallsStageBCount)),
    row("B: full proof scans", (r) => String(r.token.proofScansStageBCount)),
    row("B:   time in proof scans", (r) =>
      formatMs(r.token.proofScansStageBMs)
    ),
    row("B: write batches", (r) => formatBatches(r.token.writeBatchesStageB)),
  ])
  for (const r of cashu)
    console.log(
      `  ${r.priorPayments} prior, mint calls: ${r.token.mintCallsStageBSummary}`
    )
}

export const printSpark = (spark: SparkRun) =>
  printTable(
    "3. Spark: balance:update x2, transfer:claimed -> Paid",
    ["", "value"],
    [
      ["events -> Paid", formatMs(spark.eventsToPaidMs)],
      ["events -> sync queue drained", formatMs(spark.eventsToQueueDrainedMs)],
      ["queue order after events", spark.queueOrder.join(", ")],
      ["getTransfers calls", String(spark.getTransfersCalls)],
      ["getTransfer calls", String(spark.getTransferCalls)],
      ["SDK calls finished before Paid", String(spark.callsBeforePaid)],
      [
        "getTransfer(id) started after",
        formatMs(spark.getTransferStartedAfterMs),
      ],
    ]
  )

export const printProbes = ({ preparation, mintTimeout }: ProbesRun) => {
  printTable(
    "4. Probes",
    ["", "value"],
    [
      ["Yadio calls, 2 back-to-back payments", String(preparation.yadioCalls)],
      ...preparation.payments.map((payment, index) => [
        `payment ${index + 1} preparation (QR shown)`,
        formatMs(payment.ms),
      ]),
      [
        "mint requests carry an AbortSignal",
        mintTimeout.requestsCarrySignal ? "yes" : "no",
      ],
      [
        `loadCashuWallet, silent mint, ${mintTimeout.windowMs} ms`,
        mintTimeout.settled ?? "still pending",
      ],
    ]
  )
  preparation.payments.forEach((payment, index) => {
    console.log(`  payment ${index + 1} calls: ${payment.callsSummary}`)
  })
}
