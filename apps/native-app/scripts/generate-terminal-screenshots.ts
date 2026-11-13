// Generates the screenshots of Finito's card terminal documentation
// (landing/0015): `bun run docs:screenshots:terminal` (root). Builds the web
// export with EXPO_PUBLIC_PAYKY_E2E=1, so the fake SwitchioPay
// (src/e2e/e2e-switchio-presets.ts) can stand in for the terminal, pointed at
// the e2e mock server; drives it with Playwright in every language at the
// NEXGO N92's display (@payky/doc-mockups/terminal-geometry) and composes
// each capture into docs/terminal/<language>/<shot>.webp, which the landing's
// terminal page shows.
// PAYKY_SCREENSHOT_SCENARIOS=payment,closure regenerates only those
// scenarios (screenshots/terminal-scenarios.ts), PAYKY_SCREENSHOT_LANGUAGES=en
// only those languages, and PAYKY_SCREENSHOT_SKIP_BUILD=1 reuses the last
// export.
import { mkdir, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { type Language, resources } from "@payky/app-shared/i18n/resources"
import { composeTerminalShot } from "@payky/doc-mockups/compose-terminal-shot"
import {
  terminalCaptureHeight,
  terminalCaptureWidth,
  terminalDeviceScaleFactor,
} from "@payky/doc-mockups/terminal-geometry"
import { terminalShotNames } from "@payky/doc-mockups/terminal-shots"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"
import { resetDocumentScroll } from "./screenshots/finito-scenarios.ts"
import { switchioOnEveryLoad } from "./screenshots/finito-steps.ts"
import { startFinitoWeb } from "./screenshots/finito-web.ts"
import {
  prepareCardTerminal,
  type TerminalShoot,
  terminalScenarios,
} from "./screenshots/terminal-scenarios.ts"

const listFromCommas = z.string().transform((value) =>
  value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "")
)

const languages = Object.keys(resources) as [Language, ...Language[]]

