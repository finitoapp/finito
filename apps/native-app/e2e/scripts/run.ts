// Runs the Maestro flows: `bun e2e/scripts/run.ts --platform web|android
// [--build] [--dev] [--jobs N] [flow.yaml ...]` (all of e2e/flows by default). Builds the
// e2e app when missing or with --build, writes the strings, runs, and leaves
// JUnit reports and screenshots in e2e/.generated/report. With --dev, Android
// runs a debug build on an e2e Metro, so a JS change needs no rebuild. See
// e2e/AGENTS.md. Web runs N flows at once (--jobs, default half the cores).
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import { availableParallelism } from "node:os"
import { join, relative, resolve } from "node:path"
import { parseArgs } from "node:util"
import { $ } from "bun"
import { serveMocks } from "./mock-server.ts"
import { serveWeb } from "./serve-web.ts"

const appDir = resolve(import.meta.dirname, "../..")
const e2eDir = join(appDir, "e2e")
const generated = join(e2eDir, ".generated")
// Overridable, so several checkouts (git worktrees) can run at once.
const webPort = Number(process.env.PAYKY_E2E_WEB_PORT ?? 8790)
const mockPort = Number(process.env.PAYKY_E2E_MOCK_PORT ?? 8791)
// Not 8081: a developer's own Metro (without the e2e switch) may hold it.
const metroPort = 8792
const maestro =
  Bun.which("maestro") ?? join(process.env.HOME ?? "", ".maestro/bin/maestro")
// The version e2e/AGENTS.md pins: other releases differ in selectors and
// subflow env handling, which shows up as odd flow failures, not an error.
const maestroVersion = "2.11.0"

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    platform: { type: "string" },
    build: { type: "boolean", default: false },
    dev: { type: "boolean", default: false },
    jobs: {
      type: "string",
      default: String(Math.max(1, Math.floor(availableParallelism() / 2))),
    },
  },
  allowPositionals: true,
})
// The debug build (--dev) installs as its own app, beside a release one
// (plugins/with-debug-app-id.cjs).
const appId = values.dev ? "fit.finito.app.dev" : "fit.finito.app"
const installed = (await $`${maestro} --version`.quiet().nothrow().text())
  .trim()
  .split("\n")
  .at(-1)
if (installed !== maestroVersion) {
  console.error(
    `Maestro ${maestroVersion} is required, found ${installed || "none"} (${maestro}); see e2e/AGENTS.md`
  )
  process.exit(2)
}

const platform = values.platform
if (platform !== "web" && platform !== "android") {
  console.error("--platform web|android is required")
  process.exit(2)
}

const reportDir = join(generated, "report", platform)

process.env.EXPO_PUBLIC_PAYKY_E2E = "1"
process.env.MAESTRO_CLI_NO_ANALYTICS = "1"
process.env.MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED = "true"

await $`bun ${join(e2eDir, "scripts/generate-strings.ts")}`
rmSync(reportDir, { recursive: true, force: true })
mkdirSync(reportDir, { recursive: true })

/** The .yaml files at `path`, a flow file or a folder of them. */
const yamlFiles = (path: string): ReadonlyArray<string> =>
  path.endsWith(".yaml")
    ? [path]
    : (readdirSync(path, { recursive: true }) as string[])
        .filter((file) => file.endsWith(".yaml"))
        .map((file) => join(path, file))

const flows = (positionals.length > 0 ? positionals : [join(e2eDir, "flows")])
  .flatMap((path) => yamlFiles(resolve(path)))
  .sort()

/** The flow's header `tags:` (the part before `---`), for platform filtering. */
const flowTags = async (flow: string): Promise<ReadonlyArray<string>> => {
  const header = (await Bun.file(flow).text()).split(/^---$/m)[0] ?? ""
  const parsed = Bun.YAML.parse(header) as { tags?: ReadonlyArray<string> }
  return parsed?.tags ?? []
}

const skipTag = {
  web: ["android-only", "ios-only"],
  android: ["web-only", "ios-only"],
}[platform]
const runnable: string[] = []
// Flows that drive one mock's shared state (the EET mock's connection and
// request log): on web they run one after another, beside the other flows.
const sharedStateTags = ["eet"]
const sharedState = new Set<string>()
for (const flow of flows) {
  const tags = await flowTags(flow)
  if (tags.some((tag) => skipTag.includes(tag))) continue
  runnable.push(flow)
  if (tags.some((tag) => sharedStateTags.includes(tag))) sharedState.add(flow)
}

/**
 * Points the build at the mock server (mock-server.ts) at `host`, as the app
 * sees it: 127.0.0.1 on web, the emulator's 10.0.2.2 alias of the host on
 * Android. Expo inlines EXPO_PUBLIC_* at build time, so the host is baked in.
 */
