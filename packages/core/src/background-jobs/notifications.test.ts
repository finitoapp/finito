import { describe, expect, test } from "vitest"
import {
  createNotificationStore,
  type JobNotification,
} from "./notifications.ts"

// One type exists today; the store treats each entry as opaque data, so a
// second job raising the same type is enough to tell the jobs apart.
const backup: JobNotification = { type: "recoveryPhraseBackup" }

describe("createNotificationStore", () => {
  test("starts empty", () => {
    const store = createNotificationStore()
    expect(store.getSnapshot()).toEqual([])
  })

  test("set replaces the job's previous list", () => {
    const store = createNotificationStore()
    const scope = store.notifications.open("job")

    scope.set([backup, backup])
    expect(store.getSnapshot()).toEqual([backup, backup])

    scope.set([backup])
    expect(store.getSnapshot()).toEqual([backup])

    scope.set([])
    expect(store.getSnapshot()).toEqual([])
  })

  test("disposing the scope drops its notifications", () => {
    const store = createNotificationStore()
    const scope = store.notifications.open("job")
    scope.set([backup])

    scope[Symbol.dispose]()

    expect(store.getSnapshot()).toEqual([])
    // A disposed scope writes nothing more.
    scope.set([backup])
    expect(store.getSnapshot()).toEqual([])
  })

  test("lists the jobs in the order their scopes were opened", () => {
    const store = createNotificationStore()
    const first = store.notifications.open("first")
    const second = store.notifications.open("second")

    second.set([{ ...backup, from: "second" } as JobNotification])
    first.set([{ ...backup, from: "first" } as JobNotification])

    expect(store.getSnapshot()).toEqual([
      { type: "recoveryPhraseBackup", from: "first" },
      { type: "recoveryPhraseBackup", from: "second" },
    ])
  })

  test("two jobs do not overwrite each other's lists", () => {
    const store = createNotificationStore()
    const first = store.notifications.open("first")
    const second = store.notifications.open("second")
    first.set([backup])
    second.set([backup])

    second.set([])
    expect(store.getSnapshot()).toEqual([backup])

    first[Symbol.dispose]()
    second.set([backup])
    expect(store.getSnapshot()).toEqual([backup])
  })

  test("getSnapshot is the same array until something changes", () => {
    const store = createNotificationStore()
    const scope = store.notifications.open("job")
    const empty = store.getSnapshot()
    expect(store.getSnapshot()).toBe(empty)

    scope.set([])
    expect(store.getSnapshot()).toBe(empty)

    scope.set([backup])
    const one = store.getSnapshot()
    expect(one).not.toBe(empty)
    expect(store.getSnapshot()).toBe(one)

    scope.set([{ type: "recoveryPhraseBackup" }])
    expect(store.getSnapshot()).toBe(one)
  })

  test("tells subscribers about changes only", () => {
    const store = createNotificationStore()
    let calls = 0
    const unsubscribe = store.subscribe(() => {
      calls++
    })
    const scope = store.notifications.open("job")

    scope.set([])
    expect(calls).toBe(0)
    scope.set([backup])
    expect(calls).toBe(1)
    scope.set([backup])
    expect(calls).toBe(1)
    scope[Symbol.dispose]()
    expect(calls).toBe(2)

    unsubscribe()
    store.notifications.open("job").set([backup])
    expect(calls).toBe(2)
  })

  test("a job reopened before its old scope is disposed keeps the new list", () => {
    const store = createNotificationStore()
    const old = store.notifications.open("job")
    const other = store.notifications.open("other")
    old.set([backup])

    const reopened = store.notifications.open("job")
    expect(store.getSnapshot()).toEqual([])
    reopened.set([backup])
    other.set([{ ...backup, from: "other" } as JobNotification])

    old.set([])
    old[Symbol.dispose]()

    // The job keeps its place ahead of `other`.
    expect(store.getSnapshot()).toEqual([
      backup,
      { type: "recoveryPhraseBackup", from: "other" },
    ])
  })
})
