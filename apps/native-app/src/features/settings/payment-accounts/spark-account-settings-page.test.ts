import { readFileSync } from "node:fs"
import { QueryClient } from "@tanstack/react-query"
import { expect, it } from "vitest"
import { requiredPermission } from "../../../core/route-access.ts"

const page = readFileSync(
  new URL("./spark-account-settings-page.tsx", import.meta.url),
  "utf8"
)
const dialog = readFileSync(
  new URL("../../../components/ui/dialog.tsx", import.meta.url),
  "utf8"
)

it("keeps Spark configuration owner-only and resets secrets for both identities", () => {
  expect(requiredPermission("/settings/payment-accounts/spark")).toBe("admin")
  expect(page).toMatch(/<SparkAccountSettings key=\{accountId\}/)
  expect(page).toMatch(/key=\{account\?\.id \?\? "no-spark-account"\}/)
  expect(page).toMatch(
    /\["spark-account-privacy-mode", activeAccountId, sparkAccountId\]/
  )
  expect(page).not.toMatch(
    /console\.|localStorage|AsyncStorage|SecureStore|MMKV/u
  )
})

it("validates imported mnemonics and warns before every wallet switch", () => {
  expect(page).toMatch(/SparkMnemonicSchema\.safeParse\(normalized\)/)
  expect(page).toMatch(
    /parsed\.success && sparkMnemonicToSecret\(parsed\.data\) === currentSecret/
  )
  expect(page).toMatch(/settings\.sparkAccount\.wallet\.warning\.invoices/)
  expect(page).toMatch(/settings\.sparkAccount\.wallet\.warning\.funds/)
  expect(page).toMatch(
    /<Dialog[\s\S]*onOpenChange=\{\(nextOpen\) => \{\s*if \(!nextOpen\) close\(\)/
  )
  expect(dialog).toMatch(
    /useCloseOnBackButton\(open, \(\) => onOpenChange\(false\)\)/
  )
  expect(page).toMatch(
    /const close = \(\) => \{\s*setTarget\("custom"\)\s*setMnemonic\(""\)/
  )
  expect(page).toMatch(
    /selectCustomSparkWallet\(\{ mnemonic: selectedMnemonic \}\)/
  )
  expect(page).toMatch(/selectDefaultSparkWallet\(\)/)
  expect(page).not.toMatch(/saveSparkAccount\(/)
})

it("uses disposable Spark wrapper leases and caches only privacy mode", () => {
  expect(
    page.match(
      /await using wallet = await createDefaultSparkPaymentWallet\(secret\)/g
    )
  ).toHaveLength(2)
  expect(page).toMatch(
    /return \(await wallet\.getWalletSettings\(\)\)\?\.privateEnabled \?\? false/
  )
  expect(page).toMatch(/return settings\.privateEnabled/)
  expect(page).toMatch(
    /await queryClient\.cancelQueries\(\{ queryKey, exact: true \}\)/
  )
  expect(page).toMatch(/queryClient\.setQueryData\(queryKey, privateEnabled\)/)
})

it("does not let a stale privacy read overwrite a saved value", async () => {
  expect(page.indexOf("await queryClient.cancelQueries")).toBeLessThan(
    page.indexOf("queryClient.setQueryData")
  )
  const queryClient = new QueryClient()
  const queryKey = ["spark-account-privacy-mode", "payky-account", "spark"]
  let resolveRead: (value: boolean) => void = () => {}
  let readDisposed = false
  queryClient.setQueryData(queryKey, false)

  const staleRead = queryClient.fetchQuery({
    queryKey,
    queryFn: () =>
      new Promise<boolean>((resolve) => {
        resolveRead = resolve
      }).finally(() => {
        readDisposed = true
      }),
    staleTime: 0,
  })
  const settledRead = staleRead.catch(() => undefined)
  await queryClient.cancelQueries({ queryKey, exact: true })
  queryClient.setQueryData(queryKey, true)
  resolveRead(false)
  await settledRead

  expect(queryClient.getQueryData(queryKey)).toBe(true)
  expect(readDisposed).toBe(true)
  queryClient.clear()
})
