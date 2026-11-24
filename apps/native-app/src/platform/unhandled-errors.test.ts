import { createConsole } from "@evolu/common"
import { createConsoleOutputHistory } from "@payky/app-shared/console-history"
import { describe, expect, it } from "vitest"
import {
  captureUnhandledErrors,
  type GlobalErrorHandlerHost,
} from "./unhandled-errors.ts"
import { captureUnhandledErrors as captureWebUnhandledErrors } from "./unhandled-errors.web.ts"

const createHistoryConsole = () => {
  const history = createConsoleOutputHistory({ limit: 10 })
  const console = createConsole({ level: "debug", output: history }).child(
    "unhandled"
  )
  return { history, console }
}

describe("captureUnhandledErrors", () => {
  it("logs the error, then hands it to the previous handler", () => {
    const { history, console } = createHistoryConsole()
    const handled: Array<readonly [unknown, boolean | undefined]> = []
    let handler: Parameters<GlobalErrorHandlerHost["setGlobalHandler"]>[0] = (
      error,
      isFatal
    ) => {
      handled.push([error, isFatal])
    }
    const host: GlobalErrorHandlerHost = {
      getGlobalHandler: () => handler,
      setGlobalHandler: (next) => {
        handler = next
      },
    }

    captureUnhandledErrors(console, host)
    // A second install (fast refresh) does not wrap again.
    captureUnhandledErrors(console, host)
    const error = new Error("boom")
    handler(error, true)

    expect(handled).toEqual([[error, true]])
    expect(
      history.getEntries().map(({ method, path, args }) => ({
        method,
        path,
        args,
      }))
    ).toEqual([
      { method: "error", path: ["unhandled"], args: ["Fatal error", error] },
    ])
  })

  it("logs uncaught errors and unhandled rejections on web", () => {
    const { history, console } = createHistoryConsole()
    const target = new EventTarget()

    captureWebUnhandledErrors(console, target)
    captureWebUnhandledErrors(console, target)
    const error = new Error("boom")
    target.dispatchEvent(
      Object.assign(new Event("error"), { error, message: "boom" })
    )
    target.dispatchEvent(
      Object.assign(new Event("unhandledrejection"), { reason: "nope" })
    )

    expect(history.getEntries().map(({ args }) => args)).toEqual([
      ["Uncaught error", error],
      ["Unhandled rejection", "nope"],
    ])
  })
})
