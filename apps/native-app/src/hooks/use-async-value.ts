import { useEffect, useRef, useState } from "react"

interface AsyncValue<T> {
  readonly data: T | null
  readonly failed: boolean
  readonly loading: boolean
}

/**
 * A keyed read from a remote or native API (the Spark balance, an LNURL's
 * metadata, the BTC rate). Loads when `key` changes, `null` loads nothing,
 * and both a late result and the settled value of a replaced key are dropped:
 * a new key starts from no data, so a failed load never shows the previous
 * key's answer. With `refetchMs` it asks again until `done` says the answer
 * is final.
 */
export function useAsyncValue<T>(
  key: string | null,
  load: () => Promise<T>,
  options: {
    readonly refetchMs?: number
    readonly done?: (data: T) => boolean
  } = {}
): AsyncValue<T> {
  const [state, setState] = useState<
    AsyncValue<T> & { readonly key: string | null }
  >({ key, data: null, failed: false, loading: key !== null })
  const latest = useRef({ load, options })
  latest.current = { load, options }

  useEffect(() => {
    if (key === null) {
      setState({ key, data: null, failed: false, loading: false })
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    setState((previous) =>
      previous.key === key
        ? { ...previous, loading: true }
        : { key, data: null, failed: false, loading: true }
    )

    const attempt = async () => {
      try {
        const data = await latest.current.load()
        if (cancelled) return
        setState({ key, data, failed: false, loading: false })
        const { refetchMs, done } = latest.current.options
        if (refetchMs !== undefined && done?.(data) !== true) {
          timer = setTimeout(attempt, refetchMs)
        }
      } catch {
        if (cancelled) return
        setState((previous) => ({ ...previous, failed: true, loading: false }))
        const { refetchMs } = latest.current.options
        if (refetchMs !== undefined) timer = setTimeout(attempt, refetchMs)
      }
    }
    void attempt()

    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [key])

  // Between a key change and the effect that resets the state, render must
  // not show the replaced key's answer either.
  if (state.key !== key)
    return { data: null, failed: false, loading: key !== null }
  return { data: state.data, failed: state.failed, loading: state.loading }
}
