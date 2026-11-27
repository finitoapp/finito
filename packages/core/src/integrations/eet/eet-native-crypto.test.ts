import * as nodeCrypto from "node:crypto"
import { createReactNativeCrypto } from "@finitoapp/eet-client/react-native"
import { beforeAll, describe, expect, test } from "vitest"

import { createFakeEetResponder } from "../../testing/eet-fake-responder.ts"
import {
  createTestCertificate,
  createTestPkcs12,
  type TestCertificate,
} from "../../testing/eet-test-certificates.ts"
import { readEetCertificateFile } from "./eet-certificate.ts"
import { createEetApiDep, type EetReceipt } from "./eet-client.ts"

// The native app passes its Quick Crypto-shaped backend over Android's crypto
// provider; Node's crypto has the same shape, as in
// eet-client's own tests, so the native path runs here without Web Crypto
// signing or verifying anything.
const native = createReactNativeCrypto(nodeCrypto)

const receipt: EetReceipt = {
  eic: "CZ1234567890",
  establishmentId: "24",
  cashRegisterId: "fake-register",
  sequenceNumber: "fake-sale-1",
  saleAt: "2026-06-05T14:00:00+02:00",
  totalAmount: "250.00",
}

let cashRegister: TestCertificate

beforeAll(async () => {
  cashRegister = await createTestCertificate({
    subject: { commonName: "CZ1234567890" },
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
    validTo: new Date("2027-01-01T00:00:00.000Z"),
  })
})

const submitTo = async (
  responder: Awaited<ReturnType<typeof createFakeEetResponder>>
) => {
  const { eetApi } = createEetApiDep(
    { fetch: responder.fetch, date: { now: () => new Date() } },
    { productionUrl: undefined, timeoutMs: 200, native }
  )
  return await eetApi.submit({
    environment: "playground",
    certificate: cashRegister,
    receipt,
    firstSubmission: true,
    verification: false,
  })
}

describe("EET on the native crypto backend", () => {
  test("reads a .p12 and checks its key through it", async () => {
    const password = "generated-test-password"
    const file = await createTestPkcs12({ ...cashRegister, password })

    const result = await readEetCertificateFile({
      file,
      password,
      now: new Date("2026-06-05T12:00:00.000Z"),
      native,
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        eic: "CZ1234567890",
        certificateDer: cashRegister.certificateDer,
        privateKeyPkcs8: cashRegister.privateKeyPkcs8,
      },
    })
  })

  test("signs a sale and accepts the GFŘ's signed confirmation", async () => {
    const responder = await createFakeEetResponder()
    responder.answerNext({ type: "confirm" })

    const submission = await submitTo(responder)

    expect(submission.outcome).toMatchObject({ type: "accepted", isTest: true })
  })

  test("rejects a confirmation changed after signing", async () => {
    const responder = await createFakeEetResponder()
    responder.answerNext({ type: "tamperedConfirmation" })

    const submission = await submitTo(responder)

    expect(submission.outcome).toMatchObject({
      type: "rejected",
      errorType: "EetSignatureError",
    })
  })

  test("rejects a confirmation signed by someone other than GFŘ", async () => {
    const responder = await createFakeEetResponder()
    const stranger = await createTestCertificate({
      subject: { commonName: "EET", organization: "Somebody else" },
      validFrom: new Date("2020-01-01T00:00:00.000Z"),
      validTo: new Date("2040-01-01T00:00:00.000Z"),
    })
    responder.answerNext({ type: "confirmBy", signer: stranger })

    const submission = await submitTo(responder)

    expect(submission.outcome).toMatchObject({
      type: "rejected",
      errorType: "EetSignatureError",
    })
  })
})
