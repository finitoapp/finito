import { readdirSync, readFileSync } from "node:fs"
import { expectInOrder } from "@payky/core/testing/source-order"
import { expect, it } from "vitest"

const read = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8")

const page = read("cashu-withdraw-page.tsx")

it("asks for the PIN, then re-checks the account, before a Cashu transfer Task", () => {
  const confirm = page.slice(
    page.indexOf("const confirmReviewed"),
    page.indexOf("const requote")
  )

  expectInOrder(
    confirm,
    /jotaiStore\.get\(evoluCounterAtom\) === accountVersion/,
    /if \(!isCurrentAccount\(\)\) \{\s*setReview\(null\)/,
    /const pinDetail =\s*reviewed\.kind === "melt"\s*\?\s*cashuWithdrawPinDetail\(\{\s*quote: reviewed\.quote,\s*t,\s*locale\s*\}\)\s*:\s*cashuSendPinDetail\(\{\s*quote: reviewed\.quote,\s*t,\s*locale\s*\}\)/,
    // Moving money always asks for the PIN (access/0007), awaited.
    /await requirePin\(\s*"access\.action\.withdraw",\s*pinDetail\s*\)/,
    /await require\(\s*"admin",\s*"access\.action\.withdraw"\s*\)/,
    /if \(!allowed \|\| !mountedRef\.current \|\| !isCurrentAccount\(\)\)/,
    /await jotaiStore\.get\(accountAtom\)/,
    /await using run = prepared/,
    /if \(!isCurrentAccount\(\)\)/,
    /await run\(\s*executeCashuWithdrawal\(\s*\{[^}]*quote,/u
  )
  // The PIN names the quote the Cashu transfer then uses: the one captured at the press.
  expect(confirm).toMatch(
    /const confirmReviewed = async \(reviewed: CashuReview\)/
  )
  expect(confirm).toMatch(/const \{ accountVersion \} = reviewed/)
  expect(confirm.match(/\bquote\b/gu)?.length).toBeGreaterThan(2)
  // Access control being on is read when confirming, not when rendering.
  expect(page).toMatch(/accessEnabledRef\.current = access\.enabled/)
  expect(confirm).toMatch(/accessEnabledRef\.current\s*\?/)
})

it("binds the review to the account it was quoted on, and does not confirm while requoting", () => {
  // Captured when the quote is made, not when Confirm is pressed.
  expect(page).toMatch(/readonly accountVersion: number/)
  expect(page).toMatch(
    /setReview\(\{[^}]*quote,\s*accountVersion: jotaiStore\.get\(evoluCounterAtom\),?\s*\}\)/u
  )
  expect(page).not.toMatch(/const accountVersion = jotaiStore\.get/)
  expectInOrder(
    page,
    /const confirm = async/,
    /requotingRef\.current\) return/,
    /const requote = async/,
    /requotingRef\.current = true/,
    /result\.ok && !confirmingRef\.current/,
    /requotingRef\.current = false/
  )
})

it("melts a quote once per press and never offers a retry after the melt may have been sent", () => {
  const confirm = page.slice(
    page.indexOf("const confirm = async"),
    page.indexOf("/** `true` when nothing was sent")
  )
  expectInOrder(
    confirm,
    /confirmingRef\.current\s*\|\|\s*requotingRef\.current\s*\)\s*return/,
    /confirmingRef\.current = true/,
    /retryable = await confirmReviewed\(/,
    /if \(retryable\) confirmingRef\.current = false/
  )
  // Anything thrown from the melt Task on is an uncertain outcome.
  expectInOrder(
    page,
    /\} catch \{\s*\/\/ Thrown after the melt/,
    /setUncertain\(true\)/,
    /return false/
  )
  // A recorded withdrawal replaces the review, so back cannot confirm it again.
  expect(page).toMatch(
    /router\.replace\(\{\s*pathname: withdrawRoutes\.cashu\.detail/
  )
  // The resume of a lost melt is the Cashu job's (withdraw/0013): none here.
  expect(page).not.toMatch(/resumeCashuMelt|settleCashuWithdrawal/)
})

it("ignores Back while a confirm is in flight, and the review offers no confirm when uncertain", () => {
  expectInOrder(
    page,
    /onBack=\{\(\) => \{/,
    /if \(confirmingRef\.current && !uncertain\) return/,
    /confirmingRef\.current = false/
  )
  expect(read("cashu-withdraw-review-step.tsx")).toMatch(
    /uncertain=\{uncertain\}[\s\S]*onOpenHistory=\{onOpenHistory\}/
  )
  const footer = read("withdraw-review-step.tsx")
  expectInOrder(
    footer,
    /\{uncertain \? \(/,
    /onPress=\{onOpenHistory\}/,
    /onPress=\{onConfirm\}/
  )
})

it("calls executeCashuWithdrawal from the Cashu review's confirm handler only", () => {
  const offenders = readdirSync(new URL("../..", import.meta.url), {
    recursive: true,
  })
    .map(String)
    .filter((file) => /\.tsx?$/u.test(file) && !/\.test\.tsx?$/u.test(file))
    .filter((file) =>
      /\bexecuteCashuWithdrawal\(/u.test(
        readFileSync(new URL(`../../${file}`, import.meta.url), "utf8")
      )
    )
  expect(offenders).toEqual(["features/withdraw/cashu-withdraw-page.tsx"])
})
