import { readFileSync } from "node:fs"
import { expect, it } from "vitest"

const read = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8")
const js = read("./switchio.ts")
const root =
  "../../modules/payky-switchio/android/src/main/java/me/payky/switchio/"
const module = read(`${root}PaykySwitchioModule.kt`)
const store = read(`${root}SwitchioResultStore.kt`)
const closureStore = read(`${root}SwitchioClosureStore.kt`)
const plugin = read("../../plugins/with-switchio-result-capture.cjs")

it("names the module and its functions the same in JS and Kotlin", () => {
  expect(js).toContain('"PaykySwitchio"')
  expect(module).toContain('Name("PaykySwitchio")')
  for (const fn of ["isInstalled", "peekStoredResult", "acknowledgeResult"])
    expect(module).toContain(`Function("${fn}")`)
  expect(module).toContain('AsyncFunction("pay")')
})

it("uses the same not-installed rejection code on both sides", () => {
  const code = /SWITCHIO_NOT_INSTALLED_CODE = "([^"]+)"/u.exec(js)?.[1]
  expect(code).toBeDefined()
  expect(module).toContain(`NOT_INSTALLED_CODE = "${code}"`)
})

it("stores the attempt before the terminal is launched", () => {
  const begin = module.indexOf("SwitchioResultStore.begin(")
  const launch = module.indexOf("startActivityForResult(")
  expect(begin).toBeGreaterThan(-1)
  expect(launch).toBeGreaterThan(begin)
})

it("captures the result in MainActivity with the module's request code and passes it on", () => {
  expect(store).toContain("REQUEST_CODE = 53701")
  expect(plugin).toContain("SwitchioResultStore.REQUEST_CODE")
  expect(plugin).toContain(
    "super.onActivityResult(requestCode, resultCode, data)"
  )
})

it("only JS clears a stored result", () => {
  expect(module).not.toMatch(/OnActivityResult[\s\S]*acknowledge/u)
})

it("names the closure functions the same in JS and Kotlin", () => {
  for (const fn of ["peekStoredClosureResult", "acknowledgeClosureResult"]) {
    expect(js).toContain(`${fn}()`)
    expect(module).toContain(`Function("${fn}")`)
  }
  expect(js).toContain("close(): Promise<unknown>")
  expect(module).toContain('AsyncFunction("close")')
})

it("closes the batch through the v8 closure intent, with no data", () => {
  expect(module).toContain('URI_PATH_CLOSURE = "api/main/v8/closure"')
  const start = module.indexOf("private fun closureIntent()")
  expect(start).toBeGreaterThan(-1)
  const closureIntent = module.slice(start, module.indexOf("\n}", start))
  expect(closureIntent).toContain(".path(URI_PATH_CLOSURE)")
  expect(closureIntent).not.toContain("appendQueryParameter")
})

it("stores the closure before the terminal is launched, under its own request code", () => {
  const close = module.slice(module.indexOf('AsyncFunction("close")'))
  const begin = close.indexOf("SwitchioClosureStore.begin(")
  const launch = close.indexOf(
    "startActivityForResult(intent, SwitchioClosureStore.REQUEST_CODE)"
  )
  expect(begin).toBeGreaterThan(-1)
  expect(launch).toBeGreaterThan(begin)
  expect(closureStore).toContain("REQUEST_CODE = 53702")
  expect(closureStore).toContain('PREFS = "payky_switchio_closure"')
})

/** The body of each `if (... == <Store>.REQUEST_CODE)` branch in `source`. */
const requestCodeBranches = (source: string, store: string) =>
  source
    .split(/(?=if \()/u)
    .filter((part) => part.includes(`== ${store}.REQUEST_CODE)`))
    .map((part) => part.slice(0, part.indexOf("\n    }")))

it("never hands a closure result to the payment's store or recovery", () => {
  // Each request code writes only its own store, in the module and in
  // MainActivity, so `settleRestoredSwitchioCardPayment` (fed from
  // `peekStoredResult`) cannot be given a closure.
  for (const source of [module, plugin]) {
    const payment = requestCodeBranches(source, "SwitchioResultStore")
    const closure = requestCodeBranches(source, "SwitchioClosureStore")
    expect(payment.length).toBeGreaterThan(0)
    expect(closure.length).toBeGreaterThan(0)
    for (const branch of payment) expect(branch).not.toContain("Closure")
    for (const branch of closure)
      expect(branch).not.toContain("SwitchioResultStore")
  }
  const takeRestored = js.slice(
    js.indexOf("export const takeRestoredSwitchioResult"),
    js.indexOf("export const createSwitchioClosureDep")
  )
  expect(takeRestored).not.toContain("Closure")
})
