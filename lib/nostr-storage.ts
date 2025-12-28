import NDK, {
	NDKEvent,
	NDKPrivateKeySigner,
	type NDKSigner,
	type NDKSubscription,
	NDKSubscriptionCacheUsage,
	type NDKUser,
} from "@nostr-dev-kit/ndk";
import { nip04 } from "nostr-tools";
import type { JsonObject } from "type-fest";
import type { z } from "zod";
import { jsonCodec } from "@/lib/zod/jsonCodec";

export type EnhancedNDK = NDK & {
	activeUser: NDKUser;
	signer: NDKSigner;
};
type EventId = string & z.$brand<"NostrStorageEventId">;

export type NostrStorageRow<TShape extends JsonObject> = {
	value: TShape;
	createdAt: number;
	eventId: EventId;
	key: string | null;
};

export type NostrStorage<TShape extends JsonObject> = {
	namespace: string;
	$shape: TShape;
	schema: z.Schema<TShape>;

	select: (
		ndk: EnhancedNDK,
		params?: {
			key?: string | null;
			limit?: number;
			since?: number;
			until?: number;
		},
	) => Promise<{
		data: NostrStorageRow<TShape>[];
	}>;
	subscribe: (
		ndk: EnhancedNDK,
		params: {
			key?: string | null;
			limit?: number;
			since?: number;
			until?: number;
			// on eose
			onEvents: (data: {
				getAllRows: () => Record<string, NostrStorageRow<TShape>>;
				hasNextPage: boolean;
			}) => unknown;
			// after eose per each event
			onEvent: (data: {
				row: NostrStorageRow<TShape>;
				getAllRows: () => Record<string, NostrStorageRow<TShape>>;
			}) => unknown;
			// when a row is deleted by kind 5
			onDelete: (data: {
				deletedRow: NostrStorageRow<TShape>;
				getAllRows: () => Record<string, NostrStorageRow<TShape>>;
			}) => unknown;
		},
	) => {
		close: () => void;
		fetchNextPage: () => void;
	};
	insertOrUpdate: (
		ndk: EnhancedNDK,
		key: string | null,
		value: TShape,
	) => Promise<NostrStorageRow<TShape>>;
	delete: (ndk: EnhancedNDK, eventId: EventId) => Promise<{ eventId: EventId }>;
};

const kind = 30078; // Application
// const kind = 14; // private message

