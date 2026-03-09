import { err, ok, type Result } from "@evolu/common";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKSigner, NDKUser } from "@nostr-dev-kit/ndk";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import type { JsonValue } from "type-fest";
import { defineError } from "@/lib/shared/error";

const messageBusKind = 30078;

const createNostrStorageSubscriptionClosedBeforeReadyError = defineError(
	"NostrStorageSubscriptionClosedBeforeReadyError",
)<{
	namespace: string;
}>();
export type NostrStorageSubscriptionClosedBeforeReadyError = ReturnType<
	typeof createNostrStorageSubscriptionClosedBeforeReadyError
>;

const createNostrStorageOlderEventIgnoredError = defineError(
	"NostrStorageOlderEventIgnoredError",
)<{
	namespace: string;
	eventId: string;
	createdAt: number;
	latestCreatedAt: number;
}>();
export type NostrStorageOlderEventIgnoredError = ReturnType<
	typeof createNostrStorageOlderEventIgnoredError
>;

const createNostrStorageInvalidJsonEventError = defineError(
	"NostrStorageInvalidJsonEventError",
)<{
	namespace: string;
	eventId: string;
	cause: unknown;
}>();
export type NostrStorageInvalidJsonEventError = ReturnType<
	typeof createNostrStorageInvalidJsonEventError
>;

export type NostrStorageSubscription = {
	close: () => void;
};

export type NostrStorageSubscribeError =
	NostrStorageSubscriptionClosedBeforeReadyError;

export type NostrStorageSubscribeResult = Result<
	NostrStorageSubscription,
	NostrStorageSubscribeError
>;

export type NostrStorageEventError =
	| NostrStorageOlderEventIgnoredError
	| NostrStorageInvalidJsonEventError;

export type NostrStorageEventResult<TShape extends JsonValue> = Result<
	TShape,
	NostrStorageEventError
>;

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
							resolve(
								ok({
									close: () => {
										subscription.stop();
									},
								}),
							);
						},
						onClose: () => {
							if (settled) {
								return;
							}

							settled = true;
							resolve(
								err(
									createNostrStorageSubscriptionClosedBeforeReadyError({
										namespace: props.namespace,
									}),
								),
							);
						},
						onEvent: (event) => {
							if (!rememberEventId(event.id)) {
								return;
							}

							const createdAt = event.created_at ?? 0;
							if (createdAt < latestCreatedAt) {
								callback(
									err(
										createNostrStorageOlderEventIgnoredError({
											namespace: props.namespace,
											eventId: event.id,
											createdAt,
											latestCreatedAt,
										}),
									),
								);
								return;
							}

							try {
								const data = JSON.parse(event.content) as TShape;
								latestCreatedAt = createdAt;
								callback(ok(data));
							} catch (cause) {
								callback(
									err(
										createNostrStorageInvalidJsonEventError({
											namespace: props.namespace,
											eventId: event.id,
											cause,
										}),
									),
								);
							}
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
