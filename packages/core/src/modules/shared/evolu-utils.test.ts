import { describe, expect, test } from "vitest"
import { cacheQueryByLimit, runMutationWithCompletion } from "./evolu-utils.ts"

describe("runMutationWithCompletion", () => {
  test("resolves with the mutation's result once onComplete fires", async () => {
    const result = await runMutationWithCompletion((options) => {
      options.onComplete?.()
      return "mutated"
    })

    expect(result).toBe("mutated")
  })

  test("waits for onComplete before resolving", async () => {
    let resolved = false

    const promise = runMutationWithCompletion((options) => {
      setTimeout(() => options.onComplete?.(), 0)
      return "mutated"
    }).then((result) => {
      resolved = true
      return result
    })

    expect(resolved).toBe(false)
    await expect(promise).resolves.toBe("mutated")
    expect(resolved).toBe(true)
  })
})

describe("cacheQueryByLimit", () => {
  test("builds each limit's query once and hands back the same one", () => {
    const built: number[] = []
    const query = cacheQueryByLimit((limit: number) => {
      built.push(limit)
      return `select ${limit}`
    })

    expect([query(21), query(21), query(41), query(21)]).toEqual([
      "select 21",
      "select 21",
      "select 41",
      "select 21",
    ])
    expect(built).toEqual([21, 41])
  })
})
