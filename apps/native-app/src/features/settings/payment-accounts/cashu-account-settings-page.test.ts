import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { requiredPermission } from "../../../core/route-access.ts"

const page = readFileSync(
  new URL("./cashu-account-settings-page.tsx", import.meta.url),
  "utf8"
)
const snapshotHook = readFileSync(
  new URL("../../shared/cashu/use-cashu-wallet-snapshot.ts", import.meta.url),
  "utf8"
)
const snapshotSubscription = readFileSync(
  new URL(
    "../../shared/cashu/cashu-wallet-snapshot-subscription.ts",
    import.meta.url
  ),
  "utf8"
)

it("keeps the Cashu overview owner-only and read-only", () => {
  expect(requiredPermission("/settings/payment-accounts/cashu")).toBe("admin")
  expect(page).toContain('router.push("/cashu-withdraw/new")')
  expect(page).not.toMatch(/saveCashuAccount|writeCashu|Wallet\.|Mint\./u)
  expect(snapshotHook).toContain(
    'queryKey: ["cashuWalletSnapshot", store.linkyAppOwner.id]'
  )
  expect(snapshotHook).toContain("sumAvailableByMint(proofs)")
  expect(snapshotHook).not.toMatch(
    /cashuWalletDepAtom|deriveCashuWalletSeed|loadCashuWallet/u
  )
})

it("does not report an unread wallet as empty and refreshes live snapshots", () => {
  expect(page).toContain("if (isError)")
  expect(page).toContain("if (isPending || snapshot === null)")
  expect(page).toContain("snapshot.hydrated ? undefined :")
  expect(page).toContain("total > 0")
  expect(snapshotSubscription).toContain("store.subscribe(")
  expect(snapshotSubscription).toContain("store.subscribeHydration(")
  expect(snapshotSubscription).toContain("stopChanges()")
  expect(snapshotSubscription).toContain("stopHydration()")
})
