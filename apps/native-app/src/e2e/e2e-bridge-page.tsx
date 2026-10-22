import { type Href, Redirect, router, useLocalSearchParams } from "expo-router"
import { useAtomValue, useStore } from "jotai"
import { useEffect, useState } from "react"
import { Text, YStack } from "tamagui"
import { accountAtom } from "../atoms/account.ts"
import { nativeEnv } from "../core/native-env.ts"
import { useAppRun } from "../hooks/use-app-run.ts"
import { e2eActions } from "./e2e-actions.ts"

/**
 * `/e2e/<action>?<params>`: runs one `e2eActions` entry and prints
 * `E2E OK <action>` (and its value) or `E2E FAIL <action>: <message>`, which
 * the flow waits for before going on — its stand-in for awaiting web's
 * `page.evaluate`. With `next=<path>` it then moves on to that screen in-app:
 * on web an `openLink` reloads the page, which loses in-memory state such as
 * the debug console's history. Outside an e2e build (`EXPO_PUBLIC_PAYKY_E2E`) it only
 * redirects home. The text is for Maestro, not for people, so it is not
 * translated.
 */
export function E2eBridgePage() {
  const {
    action = "",
    next,
    during,
    ...params
  } = useLocalSearchParams<{ action: string; next?: string; during?: string }>()
  const appRun = useAppRun()
  const { device } = useAtomValue(accountAtom)
  const store = useStore()
  const [result, setResult] = useState<string | null>(null)
  const paramsKey = JSON.stringify(params)

  // biome-ignore lint/correctness/useExhaustiveDependencies: paramsKey stands for params
  useEffect(() => {
    const run = e2eActions[action]
    if (!nativeEnv.EXPO_PUBLIC_PAYKY_E2E || run === undefined) return
    let cancelled = false
    setResult(null)
    const perform = async () => {
      try {
        await using appRunScope = appRun()
        const value = await run(
          appRunScope,
          Object.fromEntries(
            Object.entries(params).map(([key, v]) => [key, String(v)])
          ),
          { deviceId: device.id, store }
        )
        if (cancelled) return
        setResult(`E2E OK ${action}${value === undefined ? "" : ` ${value}`}`)
        if (next !== undefined) router.replace(next as Href)
      } catch (error) {
        if (!cancelled)
          setResult(
            // run.orThrow's Error carries the Result's error as its cause.
            `E2E FAIL ${action}: ${error instanceof Error ? `${error.message} ${JSON.stringify(error.cause) ?? ""}` : String(error)}`
          )
      }
    }
    void perform()
    if (during !== undefined) {
      router.replace(during as Href)
    }
    return () => {
      cancelled = true
    }
  }, [action, appRun, device.id, store, paramsKey, next, during])

  if (!nativeEnv.EXPO_PUBLIC_PAYKY_E2E) return <Redirect href="/" />
  return (
    // Centered: under the status bar Maestro counts the text as hidden.
    <YStack flex={1} p="4" bg="background" items="center" justify="center">
      <Text testID="e2e-result" color="foreground">
        {e2eActions[action] === undefined
          ? `E2E FAIL ${action}: unknown action`
          : (result ?? `E2E RUNNING ${action}`)}
      </Text>
    </YStack>
  )
}
