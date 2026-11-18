import { describe, expect, test } from "vitest"
import {
  createTabSwitchTimer,
  type TabSwitchTiming,
} from "./tab-switch-timing.ts"

const setup = () => {
  let time = 0
  const frames: Array<() => void> = []
  const reports: TabSwitchTiming[] = []
  const timer = createTabSwitchTimer({
    now: () => time,
    nextFrame: (callback) => {
      frames.push(callback)
    },
  })
  return {
    timer,
    reports,
    report: (timing: TabSwitchTiming) => {
      reports.push(timing)
    },
    advance: (ms: number) => {
      time += ms
    },
    flushFrame: (ms: number) => {
      time += ms
      for (const frame of frames.splice(0)) frame()
    },
  }
}

describe("tab switch timing (navigation/0006)", () => {
  test("reports the time from the press to the commit and to the next frame", () => {
    const { timer, reports, report, advance, flushFrame } = setup()
    timer.markPress("settings")
    advance(180)
    timer.arrive("/settings", report)
    expect(reports).toEqual([])
    flushFrame(20)
    expect(reports).toEqual([
      { tab: "settings", pathname: "/settings", commitMs: 180, frameMs: 200 },
    ])
  })

  test("counts any root screen of the pressed tab and nothing else", () => {
    const { timer, reports, report, advance, flushFrame } = setup()
    timer.markPress("activity")
    advance(50)
    timer.arrive("/settings", report)
    timer.arrive("/activity/123", report)
    timer.arrive("/activity/bills", report)
    flushFrame(10)
    expect(reports).toEqual([
      {
        tab: "activity",
        pathname: "/activity/bills",
        commitMs: 50,
        frameMs: 60,
      },
    ])
  })

  test("reports a press once, and drops one that never arrived", () => {
    const { timer, reports, report, advance, flushFrame } = setup()
    timer.markPress("notifications")
    advance(10)
    timer.arrive("/notifications", report)
    timer.arrive("/notifications", report)
    flushFrame(0)
    expect(reports).toHaveLength(1)

    timer.markPress("terminal")
    advance(6000)
    timer.arrive("/", report)
    flushFrame(0)
    expect(reports).toHaveLength(1)
  })
})