const env = createEnv({
  server: {
    PAYKY_SCREENSHOT_SCENARIOS: listFromCommas.optional(),
    PAYKY_SCREENSHOT_LANGUAGES: listFromCommas
      .pipe(z.array(z.enum(languages)))
      .optional(),
    PAYKY_SCREENSHOT_SKIP_BUILD: z.stringbool().default(false),
    // Neither the e2e runner's ports, nor the documentation's, nor the
    // Google Play listing's, so all of them can run at once.
    PAYKY_SCREENSHOT_TERMINAL_WEB_PORT: z.coerce.number().int().default(8797),
    PAYKY_SCREENSHOT_TERMINAL_MOCK_PORT: z.coerce.number().int().default(8798),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

/** A Friday morning in Prague, the contexts' time zone. */
const capturedAt = new Date("2026-11-13T10:30:00+01:00")

/** The export's Evolu workers (`Db`, `Shared`), classic scripts. */
const evoluWorkerBundle =
  /\/_expo\/static\/js\/web\/(Db|Shared)-[0-9a-f]+\.js$/u

/** A worker's `Date`, started at `time` when the worker starts, ticking on. */
const pinWorkerClock = (time: Date) => `(() => {
  const RealDate = Date
  const offset = ${time.getTime()} - RealDate.now()
  class PinnedDate extends RealDate {
    constructor(...args) {
      super(...(args.length === 0 ? [RealDate.now() + offset] : args))
    }
    static now() {
      return RealDate.now() + offset
    }
  }
  globalThis.Date = PinnedDate
})();`

/**
 * A realm's randomness, drawn from a PRNG seeded with `seed`: the ids the
 * app mints (a payment's, the account's key) come out the same on every run,
 * so a shot showing one changes only when the app does. Screenshot browsers
 * only — nothing here is secret.
 */
const seedRandomness = (seed: string) => `(() => {
  // Two streams: Math.random also serves jitter and timers, whose number of
  // calls follows real time, and must not shift the ids drawn from crypto.
  const stream = (name) => {
    let state = 2166136261
    for (const char of name) {
      state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0
    }
    return () => {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  let next = stream(${JSON.stringify(seed)})
  // A step that mints an id shown on screen starts a stream of its own, so
  // how much was drawn before it (sync, retries) cannot shift that id.
  globalThis.__screenshotReseed = (name) => {
    next = stream(${JSON.stringify(seed)} + "/" + name)
  }
  Math.random = stream(${JSON.stringify(`${seed}#math`)})
  const cryptoObject = globalThis.crypto
  cryptoObject.getRandomValues = (array) => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.floor(next() * 256)
    }
    return array
  }
  cryptoObject.randomUUID = () => {
    const bytes = cryptoObject.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    return [hex.slice(0, 4), hex.slice(4, 6), hex.slice(6, 8), hex.slice(8, 10), hex.slice(10)]
      .map((part) => part.join(""))
      .join("-")
  }
})();`

/**
 * A realm's WebSockets reach only this machine: the mock server's nostr
 * relay. Evolu's default relays are real ones, and with the same keys on
 * every run (`seedRandomness`) one run would sync the last run's account
 * back in; a socket to anywhere else is pointed at a closed local port, so
 * it fails at once and Evolu works offline.
 */
const keepSocketsLocal = `(() => {
  const RealWebSocket = globalThis.WebSocket
  if (RealWebSocket === undefined) return
  globalThis.WebSocket = class extends RealWebSocket {
    constructor(url, protocols) {
      const target = new URL(String(url), globalThis.location?.href)
      super(
        target.hostname === "127.0.0.1" || target.hostname === "localhost"
          ? url
          : "ws://127.0.0.1:9/",
        protocols
      )
    }
  }
})();`

const appDir = resolve(import.meta.dirname, "..")
const rawDirectory = join(appDir, ".tmp/docs-terminal")
const outputDirectory = join(appDir, "docs/terminal")

const selectedScenarios =
  env.PAYKY_SCREENSHOT_SCENARIOS === undefined
    ? terminalScenarios
    : terminalScenarios.filter((scenario) =>
        env.PAYKY_SCREENSHOT_SCENARIOS?.includes(scenario.name)
      )

if (selectedScenarios.length === 0) {
  throw new Error(
    `No terminal screenshot scenario matched: ${env.PAYKY_SCREENSHOT_SCENARIOS?.join(", ") ?? ""}.`
  )
}

// Every shot the landing names is taken by exactly one scenario.
const scenarioShots = terminalScenarios.flatMap((scenario) => scenario.shots)
const untaken = terminalShotNames.filter(
  (name) => !scenarioShots.includes(name)
)
const repeated = scenarioShots.filter(
  (name, index) => scenarioShots.indexOf(name) !== index
)
if (untaken.length > 0 || repeated.length > 0) {
  throw new Error(
    `Terminal shots not taken: ${untaken.join(", ") || "none"}; taken twice: ${repeated.join(", ") || "none"}.`
  )
}

async function run(): Promise<void> {
  await rm(rawDirectory, { recursive: true, force: true })
  await using web = await startFinitoWeb({
    appDir,
    webDir: join(appDir, ".tmp/docs-web-e2e"),
    webPort: env.PAYKY_SCREENSHOT_TERMINAL_WEB_PORT,
    mockPort: env.PAYKY_SCREENSHOT_TERMINAL_MOCK_PORT,
    skipBuild: env.PAYKY_SCREENSHOT_SKIP_BUILD,
    e2e: true,
  })

  try {
    for (const language of env.PAYKY_SCREENSHOT_LANGUAGES ?? languages) {
      await mkdir(join(rawDirectory, language), { recursive: true })
      await mkdir(join(outputDirectory, language), { recursive: true })

      for (const scenario of selectedScenarios) {
        console.info(
          `Generating ${language} terminal screenshots: ${scenario.name}`
        )
        // A context of its own: a fresh app, onboarded anew.
        const context = await web.newContext({
          language,
          viewport: {
            width: terminalCaptureWidth,
            height: terminalCaptureHeight,
          },
          deviceScaleFactor: terminalDeviceScaleFactor,
        })
        const page = await context.newPage()
        // Every run at the same moment, so a screen showing the time (and the
        // fake terminal's own clock) comes out the same; it ticks on from
        // there for the app's timers. Evolu's workers stamp the rows' times,
        // and Playwright's clock does not reach a worker: their bundles get
        // the same moment prepended.
        await page.clock.install({ time: capturedAt })
        // The same randomness on every run, per scenario and language, in
        // the page and in each worker (seeded by its bundle's name).
        const seed = `${scenario.name}/${language}`
        await context.addInitScript({
          content: `${seedRandomness(seed)}\n${keepSocketsLocal}`,
        })
        await context.route(evoluWorkerBundle, async (route) => {
          const response = await route.fetch()
          const worker = evoluWorkerBundle.exec(route.request().url())?.[1]
          await route.fulfill({
            response,
            body: `${pinWorkerClock(capturedAt)}\n${seedRandomness(`${seed}/${worker ?? ""}`)}\n${keepSocketsLocal}\n${await response.text()}`,
          })
        })
        await switchioOnEveryLoad(page, scenario.switchio ?? "approved")
        const taken = new Set<string>()
        const shoot: TerminalShoot = async (name, prepare) => {
          if (!scenario.shots.includes(name)) {
            throw new Error(`${scenario.name} does not list the shot ${name}.`)
          }
          await prepare?.(page)
          await resetDocumentScroll(page)
          // The pointer off the page: a tap leaves no hover on a terminal.
          // Then a screen pushed last slides in to its place.
          await page.mouse.move(-1, -1)
          await page.waitForTimeout(600)
          const rawPath = join(rawDirectory, language, `${name}.png`)
          await page.screenshot({ path: rawPath })
          await composeTerminalShot({
            rawPath,
            outputPath: join(outputDirectory, language, `${name}.webp`),
          })
          taken.add(name)
        }

        try {
          if (scenario.bare !== true) await prepareCardTerminal(page, language)
          await scenario.capture(page, language, shoot)
        } catch (error) {
          await page.screenshot({
            path: join(rawDirectory, language, `${scenario.name}-failed.png`),
          })
          throw error
        } finally {
          await context.close()
        }
        const missed = scenario.shots.filter((name) => !taken.has(name))
        if (missed.length > 0) {
          throw new Error(
            `${scenario.name} did not take ${missed.join(", ")} in ${language}.`
          )
        }
      }
    }
    await rm(rawDirectory, { recursive: true, force: true })
  } catch (error) {
    console.error(
      `The raw captures, a failed scenario's last screen included, stay in ${rawDirectory}.`
    )
    throw error
  }
}

await run()
