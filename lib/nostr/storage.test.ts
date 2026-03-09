import { describe, expect, it } from "bun:test";
import { ok } from "@evolu/common";
import type { JsonValue } from "type-fest";
import {
	createNostrStorage,
	type NostrStorageEventResult,
} from "@/lib/nostr/storage";

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
		const received: Array<NostrStorageEventResult<JsonValue>> = [];

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
		expect(received[0]).toEqual(ok({ foo: 1 }));

		const olderEventError1 = received[1];
		if (
			!olderEventError1 ||
			olderEventError1.ok ||
			olderEventError1.error.type !== "NostrStorageOlderEventIgnoredError"
		) {
			throw new Error("Expected older event error");
		}
		expect(olderEventError1.error.eventId).toBe("e2");
		expect(olderEventError1.error.createdAt).toBe(9);
		expect(olderEventError1.error.latestCreatedAt).toBe(10);

		const invalidJsonError = received[2];
		if (
			!invalidJsonError ||
			invalidJsonError.ok ||
			invalidJsonError.error.type !== "NostrStorageInvalidJsonEventError"
		) {
			throw new Error("Expected invalid JSON error");
		}
		expect(invalidJsonError.error.eventId).toBe("e3");

		expect(received[3]).toEqual({
			ok: true,
			value: { foo: 3 },
		});

		const olderEventError2 = received[4];
		if (
			!olderEventError2 ||
			olderEventError2.ok ||
			olderEventError2.error.type !== "NostrStorageOlderEventIgnoredError"
		) {
			throw new Error("Expected older event error");
		}
		expect(olderEventError2.error.eventId).toBe("e5");
		expect(olderEventError2.error.createdAt).toBe(0);
		expect(olderEventError2.error.latestCreatedAt).toBe(10);

		handlers?.onEose?.();
		const subscription = await readyPromise;
		if (!subscription.ok) {
			throw subscription.error;
		}

		subscription.value.close();
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
		if (error.ok) {
			throw new Error("Expected error value");
		}
		expect(error.error).toEqual({
			type: "NostrStorageSubscriptionClosedBeforeReadyError",
			namespace: "prefs",
		});
	});
});
