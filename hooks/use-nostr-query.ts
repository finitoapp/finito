import type {
	NDKFilter,
	NDKSubscriptionOptions,
	NostrEvent,
} from "@nostr-dev-kit/ndk";
import { useEffect, useEffectEvent, useState } from "react";
import { useNostr } from "@/hooks/use-nostr";

export const useNostrQuery = <T = NostrEvent>(
	filters: NDKFilter | NDKFilter[],
	opts: NDKSubscriptionOptions & {
		transform?: (event: NostrEvent) => Promise<T | undefined>;
	} = {},
) => {
	const { ndk } = useNostr();
	const [data, setData] = useState<{
		data: T | undefined;
		eose: boolean;
	}>({
		data: undefined,
		eose: false,
	});

	const fetchEvent = useEffectEvent(async (mounted: { value: boolean }) => {
		console.log("fetch");
		const event = await ndk.fetchEvent(filters, opts);
		console.log("event", event);
		if (event === null) {
			if (mounted.value) {
				setData({
					data: undefined,
					eose: true,
				});
			}
			return;
		}

		const data = await event.toNostrEvent();
		const finalData = opts.transform ? await opts.transform(data) : data;

		if (mounted.value) {
			setData({
				// @ts-expect-error
				data: finalData,
				eose: true,
			});
		}
	});

	useEffect(() => {
		const mounted = {
			value: true,
		};

		void fetchEvent(mounted);

		return () => {
			mounted.value = false;
		};
	}, []);

	return data;
};
