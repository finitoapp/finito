import { describe, expect, it } from "bun:test";
import {
	createNostrStorage,
	NostrStorageInvalidJsonEventError,
	NostrStorageOlderEventIgnoredError,
	NostrStorageSubscriptionClosedBeforeReadyError,
} from "@/lib/nostr-storage";

type TestEvent = {
	id: string;
	created_at?: number;
	content: string;
};

type SubscriptionHandlers = {
	onEose?: () => void;
	onClose?: () => void;
	onEvent?: (event: TestEvent) => void;
};

describe("createNostrStorage", () => {
	it("subscribes with correct filter and emits only valid newest events", async () => {
		let handlers: SubscriptionHandlers | undefined;
		let stopCalls = 0;
		let subscribeCall: [unknown, unknown, SubscriptionHandlers] | undefined;

		const ndk = {
			subscribe: (
				filter: unknown,
				opts: unknown,
				callbacks: SubscriptionHandlers,
			) => {
				subscribeCall = [filter, opts, callbacks];
				handlers = callbacks;

				return {
					stop: () => {
						stopCalls += 1;
					},
				};
			},
		};

		const storage = createNostrStorage<{ foo: number }>({
			namespace: "prefs",
		});
		const received: Array<unknown> = [];

		const readyPromise = storage.subscribe(
			{ ndk: ndk as never, pubkey: "pubkey123" },
			(result) => {
				received.push(result);
			},
		);

		expect(subscribeCall).toBeDefined();
		expect(subscribeCall?.[0]).toEqual({
			kinds: [30078],
			authors: ["pubkey123"],
			"#d": ["prefs"],
			limit: 1,
		});
		expect(subscribeCall?.[1]).toEqual({
			closeOnEose: false,
		});

		handlers?.onEvent?.({ id: "e1", created_at: 10, content: '{"foo":1}' });
		handlers?.onEvent?.({ id: "e1", created_at: 11, content: '{"foo":999}' });
		handlers?.onEvent?.({ id: "e2", created_at: 9, content: '{"foo":2}' });
		handlers?.onEvent?.({ id: "e3", created_at: 12, content: "{invalid" });
		handlers?.onEvent?.({ id: "e4", created_at: 10, content: '{"foo":3}' });
		handlers?.onEvent?.({ id: "e5", content: '{"foo":4}' });

		expect(received).toHaveLength(5);
		expect(received[0]).toEqual({ foo: 1 });

		const olderEventError1 = received[1];
		if (!NostrStorageOlderEventIgnoredError.is(olderEventError1)) {
			throw new Error("Expected older event error");
		}
		expect(olderEventError1.eventId).toBe("e2");
		expect(olderEventError1.createdAt).toBe(9);
		expect(olderEventError1.latestCreatedAt).toBe(10);

		const invalidJsonError = received[2];
		if (!NostrStorageInvalidJsonEventError.is(invalidJsonError)) {
			throw new Error("Expected invalid JSON error");
		}
		expect(invalidJsonError.eventId).toBe("e3");

		expect(received[3]).toEqual({ foo: 3 });

		const olderEventError2 = received[4];
		if (!NostrStorageOlderEventIgnoredError.is(olderEventError2)) {
			throw new Error("Expected older event error");
		}
		expect(olderEventError2.eventId).toBe("e5");
		expect(olderEventError2.createdAt).toBe(0);
		expect(olderEventError2.latestCreatedAt).toBe(10);

		handlers?.onEose?.();
		const subscription = await readyPromise;
		if (NostrStorageSubscriptionClosedBeforeReadyError.is(subscription)) {
			throw subscription;
		}

		subscription.close();
		expect(stopCalls).toBe(1);
	});

	it("resolves errore value when subscription closes before it becomes ready", async () => {
		let handlers: SubscriptionHandlers | undefined;

		const ndk = {
			subscribe: (
				_filter: unknown,
				_opts: unknown,
				callbacks: SubscriptionHandlers,
			) => {
				handlers = callbacks;
				return {
					stop: () => {},
				};
			},
		};

		const storage = createNostrStorage<{ foo: number }>({
			namespace: "prefs",
		});

		const readyPromise = storage.subscribe(
			{ ndk: ndk as never, pubkey: "pubkey123" },
			() => {},
		);

		handlers?.onClose?.();

		const error = await readyPromise;
		if (!NostrStorageSubscriptionClosedBeforeReadyError.is(error)) {
			throw new Error("Expected errore value");
		}
		expect(error._tag).toBe("NostrStorageSubscriptionClosedBeforeReadyError");
		expect(error.message).toBe(
			'Nostr storage "prefs" subscription closed before becoming ready',
		);
	});
});