const pointAtMocks = (host: string) => {
  const base = `http://${host}:${mockPort}`
  process.env.EXPO_PUBLIC_PAYKY_API_BASE_URL = base
  process.env.EXPO_PUBLIC_PAYKY_YADIO_URL = base
  process.env.EXPO_PUBLIC_PAYKY_QERKO_BASE_URL = `${base}/qerko`
  process.env.EXPO_PUBLIC_PAYKY_EET_PRODUCTION_URL = `${base}/eet/services/EETServiceSOAP/v4`
  process.env.EXPO_PUBLIC_PAYKY_NOSTR_RELAYS = `ws://${host}:${mockPort}/nostr`
  process.env.EXPO_PUBLIC_PAYKY_EET_PLAYGROUND_URL = `${base}/eet-playground/services/EETServiceSOAP/v4`
}

const mocks = serveMocks(mockPort)
const exitCode = platform === "web" ? await runWeb() : await runAndroid()
mocks.stop(true)
console.log(`\nreports: ${relative(process.cwd(), reportDir)}`)
process.exit(exitCode)

async function runWeb(): Promise<number> {
  const webDir = join(generated, "web")
  pointAtMocks("127.0.0.1")
  if (values.build || !existsSync(join(webDir, "index.html")))
    await $`bun x expo export --platform web --output-dir ${webDir}`.cwd(appDir)
  const server = serveWeb(webDir, webPort)
  const baseUrl = `http://127.0.0.1:${webPort}/`
  const wrappers = join(generated, "web-flows")
  rmSync(wrappers, { recursive: true, force: true })
  mkdirSync(wrappers, { recursive: true })

  // Web needs a `url:` header and keeps OPFS between the flows of one
  // invocation, so each flow runs alone through a wrapper (section 9 of the
  // plan, e2e/AGENTS.md) — which also lets --jobs of them run at once, each
  // with its own wrapper and report.
  const failed: string[] = []
  const queue = runnable.filter((flow) => !sharedState.has(flow))
  const serialQueue = runnable.filter((flow) => sharedState.has(flow))
  const runOne = async (flow: string) => {
    const name = flowName(flow)
    const wrapper = join(wrappers, `${name}.yaml`)
    const report = join(reportDir, `${name}.xml`)
    await Bun.write(
      wrapper,
      `url: \${BASE_URL}\nname: ${name}\n---\n- runFlow: ${flow}\n`
    )
    const started = Date.now()
    const result =
      await $`${maestro} test -p web --headless --screen-size 412x915 -e BASE_URL=${baseUrl} -e APP_ID=${baseUrl} -e MOCK_URL=http://127.0.0.1:${mockPort} --format junit --output ${report} --test-output-dir ${join(reportDir, name)} ${wrapper}`
        .quiet()
        .nothrow()
    if (!(await reportFlow(name, started, result, report))) failed.push(name)
  }
  await Promise.all(
    [
      ...Array.from({ length: Number(values.jobs) }, () => queue),
      serialQueue,
    ].map(async (jobQueue) => {
      for (
        let flow = jobQueue.shift();
        flow !== undefined;
        flow = jobQueue.shift()
      )
        await runOne(flow)
    })
  )
  server.stop(true)
  return summarize(failed)
}

/** `flows/bill/x.yaml` → `bill__x`, the report's and wrapper's name. */
function flowName(flow: string): string {
  return relative(join(e2eDir, "flows"), flow)
    .replace(/\.yaml$/, "")
    .replaceAll("/", "__")
}

/** Prints the flow's one line, with its failure; true when it passed. */
async function reportFlow(
  name: string,
  started: number,
  result: { readonly exitCode: number; readonly stdout: Buffer },
  report: string
): Promise<boolean> {
  const seconds = Math.round((Date.now() - started) / 1000)
  if (result.exitCode === 0) {
    console.log(`[Passed] ${name} (${seconds}s)`)
    return true
  }
  // The JUnit failure, or Maestro's own output when it never got that far
  // (a YAML parse error).
  const junit = existsSync(report) ? await Bun.file(report).text() : ""
  const reason =
    /<failure[^>]*>([^<]+)/.exec(junit)?.[1] ??
    result.stdout.toString().trim().split("\n").at(-1)
  console.log(`[Failed] ${name} (${seconds}s) (${reason})`)
  return false
}

function summarize(failed: ReadonlyArray<string>): number {
  console.log(
    `\n${platform}: ${runnable.length - failed.length}/${runnable.length} passed${failed.length > 0 ? `; failed: ${failed.join(", ")}` : ""}`
  )
  return failed.length > 0 ? 1 : 0
}

