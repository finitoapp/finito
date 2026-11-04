import { describe, expect, test } from "vitest"

import {
  buildBip321PaymentUri,
  buildCashuPaymentUri,
  encodeNostrPaymentRequest,
  pickBip321PayableLeg,
} from "../../cashu/cashu-payment-request.ts"
import { createCashuShardStore } from "../../cashu/cashu-shard-store.ts"
import { deriveLinkyAppOwner } from "../../cashu/linky-owners.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { MasterKey } from "../shared/key-derivation.ts"
import {
  CashuAmount,
  CashuBolt11,
  type CashuQuoteId,
  CashuTokenText,
  KeysetId,
  MintUrl,
} from "./cashu-types.ts"
import {
  cashuOperationIdFor,
  cashuProofIdFor,
  linkySettingIdFor,
  normalizeCashuTokenText,
  normalizeMintUrl,
  operationKeyOf,
  shardPointerIdFor,
} from "./cashu-utils.ts"

/**
 * Cross-app Cashu vectors shared between Linky and Payky.
 *
 * The identical vector tables live in both repos:
 *   linky: apps/web-app/src/paykyCashuCrossApp.test.ts
 *   payky: src/core/modules/cashu/cashu-cross-app.test.ts
 *
 * Both apps write one wallet (cashu.md, decision 1): its rows are keyed by
 * these ids and mint URLs, so a mismatch forks the wallet or makes Linky skip
 * Payky's rows. If a change here is intentional, update BOTH copies.
 */

const MINT_URL_VECTORS: ReadonlyArray<
  readonly [input: string, normalized: string | null]
> = [
  ["https://cashu.cz", "https://cashu.cz"],
  [" https://cashu.cz/ ", "https://cashu.cz"],
  ["https://cashu.cz///", "https://cashu.cz"],
  ["https://mint.minibits.cash", "https://mint.minibits.cash/Bitcoin"],
  ["https://MINT.minibits.cash/Bitcoin/", "https://mint.minibits.cash/Bitcoin"],
  [
    "https://mint.minibits.cash/Bitcoin?x=1",
    "https://mint.minibits.cash/Bitcoin",
  ],
  ["https://mint.example.com/path/?a=1#x", "https://mint.example.com/path"],
  ["HTTPS://Cashu.CZ", "https://cashu.cz"],
  ["http://localhost:3338/", "http://localhost:3338"],
  ["https://kashu.me/sub/path//", "https://kashu.me/sub/path"],
  ["https://user:pw@mint.example.com/", "https://mint.example.com"],
  ["cashu.cz", null],
  ["", null],
  ["ftp://x.y", null],
]

const OPERATION_KEY_VECTORS: ReadonlyArray<{
  readonly operation: {
    readonly kind: "topup" | "receive" | "melt"
    readonly mint: string
    readonly quoteId: string | null
    readonly tokenText: string | null
  }
  readonly key: string
  readonly id: string
}> = [
  {
    operation: {
      kind: "topup",
      mint: "https://cashu.cz",
      quoteId: "q1",
      tokenText: null,
    },
    key: "topup|https://cashu.cz|q1",
    id: "BGlgDe11qmFny9YMFDFEMA",
  },
  {
    operation: {
      kind: "receive",
      mint: "https://cashu.cz",
      quoteId: null,
      tokenText: "cashuBabc",
    },
    key: "receive|cashuBabc",
    id: "Jp7BJO58G7fLgNCYxFZ5vw",
  },
  {
    operation: {
      kind: "melt",
      mint: "https://cashu.cz",
      quoteId: null,
      tokenText: null,
    },
    key: "melt|https://cashu.cz|",
    id: "SyizwpKPhVHxry_Apy878A",
  },
  {
    operation: {
      kind: "melt",
      mint: "https://cashu.cz",
      quoteId: "m1",
      tokenText: "cashuBenv",
    },
    key: "melt|https://cashu.cz|m1",
    id: "v8OkMn4X0n6QC4aCZBJqWQ",
  },
]

const PROOF_ID_VECTOR = {
  secret: "407915bc212be61a77e3e6d2aeb4c727980bda51cd06a6afc29e2861768a7837",
  id: "BZPKWM_sfeFRihXDyPbdLw",
}