export const createNostrStorage = <TShape extends JsonObject>(props: {
	schema: z.Schema<TShape>;
	namespace: string;
	useEncryption?: boolean | undefined;
}) => {
	const getFullKey = (key: string | null) =>
		`${props.namespace}${key !== null ? `|${key}` : ""}`;

	const schemaCodes = jsonCodec(props.schema);
	const decodeEvent = (ndk: EnhancedNDK, event: NDKEvent) => {
		const dTag = event.tagValue("d");
		if (dTag === undefined || event.created_at === undefined) {
			return undefined;
		}

		const key = dTag.substring(props.namespace.length + 1);
		const encrypted = event.tagValue("encrypted");
		const content =
			encrypted === "true" && ndk.signer instanceof NDKPrivateKeySigner
				? nip04.decrypt(
						ndk.signer.privateKey,
						ndk.activeUser.pubkey,
						event.content,
					)
				: event.content;

		const result = schemaCodes.safeDecode(content);
		if (!result.success) {
			return undefined;
		}

		return {
			key,
			eventId: event.id as EventId,
			createdAt: event.created_at,
			value: result.data,
		};
	};

	const select: NostrStorage<TShape>["select"] = async (ndk, params) => {
		const filter = {
			kinds: [kind],
			authors: [ndk.activeUser.pubkey],
			"#l": [props.namespace],
			...(params && params.limit ? { limit: params.limit } : {}),
			...(params && params.until ? { until: params.until } : {}),
			...(params && params.since ? { since: params.since } : {}),
			...(params && params.key !== undefined
				? { "#d": [getFullKey(params.key)] }
				: {}),
		};

		console.log("filter", filter);

		const events = await ndk.fetchEvents(filter, {
			cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
		});

		const result = new Map<string, NostrStorageRow<TShape>>();
		for (const event of events) {
			const row = decodeEvent(ndk, event);
			if (row === undefined) {
				continue;
			}

			result.set(row.key, row);
		}

		return {
			data: Array.from(result.values()),
		};
	};

	const subscribe: NostrStorage<TShape>["subscribe"] = (ndk, params) => {
		let oldestDate: undefined | number;
		const eventBuffer = new Map<string, NostrStorageRow<TShape>>();
		const eventIdToEventKey = new Map<string, string>();

		let pageEventCounter = 0;

		const createSubscription = (
			options: {
				untilOverride?: number;
				closeOnEose?: boolean;
				onEose?: () => void;
			} = {},
		) => {
			let eose = false;
			const until = options.untilOverride ?? params.until;

			const filter = {
				kinds: [kind],
				authors: [ndk.activeUser.pubkey],
				"#l": [props.namespace],
				...(params && params.limit ? { limit: params.limit } : {}),
				...(until ? { until: until } : {}),
				...(params && params.since ? { since: params.since } : {}),
				...(params && params.key !== undefined
					? { "#d": [getFullKey(params.key)] }
					: {}),
			};

			return ndk.subscribe(
				filter,
				{
					closeOnEose: options.closeOnEose ?? false,
					cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
				},
				{
					onEose: () => {
						console.log("onEose");
						if (options.onEose) {
							options.onEose();
						}

						eose = true;
						params.onEvents({
							getAllRows: () =>
								Object.fromEntries(
									Array.from(eventBuffer.entries()).sort((a, b) =>
										a[1].createdAt < b[1].createdAt ? 1 : -1,
									),
								),
							hasNextPage:
								pageEventCounter > 0 &&
								(params.limit === undefined ||
									params.limit === pageEventCounter),
						});
					},
					onEvents: async (events) => {
						for (const event of events) {
							const row = decodeEvent(ndk, event);
							if (row === undefined) {
								continue;
							}

							if (oldestDate === undefined || oldestDate > row.createdAt) {
								oldestDate = row.createdAt;
							}

							const currentRow = eventBuffer.get(row.key);
							if (
								currentRow !== undefined &&
								currentRow.createdAt > row.createdAt
							) {
								continue;
							}

							pageEventCounter = pageEventCounter + 1;
							eventBuffer.set(row.key, row);
							eventIdToEventKey.set(row.eventId, row.key);
						}
					},
					onEvent: async (event) => {
						const row = decodeEvent(ndk, event);
						if (row === undefined) {
							return;
						}

						if (oldestDate === undefined || oldestDate > row.createdAt) {
							oldestDate = row.createdAt;
						}

						const currentRow = eventBuffer.get(row.key);
						if (
							currentRow !== undefined &&
							currentRow.createdAt > row.createdAt
						) {
							return;
						}

						eventBuffer.set(row.key, row);
						eventIdToEventKey.set(row.eventId, row.key);

						if (eose) {
							params.onEvent({
								row: row,
								getAllRows: () =>
									Object.fromEntries(
										Array.from(eventBuffer.entries()).sort((a, b) =>
											a[1].createdAt < b[1].createdAt ? 1 : -1,
										),
									),
							});
						} else {
							pageEventCounter = pageEventCounter + 1;
						}
					},
				},
			);
		};

		let pageSubscription: NDKSubscription | null = createSubscription({
			onEose: () => {
				pageSubscription = null;
			},
		});
		const subscription = pageSubscription;

		const deletionSubscription = ndk.subscribe(
			{
				kinds: [
					5, // deletion
				],
				authors: [ndk.activeUser.pubkey],
				"#k": [kind.toString()],
				limit: 0,
			},
			{
				closeOnEose: false,
				cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
			},
			{
				onEvent: async (event) => {
					console.log("delete-event", await event.toNostrEvent());
					const eventId = event.tagValue("e");
					if (eventId === undefined) {
						return;
					}

					const eventKey = eventIdToEventKey.get(eventId);
					if (eventKey === undefined) {
						return;
					}

					eventIdToEventKey.delete(event.id as EventId);

					const row = eventBuffer.get(eventKey);
					if (row === undefined) {
						return;
					}

					eventBuffer.delete(eventKey);

					params.onDelete({
						deletedRow: row,
						getAllRows: () =>
							Object.fromEntries(
								Array.from(eventBuffer.entries()).sort((a, b) =>
									a[1].createdAt < b[1].createdAt ? 1 : -1,
								),
							),
					});
				},
			},
		);

		return {
			close: () => {
				subscription.stop();
				deletionSubscription.stop();
			},
			fetchNextPage: () => {
				if (pageSubscription === null) {
					pageEventCounter = 0;
					pageSubscription = createSubscription({
						closeOnEose: true,
						untilOverride: oldestDate,
						onEose: () => {
							console.log("fetchNextPage-onEose");
							if (pageSubscription) {
								pageSubscription.stop();
								pageSubscription = null;
							}
						},
					});
				}
			},
		};
	};

	const insertOrUpdate: NostrStorage<TShape>["insertOrUpdate"] = async (
		ndk,
		key,
		value,
	) => {
		const content = schemaCodes.encode(value);

		const event = new NDKEvent(ndk, {
			kind: kind,
			created_at: Math.floor(Date.now() / 1000),
			tags: [
				["d", getFullKey(key)],
				["l", props.namespace],
				...(props.useEncryption ? [["encrypted", "true"]] : []),
			],
			content:
				props.useEncryption && ndk.signer instanceof NDKPrivateKeySigner
					? nip04.encrypt(ndk.signer.privateKey, ndk.activeUser.pubkey, content)
					: content,
		});

		await event.publish();

		return {
			value,
			eventId: event.id as EventId,
			createdAt: event.rawEvent().created_at,
			key,
		};
	};

	const deleteItem: NostrStorage<TShape>["delete"] = async (ndk, eventId) => {
		const event = new NDKEvent(ndk, {
			kind: 5,
			created_at: Math.floor(Date.now() / 1000),
			tags: [
				["e", eventId],
				["k", kind.toString()],
			],
			content: "Deleted",
		});

		await event.publish();

		return {
			eventId: event.id as EventId,
		};
	};

	return {
		$shape: undefined as unknown as TShape,
		schema: props.schema,

		select,
		subscribe,
		insertOrUpdate,
		delete: deleteItem,
	} as NostrStorage<TShape>;
};
