import { readdirSync, readFileSync } from "node:fs"
import { expectInOrder } from "@payky/core/testing/source-order"
import { expect, it } from "vitest"

const read = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8")

it("asks for the PIN, then re-checks the account, before the send Task", () => {
  const page = read("withdraw-page.tsx")
  const confirm = page.slice(
    page.indexOf("const confirmReviewedWithdrawal"),
    page.indexOf("const requote")
  )

  expectInOrder(
    confirm,
    /const accountVersion = reviewAccountVersionRef\.current/,
    /jotaiStore\.get\(evoluCounterAtom\) === accountVersion/,
    /if \(!isCurrentAccount\(\)\) \{\s*dispatch\(\{ type: "BACK" \}\)/,
    /const pinDetail = withdrawPinDetail\(/,
    // Moving money always asks for the PIN (access/0007), awaited.
    /await requirePin\(\s*"access\.action\.withdraw",\s*pinDetail\s*\)/,
    /await require\(\s*"admin",\s*"access\.action\.withdraw"\s*\)/,
    /if \(!allowed \|\| !mountedRef\.current \|\| !isCurrentAccount\(\)\)/,
    /if \(!isCurrentAccount\(\)\)/,
    /await run\(\s*executeWithdrawal\(/
  )
  // Access control being on is read when confirming, not when rendering.
  expect(page).toMatch(/accessEnabledRef\.current = access\.enabled/)
  expect(confirm).toMatch(/accessEnabledRef\.current\s*\?/)
})

it("binds the review to the account it was quoted on, and does not confirm while requoting", () => {
  const page = read("withdraw-page.tsx")
  // Captured when the quote is made, not when Confirm is pressed.
  expectInOrder(
    page,
    /reviewAccountVersionRef\.current = jotaiStore\.get\(evoluCounterAtom\)/,
    /dispatch\(\{ type: "OPEN_REVIEW"/
  )
  expectInOrder(
    page,
    /const confirmWithdrawal = async/,
    /requotingRef\.current\s*\)\s*return/,
    /const requote = async/,
    /requotingRef\.current = true/,
    /result\.ok && !confirmingRef\.current/,
    /requotingRef\.current = false/
  )
})

it("sends a quote once per press and never offers a retry after a send started", () => {
  const page = read("withdraw-page.tsx")
  const confirm = page.slice(
    page.indexOf("const confirmWithdrawal"),
    page.indexOf("/** `true` when nothing was sent")
  )

  expectInOrder(
    confirm,
    /confirmingRef\.current\s*\|\|\s*requotingRef\.current\s*\)\s*return/,
    /confirmingRef\.current = true/,
    /retryable = await confirmReviewedWithdrawal\(/,
    /if \(retryable\) confirmingRef\.current = false/
  )
  // An unexpected throw is an uncertain outcome, not a failure.
  expect(page).toMatch(/catch \{[^}]*return markUncertain\(\)/su)
  // A recorded withdrawal replaces the review, so back cannot confirm it again.
  expect(page).toMatch(
    /router\.replace\(\{\s*pathname: "\/withdraw\/\[withdrawalId\]"/
  )
})

it("ignores Back while a confirm is in flight, and keeps the exit speed fixed", () => {
  const page = read("withdraw-page.tsx")
  expectInOrder(
    page,
    /onBack=\{\(\) => \{/,
    /if \(confirmingRef\.current && !uncertain\) return/,
    /confirmingRef\.current = false/
  )
  expect(read("withdraw-review-step.tsx")).toMatch(
    /disabled=\{unavailable \|\| confirming\}/
  )
})

it("calls executeWithdrawal from the review's confirm handler only", () => {
  const offenders = readdirSync(new URL("../..", import.meta.url), {
    recursive: true,
  })
    .map(String)
    .filter((file) => /\.tsx?$/u.test(file) && !/\.test\.tsx?$/u.test(file))
    .filter((file) =>
      /\bexecuteWithdrawal\(/u.test(
        readFileSync(new URL(`../../${file}`, import.meta.url), "utf8")
      )
    )
  expect(offenders).toEqual(["features/withdraw/withdraw-page.tsx"])
})

it("asks for admin, then confirmation, before settling an on-chain withdrawal", () => {
  const detail = read("withdraw-detail-page.tsx")
  const resolve = detail.slice(detail.indexOf("const resolve ="))

  expectInOrder(
    resolve,
    /await require\("admin", "access\.action\.withdraw"\)/,
    /await confirm\(/,
    /confirmOnchainWithdrawalSent\(/,
    /markWithdrawalFailed\(/
  )
})
