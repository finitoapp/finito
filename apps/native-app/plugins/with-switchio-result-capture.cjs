const { withMainActivity } = require("expo/config-plugins")

const PAYMENT_MARKER = "SwitchioResultStore.save"

const IMPORTS = [
  "import android.content.Intent",
  "import me.payky.switchio.SwitchioClosureStore",
  "import me.payky.switchio.SwitchioRefundStore",
  "import me.payky.switchio.SwitchioResultStore",
]

/** The branch that writes one store's result, and whether `contents` has it. */
const storeBranch = (store) => ({
  marker: `${store}.save`,
  code: `    if (requestCode == ${store}.REQUEST_CODE) {
      ${store}.save(
        this,
        resultCode,
        data?.getStringExtra(${store}.RESULT_KEY)
      )
    }
`,
})

/** Added after the payment's, in the order they came: closures, then refunds. */
const LATER_BRANCHES = [
  storeBranch("SwitchioClosureStore"),
  storeBranch("SwitchioRefundStore"),
]

/**
 * Writes every SwitchioPay activity result to durable storage before React,
 * Expo or the module are involved. If Android killed this app while the
 * terminal was in the foreground, the result is delivered to the recreated
 * activity before any JS runs; storing it here is what lets JS settle the
 * payment, record the batch closure or settle the refund afterwards
 * (`payky-switchio` `peekStoredResult`, `peekStoredClosureResult`,
 * `peekStoredRefundResult`). Each request code has its own store, so a
 * closure or a refund never reaches the payment's recovery. The result is
 * passed on unchanged, so the module's own promise path still works.
 */
const METHOD = `
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode == SwitchioResultStore.REQUEST_CODE) {
      SwitchioResultStore.save(
        this,
        resultCode,
        data?.getStringExtra(SwitchioResultStore.RESULT_KEY)
      )
    }
${LATER_BRANCHES.map(({ code }) => code).join("")}    super.onActivityResult(requestCode, resultCode, data)
  }
`

const SUPER_CALL = "    super.onActivityResult(requestCode, resultCode, data)"

const addImports = (contents) => {
  const imports = IMPORTS.filter((line) => !contents.includes(line))
  if (imports.length === 0) return contents
  return contents.replace(/^(package .*\n)/mu, `$1\n${imports.join("\n")}\n`)
}

/** @type {import("expo/config-plugins").ConfigPlugin} */
const withSwitchioResultCapture = (config) =>
  withMainActivity(config, (activityConfig) => {
    const { language, contents } = activityConfig.modResults
    if (language !== "kt") throw new Error("MainActivity is not Kotlin")
    const missing = LATER_BRANCHES.filter(
      ({ marker }) => !contents.includes(marker)
    )
    if (contents.includes(PAYMENT_MARKER) && missing.length === 0) {
      return activityConfig
    }

    const withImports = addImports(contents)

    // A MainActivity patched before closures or refunds existed: add the
    // missing branches to the method it already has rather than overriding
    // it twice.
    if (withImports.includes(PAYMENT_MARKER)) {
      if (!withImports.includes(SUPER_CALL)) {
        throw new Error("MainActivity's onActivityResult has an unknown shape")
      }
      activityConfig.modResults.contents = withImports.replace(
        SUPER_CALL,
        missing.map(({ code }) => code).join("") + SUPER_CALL
      )
      return activityConfig
    }

    const end = withImports.lastIndexOf("}")
    if (end === -1) throw new Error("MainActivity has no class body")
    activityConfig.modResults.contents =
      withImports.slice(0, end) + METHOD + withImports.slice(end)
    return activityConfig
  })

module.exports = withSwitchioResultCapture