/** `createIdFromString` of the meta rows, as Linky's `shardPointerId`/`settingIdFor`. */
const META_ROW_ID_VECTORS = {
  cashuShardPointer: "w3pAg-Ph4dKu9GiB84K7cw",
  defaultMintSetting: "d1KTr4HXiQVodmiXwSA3ig",
}

/** Linky's `buildBip321PaymentUri`, then `pickBip321PayableLeg` of its parse. */
const BIP321_VECTORS: ReadonlyArray<{
  readonly legs: { readonly lightning?: string; readonly creq?: string }
  readonly uri: string | null
  readonly leg: { readonly kind: string; readonly value: string } | null
}> = [
  {
    legs: { lightning: "lightning:LNBC10N1PXYZ" },
    uri: "bitcoin:?lightning=LNBC10N1PXYZ",
    leg: { kind: "lightning", value: "LNBC10N1PXYZ" },
  },
  {
    legs: { lightning: "lnbc10n1pxyz", creq: "creqAabc+/=" },
    uri: "bitcoin:?lightning=lnbc10n1pxyz&creq=creqAabc%2B%2F%3D",
    leg: { kind: "cashu-request", value: "creqAabc+/=" },
  },
  {
    legs: { creq: "creqAabc" },
    uri: "bitcoin:?creq=creqAabc",
    leg: { kind: "cashu-request", value: "creqAabc" },
  },
  { legs: {}, uri: null, leg: null },
  {
    legs: { lightning: " lnbc10n1pxyz ", creq: "" },
    uri: "bitcoin:?lightning=lnbc10n1pxyz",
    leg: { kind: "lightning", value: "lnbc10n1pxyz" },
  },
]

/** Linky's `encodeNostrPaymentRequest` of the same arguments. */
const NUT18_VECTORS = [
  {
    args: {
      amount: 8600,
      mintUrls: ["https://cashu.cz"],
      recipientNprofile: "nprofile1qqsxyz",
      requestId: "pay-1",
      description: "Coffee",
    },
    request:
      "creqAuQAHYWEZIZhhdWNzYXRhc_VhbYFwaHR0cHM6Ly9jYXNodS5jemF0gbkAA2F0ZW5vc3RyYWFvbnByb2ZpbGUxcXFzeHl6YWeBgmFuYjE3YWllcGF5LTFhZGZDb2ZmZWU",
  },
  {
    args: {
      amount: 21,
      mintUrls: ["https://cashu.cz", " "],
      recipientNprofile: "nprofile1abc",
      requestId: null,
      description: "  ",
    },
    request:
      "creqAuQAFYWEVYXVjc2F0YXP1YW2BcGh0dHBzOi8vY2FzaHUuY3phdIG5AANhdGVub3N0cmFhbG5wcm9maWxlMWFiY2FngYJhbmIxNw",
  },
]

/** Linky's `normalizeTokenText`: what a receive's operation id hashes. */
const TOKEN_TEXT_VECTORS: ReadonlyArray<
  readonly [input: string, tokenText: string | null]
> = [
  [
    '{"id":"pay-1","memo":"Káva","mint":"https://cashu.cz","unit":"sat","proofs":[{"id":"00ad268c4d1f5826","amount":8,"secret":"s1","C":"02aa","dleq":{"e":"x"}},{"amount":2,"id":"00ad268c4d1f5826","secret":"s2","C":"02bb"}]}',
    "cashuAeyJ0b2tlbiI6W3sibWludCI6Imh0dHBzOi8vY2FzaHUuY3oiLCJwcm9vZnMiOlt7ImlkIjoiMDBhZDI2OGM0ZDFmNTgyNiIsImFtb3VudCI6OCwic2VjcmV0IjoiczEiLCJDIjoiMDJhYSIsImRsZXEiOnsiZSI6IngifX0seyJhbW91bnQiOjIsImlkIjoiMDBhZDI2OGM0ZDFmNTgyNiIsInNlY3JldCI6InMyIiwiQyI6IjAyYmIifV19XSwidW5pdCI6InNhdCJ9",
  ],
  ["  cashuBo2FteBhodHRwczovL2NAA  ", "cashuBo2FteBhodHRwczovL2NAA"],
  ["cashuB with space", null],
  ["hello", null],
]

