import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { NonEmptyString255 } from "../shared/schema.ts"
import {
  adoptPublishedPublicName,
  setLegalEntity,
  setLegalEntityPublicName,
} from "./legal-entity-actions.ts"
import { legalEntityQuery } from "./legal-entity-queries.ts"

describe("legal entity actions", () => {
  test("persists country and VAT-payer status", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))

    await run.ok(setLegalEntity({ country: "CZ", vatPayer: true }))

    await expect
      .poll(() => evolu.loadQuery(legalEntityQuery))
      .toMatchObject([{ country: "CZ", vatPayer: 1 }])

    await run.ok(setLegalEntity({ country: "CZ", vatPayer: false }))

    await expect
      .poll(() => evolu.loadQuery(legalEntityQuery))
      .toMatchObject([{ country: "CZ", vatPayer: 0 }])
  }, 15_000)

  test("supports a never-configured null VAT-payer status", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))

    await run.ok(setLegalEntity({ country: null, vatPayer: null }))

    await expect
      .poll(() => evolu.loadQuery(legalEntityQuery))
      .toMatchObject([{ country: null, vatPayer: null }])
  }, 15_000)

  test("keeps the public name when the country or VAT status changes", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))

    await run.ok(
      setLegalEntityPublicName({ publicName: NonEmptyString255("Linden Café") })
    )
    await run.ok(setLegalEntity({ country: "CZ", vatPayer: true }))

    await expect
      .poll(() => evolu.loadQuery(legalEntityQuery))
      .toMatchObject([
        { country: "CZ", vatPayer: 1, publicName: "Linden Café" },
      ])
  }, 15_000)

  test("adopts the published name only while none is stored", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))

    await run.ok(
      adoptPublishedPublicName({ name: NonEmptyString255("Old Café") })
    )
    await expect
      .poll(() => evolu.loadQuery(legalEntityQuery))
      .toMatchObject([{ publicName: "Old Café" }])

    await run.ok(
      setLegalEntityPublicName({ publicName: NonEmptyString255("Linden Café") })
    )
    await run.ok(
      adoptPublishedPublicName({ name: NonEmptyString255("Old Café") })
    )
    await expect
      .poll(() => evolu.loadQuery(legalEntityQuery))
      .toMatchObject([{ publicName: "Linden Café" }])
  }, 15_000)
})
