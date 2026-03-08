import type NDK from "@nostr-dev-kit/ndk";
import type { NDKSigner, NDKUser } from "@nostr-dev-kit/ndk";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import * as errore from "errore";
import type { JsonValue } from "type-fest";

const messageBusKind = 30078;

export class NostrStorageSubscriptionClosedBeforeReadyError extends errore.createTaggedError(
	{
		name: "NostrStorageSubscriptionClosedBeforeReadyError",
		message:
			'Nostr storage "$namespace" subscription closed before becoming ready',
	},
) {}

export class NostrStorageOlderEventIgnoredError extends errore.createTaggedError(
	{
		name: "NostrStorageOlderEventIgnoredError",
		message:
			'Nostr storage "$namespace" ignored older event "$eventId" ($createdAt < $latestCreatedAt)',
	},
) {}

export class NostrStorageInvalidJsonEventError extends errore.createTaggedError(
	{
		name: "NostrStorageInvalidJsonEventError",
		message:
			'Nostr storage "$namespace" received invalid JSON in event "$eventId"',
	},
) {}

export type NostrStorageSubscription = {
	close: () => void;
};

export type NostrStorageSubscribeResult =
	| NostrStorageSubscription
	| NostrStorageSubscriptionClosedBeforeReadyError;

export type NostrStorageEventResult<TShape extends JsonValue> =
	| TShape
	| NostrStorageOlderEventIgnoredError
	| NostrStorageInvalidJsonEventError;

export type NostrStorage<TShape extends JsonValue> = {
	namespace: string;
	$shape: TShape;

	subscribe: (
		params: {
			ndk: NDK;
			pubkey: string;
		},
		callback: (result: NostrStorageEventResult<TShape>) => unknown,
	) => Promise<NostrStorageSubscribeResult>;

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
			return await new Promise<NostrStorageSubscribeResult>((resolve) => {
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
							resolve(
								new NostrStorageSubscriptionClosedBeforeReadyError({
									namespace: props.namespace,
								}),
							);
						},
						onEvent: (event) => {
							if (!rememberEventId(event.id)) {
								return;
							}

							const createdAt = event.created_at ?? 0;
							if (createdAt < latestCreatedAt) {
								callback(
									new NostrStorageOlderEventIgnoredError({
										namespace: props.namespace,
										eventId: event.id,
										createdAt,
										latestCreatedAt,
									}),
								);
								return;
							}

							const data = errore.tryFn({
								try: () => JSON.parse(event.content),
								catch: (cause) =>
									new NostrStorageInvalidJsonEventError({
										namespace: props.namespace,
										eventId: event.id,
										cause,
									}),
							});
							if (errore.isError(data)) {
								callback(data);
								return;
							}

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
