import type {
	NDKEvent,
	NDKFilter,
	NDKRawEvent,
	NDKSubscriptionOptions,
	NostrEvent,
} from "@nostr-dev-kit/ndk";
import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { useNostr } from "@/hooks/use-nostr";

export const useNostrSubscription = <T = NostrEvent>(
	filters: NDKFilter | NDKFilter[] | false,
	opts: NDKSubscriptionOptions & {
		transform?: (event: NDKRawEvent) => Promise<T | undefined>;
	} = {},
) => {
	const { ndk } = useNostr();
	const [refetchFlag, setRefetchFlag] = useState<boolean>(false);
	const [data, setData] = useState<{
		data: Record<string, T>;
		eose: boolean;
	}>({
		data: {},
		eose: false,
	});

	const refetch = useCallback(() => {
		setRefetchFlag((value) => !value);
		setData({
			data: {},
			eose: false,
		});
	}, []);

	const onEvent = useEffectEvent(async (event: NDKEvent) => {
		console.log("event", event);
		const data = await event.toNostrEvent();
		const finalData = opts.transform
			? // @ts-expect-error
				await opts.transform(data)
			: data;
		if (finalData === undefined) {
			return;
		}

		// @ts-expect-error
		setData((values) => ({
			...values,
			data: {
				...values.data,
				[event.id]: finalData,
			},
		}));
	});

	const onEvents = useEffectEvent(async (events: NDKEvent[]) => {
		console.log("events", events);
		const data = await Promise.all(events.map((event) => event.toNostrEvent()));

		const finalData: Record<string, T> = {};
		if (opts.transform) {
			for (const row of data) {
				const rowResult = opts.transform
					? // @ts-expect-error
						await opts.transform(row)
					: row;
				if (rowResult === undefined) {
					continue;
				}

				// @ts-expect-error
				finalData[row.id ?? ""] = rowResult;
			}
		}

		setData((values) => ({
			...values,
			data: { ...values.data, ...finalData },
		}));
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies(filters !== false): suppress dependency filters
	// biome-ignore lint/correctness/useExhaustiveDependencies(filters): suppress dependency filters
	// biome-ignore lint/correctness/useExhaustiveDependencies(opts): suppress dependency opts
	// biome-ignore lint/correctness/useExhaustiveDependencies(refetchFlag): suppress dependency refetchFlag
	useEffect(() => {
		if (filters === false) {
			return;
		}

		console.log("subscribe");
		const subscription = ndk.subscribe(filters, opts, {
			onEvent,
			onEvents,
			onEose: () => {
				setData((values) => ({
					...values,
					eose: true,
				}));
			},
		});

		return () => {
			subscription.stop();
		};
	}, [ndk.subscribe, refetchFlag, filters !== false]);

	return {
		data: Object.values(data.data),
		eose: data.eose,
		refetch,
	};
};
