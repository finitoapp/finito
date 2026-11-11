import { readFileSync } from "node:fs"
import { expectInOrder } from "@payky/core/testing/source-order"
import { expect, it } from "vitest"

const read = (name: string) =>
  readFileSync(new URL(`./${name}.tsx`, import.meta.url), "utf8")

const currentAccountReturn = /if\s*\(!isCurrentAccount\(\)\)\s*return/
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
const permissionReturn = (permission: string, action: string) =>
  new RegExp(
    `if\\s*\\(\\s*!\\s*\\(\\s*await\\s+require\\(\\s*"${permission}",\\s*"${escapeRegExp(action)}"\\s*\\)\\s*\\)\\s*\\)\\s*return`
  )

it("requires current-account admin before diagnostic account mutations", () => {
  const accounts = read("accounts-card")
  const switchAccount = accounts.slice(
    accounts.indexOf("onPress={async () => {"),
    accounts.indexOf("</Button>")
  )
  const addAccount = accounts.slice(accounts.lastIndexOf("<Button"))

  expect(accounts).toMatch(
    /const isCurrentAccount = \(\) => store\.get\(evoluCounterAtom\) === accountVersion/
  )
  expectInOrder(
    switchAccount,
    currentAccountReturn,
    permissionReturn("admin", "access.action.switchAccount"),
    currentAccountReturn,
    /selectAccount\(/
  )
  expectInOrder(
    addAccount,
    currentAccountReturn,
    permissionReturn("admin", "settings.accounts.create.confirm.confirm"),
    currentAccountReturn,
    /insertAccount\(deviceEvolu, createAccountMasterKey\(\),/
  )
})

it("requires admin and sell before creating a diagnostic cash payment", () => {
  const cashSale = read("cash-sale-card")
  const create = cashSale.slice(
    cashSale.indexOf("const create ="),
    cashSale.indexOf("const pay =")
  )

  expect(cashSale).toMatch(
    /const isCurrentAccount = \(\) => store\.get\(evoluCounterAtom\) === accountVersion/
  )
  expectInOrder(
    create,
    currentAccountReturn,
    permissionReturn("admin", "settings.cashRegisterAccount.enabled.label"),
    currentAccountReturn,
    permissionReturn("sell", "paymentTip.continue"),
    currentAccountReturn,
    /saveCashRegisterAccount\(/,
    currentAccountReturn,
    /createPayment\(/
  )
})

it("requires confirm for both diagnostic cash settlements", () => {
  const cashSale = read("cash-sale-card")
  const pay = cashSale.slice(
    cashSale.indexOf("const pay ="),
    cashSale.indexOf("const minimum =")
  )

  expectInOrder(
    pay,
    currentAccountReturn,
    permissionReturn("confirm", "access.action.markCashPaid"),
    currentAccountReturn,
    /markPaymentPaidCash\(/
  )
  expect(cashSale).toContain("onPress={() => pay(12000)}")
  expect(cashSale).toContain("onPress={() => pay(12300)}")
})

it("requires current-account admin before adding a received account", () => {
  // Shared by the QR transfer and the request to Payky (account/0008).
  const addTransferred = readFileSync(
    new URL("../shared/use-add-transferred-account.ts", import.meta.url),
    "utf8"
  )
  const addAccount = addTransferred.slice(
    addTransferred.indexOf("return async (payload")
  )

  expectInOrder(
    addAccount,
    /if\s*\(stale\(\)\)\s*return/,
    /await\s+require\(\s*"admin",\s*"accountTransfer\.target\.confirm\.confirm"\s*\)/,
    /stale\(\)/,
    /createOrSelectAccount\(/
  )
})
