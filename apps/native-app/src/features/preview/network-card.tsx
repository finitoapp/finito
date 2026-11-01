import { appFetchAsJson, fetchAndValidateJson } from "@payky/core/deps"
import { fetchLinkyEvoluRelays } from "@payky/core/integrations/linky/linky-relays-client"
import { getNetworkStateAsync } from "expo-network"
import { useEffect, useState } from "react"
import { Text, View } from "tamagui"
import { z } from "zod"
import { Button } from "../../components/ui/button.tsx"
import { apiUrl, nativeEnv } from "../../core/native-env.ts"
import { nativeRun } from "../../core/native-runtime.ts"
import {
  createConnectivityDep,
  createFetchDep,
} from "../../platform/native-deps.ts"

const describe = (result: { ok: boolean; error?: unknown; value?: unknown }) =>
  result.ok ? "ok" : `error ${(result.error as { type: string }).type}`

const check = async (name: string): Promise<string> => {
  await using run = nativeRun.create({ ...createFetchDep() })
  switch (name) {
    case "relays": {
      const r = await run(
        fetchLinkyEvoluRelays(nativeEnv.EXPO_PUBLIC_LINKY_RELAYS_URL)
      )
      return r.ok ? `ok, ${r.value.length} evolu relays` : describe(r)
    }
    case "http": {
      const r = await run(appFetchAsJson(apiUrl("/api/definitely-missing")))
      return r.ok ? `ok, HTTP ${r.value.status}` : describe(r)
    }
    case "validation": {
      const r = await run(
        fetchAndValidateJson({
          url: apiUrl("/"),
          schema: z.object({ a: z.string() }),
          onHttpError: (e) => ({ type: "HttpError" as const, ...e }),
          onResponseError: (e) => ({ type: "ResponseError" as const, ...e }),
        })
      )
      return r.ok
        ? "ok (unexpected)"
        : `${r.error.type}${"status" in r.error ? ` status ${r.error.status}` : ""}`
    }
    default: {
      // Abort the request right after starting it.
      const fiber = run.abortable(appFetchAsJson("https://httpbin.org/delay/5"))
      fiber.abort()
      const r = await fiber
      return r.ok
        ? "ok (not aborted)"
        : `${describe(r)}${"error" in r.error ? `: ${String(r.error.error)}` : ""}`
    }
  }
}

export function NetworkCard() {
  const [results, setResults] = useState<Record<string, string>>({})
  const [online, setOnline] = useState("?")
  const [events, setEvents] = useState(0)

  useEffect(() => {
    getNetworkStateAsync().then((s) =>
      setOnline(`${s.isConnected}/${s.isInternetReachable}`)
    )
    return createConnectivityDep().connectivity.onOnline(() => {
      setEvents((n) => n + 1)
      setOnline("true/true")
    })
  }, [])

  const run = async (name: string) => {
    setResults((r) => ({ ...r, [name]: "running" }))
    let text: string
    try {
      text = await check(name)
    } catch (error) {
      text = `thrown ${String(error)}`
    }
    setResults((r) => ({ ...r, [name]: text }))
  }

  return (
    <View gap="2">
      <Text fontWeight="600">Network</Text>
      <Text>Online (connected/reachable): {online}</Text>
      <Text>onOnline events: {events}</Text>
      {["relays", "http", "validation", "abort"].map((name) => (
        <View key={name}>
          <Button
            variant="outline"
            label={`Network: ${name}`}
            onPress={() => run(name)}
          />
          <Text>
            {name}: {results[name] ?? "-"}
          </Text>
        </View>
      ))}
    </View>
  )
}
