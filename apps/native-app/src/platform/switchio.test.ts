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
const refundStore = read(`${root}SwitchioRefundStore.kt`)
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
  const pay = module.slice(module.indexOf('AsyncFunction("pay")'))
  const begin = pay.indexOf("SwitchioResultStore.begin(")
  const launch = pay.indexOf("startActivityForResult(")
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
  expect(js).toContain(
    "close(closureId: string, accountId: string): Promise<unknown>"
  )
  expect(module).toContain(
    'AsyncFunction("close") { closureId: String, accountId: String'
  )
  // The closure id is kept with the result and handed back with it, so a
  // restored closure is recorded as the row it was launched as.
  expect(closureStore).toContain(".putString(CLOSURE_ID, closureId)")
  expect(closureStore).toContain("p.getString(CLOSURE_ID, null)")
  const peek = module.slice(
    module.indexOf('Function("peekStoredClosureResult")'),
    module.indexOf('Function("acknowledgeClosureResult")')
  )
  expect(peek).toContain('"closureId" to stored.closureId')
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

it("names the refund functions the same in JS and Kotlin", () => {
  for (const fn of ["peekStoredRefundResult", "acknowledgeRefundResult"]) {
    expect(js).toContain(`${fn}(`)
    expect(module).toContain(`Function("${fn}")`)
  }
  for (const fn of ["reversal", "referralRefund", "lookupTransaction"]) {
    expect(js).toContain(`${fn}(`)
    expect(module).toContain(`AsyncFunction("${fn}")`)
  }
})

it("refunds through the v8 referral refund intent, naming the payment by its refund id as a string", () => {
  expect(module).toContain(
    'URI_PATH_REFERRAL_REFUND = "api/main/v8/referral_refund"'
  )
  const refund = module.slice(
    module.indexOf('AsyncFunction("referralRefund")'),
    module.indexOf('AsyncFunction("lookupTransaction")')
  )
  expect(refund).toContain("refundId: String")
  expect(refund).toContain('data.put("refundId", refundId)')
})

it("takes a payment back through the v8 reversal intent, never without the original", () => {
  expect(module).toContain('URI_PATH_REVERSAL = "api/main/v8/reversal"')
  const reversal = module.slice(
    module.indexOf('AsyncFunction("reversal")'),
    module.indexOf('AsyncFunction("referralRefund")')
  )
  expect(reversal).toContain(
    'data.put("originalTransactionId", originalTransactionId)'
  )
  const guard = reversal.indexOf("originalTransactionId.isEmpty()")
  expect(guard).toBeGreaterThan(-1)
  expect(reversal.indexOf("launchRefund(")).toBeGreaterThan(guard)
})

it("stores the refund before the terminal is launched, under its own request code", () => {
  const launcher = module.slice(module.indexOf("private fun launchRefund("))
  const begin = launcher.indexOf("SwitchioRefundStore.begin(")
  const launch = launcher.indexOf(
    "startActivityForResult(intent, SwitchioRefundStore.REQUEST_CODE)"
  )
  expect(begin).toBeGreaterThan(-1)
  expect(launch).toBeGreaterThan(begin)
  expect(refundStore).toContain("REQUEST_CODE = 53703")
  expect(refundStore).toContain('PREFS = "payky_switchio_refund"')
  expect(plugin).toContain('storeBranch("SwitchioRefundStore")')
})

it("asks the terminal about a transaction through get_transaction, storing nothing", () => {
  expect(module).toContain(
    'URI_PATH_GET_TRANSACTION = "api/light/v8/get_transaction"'
  )
  const lookup = module.slice(
    module.indexOf('AsyncFunction("lookupTransaction")'),
    module.indexOf('Function("peekStoredRefundResult")')
  )
  expect(lookup).toContain("LOOKUP_REQUEST_CODE")
  expect(lookup).not.toContain("Store.")
})

it("never hands a refund result to the payment's or the closure's store, nor theirs to it", () => {
  for (const branch of requestCodeBranches(module, "SwitchioRefundStore")) {
    expect(branch).not.toContain("SwitchioResultStore")
    expect(branch).not.toContain("SwitchioClosureStore")
  }
  for (const store of ["SwitchioResultStore", "SwitchioClosureStore"]) {
    for (const branch of requestCodeBranches(module, store)) {
      expect(branch).not.toContain("SwitchioRefundStore")
    }
  }
  const takeRestored = js.slice(
    js.indexOf("export const takeRestoredSwitchioRefundResult")
  )
  expect(takeRestored).not.toContain("peekStoredResult()")
  expect(takeRestored).not.toContain("Closure")
})

it("never hands a closure result to the payment's store or recovery", () => {
  // Each request code writes only its own store, in the module and in
  // MainActivity, so `settleRestoredSwitchioCardPayment` (fed from
  // `peekStoredResult`) cannot be given a closure.
  const payment = requestCodeBranches(module, "SwitchioResultStore")
  const closure = requestCodeBranches(module, "SwitchioClosureStore")
  expect(payment.length).toBeGreaterThan(0)
  expect(closure.length).toBeGreaterThan(0)
  for (const branch of payment) expect(branch).not.toContain("Closure")
  for (const branch of closure)
    expect(branch).not.toContain("SwitchioResultStore")
  // MainActivity's branches come from one template, each naming only the
  // store it is made for.
  const template = plugin.slice(
    plugin.indexOf("const storeBranch"),
    plugin.indexOf("const LATER_BRANCHES")
  )
  expect(template).toMatch(/if \(requestCode == \$\{store\}\.REQUEST_CODE\)/u)
  expect(template).not.toMatch(/Switchio\w+Store/u)
  expect(plugin).toContain('storeBranch("SwitchioClosureStore")')
  expect(plugin).toContain(
    "if (requestCode == SwitchioResultStore.REQUEST_CODE)"
  )
  const takeRestored = js.slice(
    js.indexOf("export const takeRestoredSwitchioResult"),
    js.indexOf("export const createSwitchioClosureDep")
  )
  expect(takeRestored).not.toContain("Closure")
})

it("keeps the account each launch was made in with its stored result", () => {
  // The restore path takes a result only in that account (payment/0008).
  for (const source of [store, closureStore, refundStore]) {
    expect(source).toMatch(
      /fun begin\(context: Context, [^)]*accountId: String\)/u
    )
    expect(source).toContain(".putString(ACCOUNT_ID, accountId)")
    expect(source).toContain("p.getString(ACCOUNT_ID, null)")
  }
  for (const fn of [
    "peekStoredResult",
    "peekStoredClosureResult",
    "peekStoredRefundResult",
  ]) {
    const start = module.indexOf(`Function("${fn}")`)
    const peek = module.slice(start, module.indexOf("\n    }", start))
    expect(peek).toContain('"accountId" to stored.accountId')
  }
})