describe("cross-app Cashu vectors (shared with Linky)", () => {
  test.each(TOKEN_TEXT_VECTORS)("token text of %j", (input, tokenText) => {
    expect(normalizeCashuTokenText(input)).toBe(tokenText)
  })

  test.each(NUT18_VECTORS)("NUT-18 request $request", (vector) => {
    expect(encodeNostrPaymentRequest(vector.args)).toBe(vector.request)
  })

  test.each(BIP321_VECTORS)("BIP-321 $uri", (vector) => {
    expect(buildBip321PaymentUri(vector.legs)).toBe(vector.uri)
    if (vector.uri !== null)
      expect(pickBip321PayableLeg(vector.uri)).toEqual(vector.leg)
  })

  test("the payment QR narrows to one leg when the Cashu account says so (settings/0003)", () => {
    const request = {
      paymentId: "p1",
      lnInvoice: "lightning:lnbc10n1pxyz",
      amountSats: 10,
      mintUrl: "https://mint.example",
      nostrPubkey: "f".repeat(64),
      relays: ["wss://relay.example"],
    }
    const both = buildCashuPaymentUri(request)
    expect(both).toMatch(/^bitcoin:\?lightning=lnbc10n1pxyz&creq=creqA/u)
    expect(buildCashuPaymentUri({ ...request, legs: "lightning" })).toBe(
      "lnbc10n1pxyz"
    )
    const cashu = buildCashuPaymentUri({ ...request, legs: "cashu" })
    expect(cashu).toMatch(/^creqA/u)
    expect(both).toContain(`creq=${encodeURIComponent(cashu ?? "")}`)
    expect(
      buildCashuPaymentUri({ ...request, legs: "cashu", nostrPubkey: null })
    ).toBeNull()
  })

  test.each(MINT_URL_VECTORS)("mint url %j normalises to %j", (input, out) => {
    expect(normalizeMintUrl(input)).toBe(out)
  })

  test.each(OPERATION_KEY_VECTORS)("operation key $key", (vector) => {
    expect(operationKeyOf(vector.operation)).toBe(vector.key)
    expect(cashuOperationIdFor(vector.key)).toBe(vector.id)
  })

  test("a proof id hashes its secret", () => {
    expect(cashuProofIdFor(PROOF_ID_VECTOR.secret)).toBe(PROOF_ID_VECTOR.id)
  })

  test("meta rows have Linky's ids", () => {
    expect(shardPointerIdFor("cashu")).toBe(
      META_ROW_ID_VECTORS.cashuShardPointer
    )
    expect(linkySettingIdFor("defaultMint")).toBe(
      META_ROW_ID_VECTORS.defaultMintSetting
    )
  })
})

/**
 * The rows Payky's shard store writes, column for column (Evolu's system
 * columns aside). Linky's twin decodes each with its own codecs
 * (`toStoredProof`, `toStoredOperation`, the topup record, `LinkySettings`):
 * a row Linky cannot decode is silently skipped there.
 */
const WRITTEN_ROW_VECTORS = {
  proof: {
    id: "BZPKWM_sfeFRihXDyPbdLw",
    mint: "https://cashu.cz",
    unit: "sat",
    keysetId: "00ad268c4d1f5826",
    amount: 8,
    secret: "407915bc212be61a77e3e6d2aeb4c727980bda51cd06a6afc29e2861768a7837",
    c: "02a9acc1e48c25eeeb9289b5031cc57da9fe72f3fe2861d264bdc074209b107ba2",
    state: "available",
    dleq: null,
    operationId: null,
  },
  topup: {
    id: "BGlgDe11qmFny9YMFDFEMA",
    kind: "topup",
    status: "pending",
    mint: "https://cashu.cz",
    unit: "sat",
    keysetId: "00ad268c4d1f5826",
    amount: 100,
    quoteId: "q1",
    invoice: "lnbc1u1pjexample",
    locked: 1,
    expiresAtSec: 1_900_000_000,
    createdAtSec: 1_800_000_000,
    feeReserve: null,
    inputsTotal: null,
    sourceMint: null,
    counter: null,
    tokenText: null,
    error: null,
  },
  receive: {
    id: "Jp7BJO58G7fLgNCYxFZ5vw",
    kind: "receive",
    status: "pending",
    mint: "https://cashu.cz",
    unit: "sat",
    keysetId: "00ad268c4d1f5826",
    amount: 21,
    counter: 64,
    createdAtSec: 1_800_000_000,
    tokenText: "cashuBabc",
    feeReserve: null,
    inputsTotal: null,
    quoteId: null,
    invoice: null,
    sourceMint: null,
    locked: null,
    expiresAtSec: null,
    error: null,
  },
  defaultMintSetting: {
    id: "d1KTr4HXiQVodmiXwSA3ig",
    key: "defaultMint",
    value: "https://cashu.cz",
  },
} as const

