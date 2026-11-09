import { describe, expect, test, vi } from "vitest"
import {
  defaultInfinitePageSize,
  firstInfinitePageQuery,
} from "./use-infinite-evolu-query.ts"

describe("firstInfinitePageQuery", () => {
  test("asks for one row past the default page, as useInfinitePages does", () => {
    const createPageQuery = vi.fn(() => "query" as never)

    firstInfinitePageQuery(createPageQuery)

    expect(createPageQuery).toHaveBeenCalledExactlyOnceWith(
      defaultInfinitePageSize + 1
    )
  })

  test("follows a list's own page size", () => {
    const createPageQuery = vi.fn(() => "query" as never)

    firstInfinitePageQuery(createPageQuery, { pageSize: 5 })

    expect(createPageQuery).toHaveBeenCalledExactlyOnceWith(6)
  })
})
