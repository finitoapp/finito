import { parseArgs } from "node:util"
import { installPolyfills } from "@evolu/common/polyfills"
import { createInProcessLockManager } from "../src/runtime/in-process-lock-manager.ts"
import { type CashuRun, runCashu, runProbes } from "./cashu-bench.ts"
import { now } from "./probes.ts"
import { formatMs, printCashu, printProbes, printSpark } from "./report.ts"
import { runSpark } from "./spark-bench.ts"

/**
 * Benchmarks Finito's real Cashu and Spark sync pipelines against in-memory
 * Evolu and latency-injected fake mint, Spark and Nostr services.
 * Run before and after a latency fix: `bun run bench:payment-latency`.
 */

const { values: args } = parseArgs({
  options: {
    rtt: { type: "string", default: "150" },
    "prior-payments": { type: "string", default: "10" },
    proofs: { type: "string", default: "200" },
    "spark-history": { type: "string", default: "20" },
    only: { type: "string" },
    json: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
})

if (args.help) {
  console.log(`Usage: bun run bench:payment-latency [options]

  --rtt <ms>             simulated round trip of every mint, Yadio and Spark call (150)
  --prior-payments <n>   earlier Cashu payments whose Lightning quotes stay pending (10)
  --proofs <n>           spent proofs seeded into the wallet history (200)
  --spark-history <n>    Spark transfers of the last hour, already booked (20)
  --only <section>       run one section: cashu, spark or probes
  --json                 print the measurements as JSON`)
  process.exit(0)
}

const wholeNumber = (name: string, value: string): number => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0)
    throw new Error(`--${name} takes a whole number, got "${value}"`)
  return parsed
}

const allSections = ["cashu", "spark", "probes"] as const
if (args.only !== undefined && !allSections.includes(args.only as never))
  throw new Error(`--only takes ${allSections.join(", ")}, got "${args.only}"`)

const sections = new Set<string>(
  args.only === undefined ? allSections : [args.only]
)
const options = {
  rttMs: wholeNumber("rtt", args.rtt),
  priorPayments: wholeNumber("prior-payments", args["prior-payments"]),
  proofs: wholeNumber("proofs", args.proofs),
  sparkHistory: wholeNumber("spark-history", args["spark-history"]),
}

// Bun's `navigator` has no `locks`; the CLI installs the same in-process shim.
installPolyfills()
const navigatorWithLocks = globalThis.navigator as Navigator & {
  locks?: LockManager
}
navigatorWithLocks.locks ??= createInProcessLockManager()

const main = async () => {
  const startedAt = now()
  const cashu: CashuRun[] = []
  if (sections.has("cashu")) {
    for (const priorPayments of [...new Set([0, options.priorPayments])])
      cashu.push(await runCashu(options, priorPayments))
  }
  const spark = sections.has("spark") ? await runSpark(options) : null
  const probes = sections.has("probes") ? await runProbes(options) : null

  const report = {
    options,
    cashu,
    spark,
    probes,
    totalMs: now() - startedAt,
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log("Finito payment latency benchmark")
  console.log(
    `RTT ${options.rttMs} ms per call, ${options.proofs} spent proofs in the wallet, ${options.sparkHistory} Spark transfers in the last hour`
  )
  if (cashu.length > 0) printCashu(cashu)
  if (spark !== null) printSpark(spark)
  if (probes !== null) printProbes(probes)
  console.log(`\nTotal ${formatMs(report.totalMs)}`)
}

await main()
