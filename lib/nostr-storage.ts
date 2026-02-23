import type NDK from "@nostr-dev-kit/ndk";
import type { NDKSigner, NDKUser } from "@nostr-dev-kit/ndk";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import type { JsonValue } from "type-fest";

const messageBusKind = 30078;

export type NostrStorage<TShape extends JsonValue> = {
	namespace: string;
	$shape: TShape;

	subscribe: (
		params: {
			ndk: NDK;
			pubkey: string;
		},
		callback: (data: TShape) => unknown,
	) => Promise<{
		close: () => void;
	}>;

	write: (
		params: {
			ndk: NDK & {
				signer: NDKSigner;
				activeUser: NDKUser;
			};
		},
		value: TShape,
	) => Promise<void>;
};

export const createNostrStorage = <TShape extends JsonValue>(props: {
	namespace: string;
}): NostrStorage<TShape> => {
	return {
		namespace: props.namespace,
		$shape: undefined as unknown as TShape,

		subscribe: async (params, callback) => {
			return await new Promise<{ close: () => void }>((resolve, reject) => {
				let settled = false;
				const processedEventCacheSize = 1024;
				const processedEventIds = new Set<string>();
				const processedEventOrder: string[] = [];
				let latestCreatedAt = Number.NEGATIVE_INFINITY;

				const rememberEventId = (eventId: string): boolean => {
					if (processedEventIds.has(eventId)) {
						return false;
					}

					processedEventIds.add(eventId);
					processedEventOrder.push(eventId);

					if (processedEventOrder.length > processedEventCacheSize) {
						const oldestEventId = processedEventOrder.shift();
						if (oldestEventId) {
							processedEventIds.delete(oldestEventId);
						}
					}

					return true;
				};

				const subscription = params.ndk.subscribe(
					{
						kinds: [messageBusKind],
						authors: [params.pubkey],
						"#d": [props.namespace],
						limit: 1,
					},
					{
						closeOnEose: false,
					},
					{
						onEose: () => {
							if (settled) {
								return;
							}

							settled = true;
							resolve({
								close: () => {
									subscription.stop();
								},
							});
						},
						onClose: () => {
							if (settled) {
								return;
							}

							settled = true;
							reject(
								new Error(
									`Nostr storage "${props.namespace}" subscription closed before becoming ready`,
								),
							);
						},
						onEvent: (event) => {
							console.log("onEvent", event.id);
							if (!rememberEventId(event.id)) {
								return;
							}

							console.log("onEvent1", event.id);
							const createdAt = event.created_at ?? 0;
							if (createdAt < latestCreatedAt) {
								return;
							}

							console.log("onEvent2", event.id);
							let data: unknown;
							try {
								data = JSON.parse(event.content);
							} catch {
								return;
							}

							console.log("onEvent3", event.id);

							latestCreatedAt = createdAt;
							callback(data as TShape);
						},
					},
				);
			});
		},

		write: async (params, value) => {
			const event = new NDKEvent(params.ndk, {
				kind: messageBusKind,
				created_at: Math.floor(Date.now() / 1000),
				tags: [["d", props.namespace]],
				content: JSON.stringify(value),
			});

			await event.publish();
		},
	};
};