async function runAndroid(): Promise<number> {
  // Never the user's own phone: an emulator unless ANDROID_SERIAL names a device.
  const devices = (await $`adb devices`.text())
    .split("\n")
    .filter((line) => line.endsWith("\tdevice"))
    .map((line) => line.split("\t")[0] ?? "")
  const serial =
    process.env.ANDROID_SERIAL ??
    devices.find((device) => device.startsWith("emulator-"))
  if (serial === undefined) {
    console.error("no emulator running; start one or set ANDROID_SERIAL")
    return 2
  }
  // Emulator only, as for Metro below; a USB device would need `adb reverse`.
  pointAtMocks(serial.startsWith("emulator-") ? "10.0.2.2" : "127.0.0.1")
  if (!serial.startsWith("emulator-"))
    await $`adb -s ${serial} reverse tcp:${mockPort} tcp:${mockPort}`.quiet()
  const variant = values.dev ? "debug" : "release"
  const apk = join(generated, values.dev ? "app-e2e-debug.apk" : "app-e2e.apk")
  if (values.build || !existsSync(apk)) {
    const androidDir = join(appDir, "android")
    // Always: the e2e switch changes the manifest (plugins/with-e2e-cleartext.cjs).
    await $`bun x expo prebuild --platform android --no-install`.cwd(appDir)
    // The JS bundle task does not see env changes; removing its output makes
    // it bundle again with EXPO_PUBLIC_PAYKY_E2E=1.
    rmSync(join(androidDir, "app/build/generated/assets/react/release"), {
      recursive: true,
      force: true,
    })
    const abi = (
      await $`adb -s ${serial} shell getprop ro.product.cpu.abi`.text()
    ).trim()
    const task = values.dev ? "assembleDebug" : "assembleRelease"
    await $`./gradlew ${task} -PreactNativeArchitectures=${abi}`
      .cwd(androidDir)
      .env({ ...process.env, SENTRY_DISABLE_AUTO_UPLOAD: "true" })
    await Bun.write(
      apk,
      Bun.file(
        join(androidDir, `app/build/outputs/apk/${variant}/app-${variant}.apk`)
      )
    )
  }
  const metro = values.dev ? await startMetro(serial) : undefined
  await $`adb -s ${serial} install -r ${apk}`
  // One invocation per flow, as on web: when Maestro's device server dies
  // mid-run, every later flow of that invocation fails within milliseconds.
  const failed: string[] = []
  for (const flow of runnable) {
    const name = flowName(flow)
    const report = join(reportDir, `${name}.xml`)
    const started = Date.now()
    const result =
      await $`${maestro} --device ${serial} test -e BASE_URL=finito:// -e APP_ID=${appId} -e MOCK_URL=http://127.0.0.1:${mockPort} ${metro === undefined ? [] : ["-e", `DEV_URL=${metro.url}`]} --format junit --output ${report} --test-output-dir ${join(reportDir, name)} ${flow}`
        .quiet()
        .nothrow()
    if (!(await reportFlow(name, started, result, report))) failed.push(name)
  }
  metro?.stop()
  return summarize(failed)
}

/**
 * An e2e Metro for the debug build (reused when one already answers on
 * `metroPort`). `url` is the
 * dev-client link the flows launch the app with (subflows/launch.yaml),
 * without the dev menu's first-run sheet, launch menu and tools button.
 */
async function startMetro(
  serial: string
): Promise<{ readonly url: string; readonly stop: () => void }> {
  const status = `http://127.0.0.1:${metroPort}/status`
  const running = async () =>
    (
      await fetch(status).then(
        (r) => r.text(),
        () => ""
      )
    ).includes("running")
  const process_ = (await running())
    ? undefined
    : Bun.spawn(["bun", "x", "expo", "start", "--port", String(metroPort)], {
        cwd: appDir,
        // Explicitly: a child does not see EXPO_PUBLIC_PAYKY_E2E set above,
        // and Metro without it bundles the app with the bridge turned off.
        env: { ...process.env },
        stdout: "ignore",
        stderr: "inherit",
      })
  while (!(await running())) await Bun.sleep(1000)
  // An emulator reaches the host at 10.0.2.2, which survives Maestro
  // restarting its device server (that drops `adb reverse` rules).
  const host = serial.startsWith("emulator-") ? "10.0.2.2" : "127.0.0.1"
  if (host === "127.0.0.1")
    await $`adb -s ${serial} reverse tcp:${metroPort} tcp:${metroPort}`.quiet()
  const bundle = encodeURIComponent(`http://${host}:${metroPort}`)
  return {
    url: `finito://expo-development-client/?url=${bundle}&__expo_disable_onboarding=1&__expo_disable_auto_launch=1&__expo_disable_fab=1`,
    stop: () => process_?.kill(),
  }
}
