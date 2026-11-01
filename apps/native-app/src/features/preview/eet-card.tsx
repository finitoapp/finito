import { brandName } from "@payky/app-shared/brand"
import { fetchAndValidateJson } from "@payky/core/deps"
import { readEetCertificateFile } from "@payky/core/integrations/eet/eet-certificate"
import { createEetApiDep } from "@payky/core/integrations/eet/eet-client"
import { createEetResponseVerifier } from "@payky/core/integrations/eet/eet-response-verifier"
import { EetBase64Schema } from "@payky/core/modules/eet/eet-types"
import {
  eetBase64ToBytes,
  formatEetDateTime,
} from "@payky/core/modules/eet/eet-utils"
// Testing entry, imported only by this diagnostic card.
import {
  createTestCertificate,
  createTestPkcs12,
} from "@payky/core/testing/eet-test-certificates"
import { useState } from "react"
import { Text, View } from "tamagui"
import { z } from "zod"
import { Button } from "../../components/ui/button.tsx"
import { appBrand } from "../../core/app-brand.ts"
import { apiUrl } from "../../core/native-env.ts"
import { nativeRun } from "../../core/native-runtime.ts"
import { eetNativeCrypto } from "../../platform/eet-crypto"
import { createFetchDep } from "../../platform/native-deps.ts"

const bytes = (text: string) => new TextEncoder().encode(text)
const PASSWORD = "payky-test"
const ORG = "Generální finanční ředitelství"

const crypto_ = async (lines: string[]) => {
  const time = async <T,>(name: string, work: () => Promise<T>): Promise<T> => {
    const start = Date.now()
    try {
      return await work()
    } finally {
      lines.push(`  (${name}: ${Date.now() - start} ms)`)
    }
  }
  const now = new Date()
  const cert = await time("generate RSA cert", () =>
    createTestCertificate({
      subject: {
        commonName: "CZ00000019",
        description: `${brandName(appBrand)} test`,
      },
      validFrom: new Date(now.getTime() - 86_400_000),
      validTo: new Date(now.getTime() + 86_400_000 * 30),
    })
  )
  const p12 = await time("build PKCS#12", () =>
    createTestPkcs12({
      certificateDer: cert.certificateDer,
      privateKeyPkcs8: cert.privateKeyPkcs8,
      password: PASSWORD,
    })
  )
  const read = (file: Uint8Array, password: string, at: Date) =>
    readEetCertificateFile({ file, password, now: at, native: eetNativeCrypto })
  const good = await time("read p12", () => read(p12, PASSWORD, now))
  lines.push(
    good.ok
      ? `read ok: ${good.value.eic}, validTo ${new Date(good.value.validTo).toISOString()}`
      : `read FAIL ${good.error.type}`
  )
  const wrong = await read(p12, "nope", now)
  lines.push(`wrong password: ${wrong.ok ? "ok?!" : wrong.error.type}`)
  const junk = await read(crypto.getRandomValues(new Uint8Array(64)), "x", now)
  lines.push(`garbage: ${junk.ok ? "ok?!" : junk.error.type}`)
  const late = await read(
    p12,
    PASSWORD,
    new Date(now.getTime() + 86_400_000 * 90)
  )
  lines.push(`expired: ${late.ok ? "ok?!" : late.error.type}`)

  const key = eetNativeCrypto.importPrivateKey(cert.privateKeyPkcs8)
  lines.push(`importPrivateKey: ${key.ok ? "ok" : key.error.type}`)

  // Verifier path, as eet-response-verifier.test.ts: a GFR-issued signer.
  const signer = await createTestCertificate({
    subject: { commonName: "EET response signer", organization: ORG },
    validFrom: new Date(now.getTime() - 86_400_000),
    validTo: new Date(now.getTime() + 86_400_000 * 30),
  })
  const signedInfoCanonical = bytes("<ds:SignedInfo/>")
  const sign = async (data: Uint8Array) =>
    new Uint8Array(
      await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        signer.privateKey,
        data as BufferSource
      )
    )
  const verifier = createEetResponseVerifier(
    { date: { now: () => now } },
    eetNativeCrypto
  )
  const input = (signatureValue: Uint8Array) => ({
    raw: "",
    signature: {
      signedBodyCanonical: new Uint8Array(),
      signedInfoCanonical,
      signatureValue,
      digestValue: new Uint8Array(),
      certificates: [signer.certificateDer],
      canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
      digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
      signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    },
  })
  const signature = await time("sign", () => sign(signedInfoCanonical))
  lines.push(
    `verify valid: ${await time("verify", async () => verifier.verify(input(signature)))} (want true)`
  )
  const tampered = signature.slice()
  tampered[0] = (tampered[0] ?? 0) ^ 0xff
  lines.push(
    `verify tampered: ${await verifier.verify(input(tampered))} (want false)`
  )
  lines.push(
    `verify other bytes: ${await verifier.verify(input(await sign(bytes("other"))))} (want false)`
  )
}

