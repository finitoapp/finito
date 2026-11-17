/** The longest a failing background task waits between attempts. */
const MAX_RETRY_BACKOFF_MS = 15 * 60 * 1000

/**
 * How many ticks of a job's `intervalMs` timer a task waits after
 * `failedCount` failures in a row before it tries again: the next tick after
 * the first, then twice as many after each further one, up to 15 minutes.
 * Counted in ticks rather than against the clock, so the first retry comes
 * one interval after the failure, not two: a deadline of "one interval after
 * the failed attempt ended" always lies just past the tick that would have
 * met it.
 */
export const getRetryTicks = (
  intervalMs: number,
  failedCount: number
): number =>
  Math.min(
    2 ** Math.max(0, failedCount - 1),
    Math.max(1, Math.floor(MAX_RETRY_BACKOFF_MS / intervalMs))
  )
