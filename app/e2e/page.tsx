"use client";

import { atom, useAtomValue } from "jotai";
import { unwrap } from "jotai/utils";
import { useEffect, useState } from "react";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import type { DeviceEvolu } from "@/lib/evolu/device";
import {
	bootstrapE2eAccount,
	resetE2eBrowserState,
} from "@/lib/testing/e2e-catalog";
import { runE2EScenario } from "@/lib/testing/e2e-scenarios";

type DeviceEvoluState =
	| { state: "loading" }
	| { state: "hasError"; error: unknown }
	| { state: "hasData"; data: DeviceEvolu };

const unwrappedDeviceEvoluAtom = unwrap(deviceEvoluAtom);
const loadableDeviceEvoluAtom = atom<DeviceEvoluState>((get) => {
	try {
		const data = get(unwrappedDeviceEvoluAtom);
		if (!data) {
			return { state: "loading" };
		}

		return { state: "hasData", data };
	} catch (error) {
		return { state: "hasError", error };
	}
});

export default function Page() {
	const deviceEvoluState = useAtomValue(loadableDeviceEvoluAtom);
	const [status, setStatus] = useState("loading");
	const [lastResult, setLastResult] = useState<string>("");

	useEffect(() => {
		if (deviceEvoluState.state !== "hasData") {
			setStatus(deviceEvoluState.state === "hasError" ? "error" : "loading");
			delete window.__finitoE2E;
			return;
		}

		window.__finitoE2E = {
			resetBrowserState: async () => {
				setStatus("running");
				await resetE2eBrowserState();
				setLastResult("{}");
				setStatus("ready");
			},
			bootstrap: async (context) => {
				setStatus("running");
				const result = await bootstrapE2eAccount(
					deviceEvoluState.data,
					context,
				);
				const payload = {
					deviceId: result.device.id,
					mnemonic: result.mnemonic,
				};
				setLastResult(JSON.stringify(payload));
				setStatus("ready");
				return payload;
			},
			runScenario: async (name, input, context) => {
				setStatus("running");
				const result = await runE2EScenario(
					deviceEvoluState.data,
					name,
					input,
					context,
				);
				setLastResult(JSON.stringify(result));
				setStatus("ready");
				return result;
			},
		};

		setStatus("ready");

		return () => {
			delete window.__finitoE2E;
		};
	}, [deviceEvoluState]);

	const errorMessage =
		deviceEvoluState.state === "hasError"
			? String(deviceEvoluState.error)
			: undefined;

	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 p-6 font-mono text-sm">
			<h1 className="text-lg font-semibold">Finito E2E Harness</h1>
			<p data-testid="e2e-status">status:{status}</p>
			{errorMessage ? <p data-testid="e2e-error">{errorMessage}</p> : null}
			<pre
				data-testid="e2e-last-result"
				className="overflow-auto rounded border p-4"
			>
				{lastResult || "{}"}
			</pre>
		</main>
	);
}