const PlaygroundSchema = z.object({
  password: z.string().min(1),
  certificates: z
    .array(z.object({ fileName: z.string(), p12Base64: EetBase64Schema }))
    .min(1),
})

const playground = async (lines: string[]) => {
  const t0 = Date.now()
  await using run = nativeRun.create({
    ...createFetchDep(),
    date: { now: () => new Date() },
  })
  const archive = await run(
    fetchAndValidateJson({
      url: apiUrl("/api/eet/playground-certificates"),
      schema: PlaygroundSchema,
      onHttpError: ({ status }) => ({ type: "HttpError" as const, status }),
      onResponseError: () => ({ type: "ResponseError" as const }),
    })
  )
  if (!archive.ok) {
    lines.push(
      `certificates fetch error: ${JSON.stringify(archive.error).slice(0, 200)}`
    )
    return
  }
  lines.push(`certificates fetched: ${Date.now() - t0} ms`)
  const now = new Date()
  const first = archive.value.certificates[0]
  if (first === undefined) return
  const t1 = Date.now()
  const certificate = await readEetCertificateFile({
    file: eetBase64ToBytes(first.p12Base64),
    password: archive.value.password,
    now,
    native: eetNativeCrypto,
  })
  lines.push(
    `read ${first.fileName}: ${certificate.ok ? `ok ${certificate.value.eic}` : certificate.error.type} (${Date.now() - t1} ms)`
  )
  if (!certificate.ok) return
  const { eetApi } = createEetApiDep(
    { ...createFetchDep(), date: { now: () => now } },
    { productionUrl: undefined, native: eetNativeCrypto }
  )
  const t2 = Date.now()
  const submission = await eetApi.submit({
    environment: "playground",
    certificate: certificate.value,
    receipt: {
      eic: certificate.value.eic,
      establishmentId: "1",
      cashRegisterId: "payky-native-diag",
      sequenceNumber: `native-${now.getTime()}`,
      saleAt: formatEetDateTime(now),
      totalAmount: "1.00",
    },
    firstSubmission: true,
    verification: false,
  })
  lines.push(`submit: ${Date.now() - t2} ms`)
  const o = submission.outcome
  lines.push(
    o.type === "accepted"
      ? `accepted pok ${o.pok} isTest ${o.isTest}`
      : `${o.type} ${"errorType" in o ? `${o.errorType} code ${o.code}: ${o.message}` : ""}`
  )
}

const guard = async (work: (lines: string[]) => Promise<void>) => {
  const lines: string[] = []
  try {
    await work(lines)
  } catch (error) {
    lines.push(`THROWN ${String(error).slice(0, 300)}`)
  }
  return lines.join("\n")
}

export function EetCard() {
  const [text, setText] = useState("-")
  const [busy, setBusy] = useState(false)
  const press = async (work: (lines: string[]) => Promise<void>) => {
    setBusy(true)
    setText("running")
    setText(await guard(work))
    setBusy(false)
  }
  return (
    <View gap="2">
      <Text fontWeight="600">EET crypto (test certificates)</Text>
      <Button variant="outline" disabled={busy} onPress={() => press(crypto_)}>
        EET crypto: run
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        onPress={() => press(playground)}
      >
        EET playground round trip
      </Button>
      <Text>{text}</Text>
    </View>
  )
}
