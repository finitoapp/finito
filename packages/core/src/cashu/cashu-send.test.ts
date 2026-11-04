import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { sumAvailableByMint } from "../modules/cashu/cashu-queries.ts"
import { CashuAmount } from "../modules/cashu/cashu-types.ts"
import {
  createCashuTest,
  testCashuMasterKey,
  testMintUrl,
} from "../testing/cashu.ts"
import { costOfCashuSend, returnCashuSend, sendCashu } from "./cashu-send.ts"
import { claimCashuTopup, createCashuTopupQuote } from "./cashu-topup.ts"

const setup = async (balance = 1000) => {
  const t = await createCashuTest()
  const deps = {
    ...t.deps,
    masterKey: testCashuMasterKey,
    date: { now: () => new Date() },
  }
  await using run = testCreateRun(deps)
  const quote = await run.orThrow(
    createCashuTopupQuote({ mint: testMintUrl, amount: CashuAmount(balance) })
  )
  t.mint.payMintQuote(quote.quoteId)
  await run.orThrow(claimCashuTopup(quote.operationId))
  return { t, deps }
}
type Setup = Awaited<ReturnType<typeof setup>>

const balance = async (deps: Setup["deps"]) =>
  sumAvailableByMint(await deps.cashuShardStore.loadProofs()).get(
    testMintUrl
  ) ?? 0

const proofsOfState = async (deps: Setup["deps"], state: string) =>
  (await deps.cashuShardStore.loadProofs()).filter(
    (proof) => proof.state === state
  )

describe("sendCashu (withdraw/0015)", () => {
  test("hands the amount out as a pending send and keeps the change", async () => {
    const { t, deps } = await setup()
    await using _ = t
    await using run = testCreateRun(deps)
    const cost = await run.orThrow(
      costOfCashuSend({ mint: testMintUrl, amount: 300 })
    )
    expect(cost).toEqual({ amount: 300, maxFee: 0 })

    const receipt = await run.orThrow(
      sendCashu({ mint: testMintUrl, amount: 300 })
    )
    expect(receipt.amount).toBe(300)
    expect(receipt.feePaid).toBeLessThanOrEqual(cost.maxFee)
    expect(await balance(deps)).toBe(1000 - 300 - receipt.feePaid)

    const send = (await deps.cashuShardStore.loadOperations()).find(
      (operation) => operation.kind === "send"
    )
    expect(send).toMatchObject({
      id: receipt.operationId,
      status: "pending",
      amount: 300,
      tokenText: receipt.tokenText,
      quoteId: null,
      counter: null,
    })
    const handedOut = await proofsOfState(deps, "handedOut")
    expect(handedOut.reduce((sum, proof) => sum + proof.amount, 0)).toBe(300)
    expect(
      handedOut.every((proof) => proof.operationId === receipt.operationId)
    ).toBe(true)
    expect(await proofsOfState(deps, "held")).toEqual([])
  })

  test("the token names the mint and carries exactly the handed-out proofs", async () => {
    const { t, deps } = await setup()
    await using _ = t
    await using run = testCreateRun(deps)
    const receipt = await run.orThrow(
      sendCashu({ mint: testMintUrl, amount: 257 })
    )
    const wallet = await deps.cashuWallet.load(testMintUrl)
    const token = wallet.decodeToken(receipt.tokenText)
    expect(token.mint).toBe(testMintUrl)
    expect(token.unit).toBe("sat")
    expect(token.memo).toBeUndefined()
    const handedOut = await proofsOfState(deps, "handedOut")
    expect(token.proofs.map((proof) => proof.secret).toSorted()).toEqual(
      handedOut.map((proof) => proof.secret).toSorted()
    )
    expect(
      token.proofs.reduce((sum, proof) => sum + Number(proof.amount), 0)
    ).toBe(257)
  })

  test("refuses more than the balance can cover with its fee", async () => {
    const { t, deps } = await setup(100)
    await using _ = t
    await using run = testCreateRun(deps)
    const result = await run(sendCashu({ mint: testMintUrl, amount: 101 }))
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toMatchObject({
        type: "CashuInsufficientFunds",
        available: 100,
      })
    expect(await balance(deps)).toBe(100)
    expect(
      (await deps.cashuShardStore.loadOperations()).some(
        (operation) => operation.kind === "send"
      )
    ).toBe(false)
  })

  test("returnCashuSend gives the proofs back and closes the send returned", async () => {
    const { t, deps } = await setup()
    await using _ = t
    await using run = testCreateRun(deps)
    const receipt = await run.orThrow(
      sendCashu({ mint: testMintUrl, amount: 300 })
    )
    const after = await balance(deps)
    await run.orThrow(returnCashuSend(receipt.operationId))
    expect(await balance(deps)).toBe(after + 300)
    expect(await proofsOfState(deps, "handedOut")).toEqual([])
    expect(
      await deps.cashuShardStore.loadOperation(receipt.operationId)
    ).toMatchObject({ status: "returned" })
    // Once closed it cannot be returned again.
    await expect(run(returnCashuSend(receipt.operationId))).resolves.toEqual({
      ok: false,
      error: { type: "CashuSendNotPending", operationId: receipt.operationId },
    })
  })
})