describe("rows Payky writes (decoded by Linky's twin)", () => {
  test("the shard store writes exactly the pinned rows", async () => {
    await using evoluTest = await createEvoluTest()
    const { evolu } = evoluTest
    using store = createCashuShardStore({
      evolu,
      linkyAppOwner: deriveLinkyAppOwner(
        MasterKey("000102030405060708090a0b0c0d0e0f")
      ),
      ownerSync: { isOwnerSynced: () => true, subscribe: () => () => {} },
      relays: ["wss://evolu.linky.fit"],
      registerOwner: () => () => {},
    })
    const mint = MintUrl("https://cashu.cz")
    const keysetId = KeysetId("00ad268c4d1f5826")

    await store.insertProofs([
      {
        mint,
        unit: "sat",
        keysetId,
        amount: CashuAmount(8),
        secret: PROOF_ID_VECTOR.secret,
        C: WRITTEN_ROW_VECTORS.proof.c,
        dleq: null,
        state: "available",
        operationId: null,
      },
    ])
    await store.insertOperation({
      kind: "topup",
      status: "pending",
      mint,
      unit: "sat",
      keysetId,
      amount: CashuAmount(100),
      feeReserve: null,
      inputsTotal: null,
      quoteId: "q1" as CashuQuoteId,
      invoice: CashuBolt11("lnbc1u1pjexample"),
      sourceMint: null,
      counter: null,
      locked: true,
      expiresAtSec: 1_900_000_000,
      createdAtSec: 1_800_000_000,
      tokenText: null,
      error: null,
    })
    await store.insertOperation({
      kind: "receive",
      status: "pending",
      mint,
      unit: "sat",
      keysetId,
      amount: CashuAmount(21),
      feeReserve: null,
      inputsTotal: null,
      quoteId: null,
      invoice: null,
      sourceMint: null,
      counter: 64,
      locked: null,
      expiresAtSec: null,
      createdAtSec: 1_800_000_000,
      tokenText: CashuTokenText("cashuBabc"),
      error: null,
    })
    await store.writeSetting("defaultMint", "https://cashu.cz")

    const [proof] = await evolu.loadQuery(
      createQuery((db) =>
        db
          .selectFrom("cashuProof")
          .select([
            "id",
            "mint",
            "unit",
            "keysetId",
            "amount",
            "secret",
            "c",
            "state",
            "dleq",
            "operationId",
          ])
      )
    )
    expect(proof).toEqual(WRITTEN_ROW_VECTORS.proof)

    const operations = await evolu.loadQuery(
      createQuery((db) =>
        db
          .selectFrom("cashuOperation")
          .select([
            "id",
            "kind",
            "status",
            "mint",
            "unit",
            "keysetId",
            "amount",
            "feeReserve",
            "inputsTotal",
            "quoteId",
            "invoice",
            "sourceMint",
            "counter",
            "locked",
            "expiresAtSec",
            "createdAtSec",
            "tokenText",
            "error",
          ])
      )
    )
    expect(operations).toEqual(
      expect.arrayContaining([
        WRITTEN_ROW_VECTORS.topup,
        WRITTEN_ROW_VECTORS.receive,
      ])
    )

    const [setting] = await evolu.loadQuery(
      createQuery((db) =>
        db.selectFrom("setting").select(["id", "key", "value"])
      )
    )
    expect(setting).toEqual(WRITTEN_ROW_VECTORS.defaultMintSetting)
  })
})
