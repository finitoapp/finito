import { beforeEach, describe, expect, it, mock } from "bun:test";
import * as errore from "errore";

type MockPublishedEvent = {
	ndk: unknown;
	kind: number;
	created_at: number;
	tags: string[][];
	content: string;
	published: boolean;
};

let publishedEvents: MockPublishedEvent[] = [];
let nextPublishError: undefined | Error;

class MockNDKEvent {
	public kind: number;
	public created_at: number;
	public tags: string[][];
	public content: string;
	private ndk: unknown;

	public constructor(
		ndk: unknown,
		event: {
			kind: number;
			created_at: number;
			tags: string[][];
			content: string;
		},
	) {
		this.ndk = ndk;
		this.kind = event.kind;
		this.created_at = event.created_at;
		this.tags = event.tags;
		this.content = event.content;
	}

	public async publish() {
		if (nextPublishError) {
			const error = nextPublishError;
			nextPublishError = undefined;
			throw error;
		}

		publishedEvents.push({
			ndk: this.ndk,
			kind: this.kind,
			created_at: this.created_at,
			tags: this.tags,
			content: this.content,
			published: true,
		});
	}
}

class MockNDKUser {
	public pubkey: string;

	public constructor(props: { pubkey: string }) {
		this.pubkey = props.pubkey;
	}
}

mock.module("@nostr-dev-kit/ndk", () => ({
	NDKEvent: MockNDKEvent,
	NDKUser: MockNDKUser,
}));

const messageBusModule = await import("@/lib/nostr-message-bus");

const {
	createNostrMessageBus,
	RpcCallNonJsonRequestPayloadError,
	RpcClientListenerClosedBeforeReadyError,
	RpcListenerClosedBeforeReadyError,
	RpcPublishRequestFailedError,
	RpcRemoteError,
} = messageBusModule;

type SubscribeHandlers = {
	onEose?: () => void;
	onClose?: () => void;
	onEvent?: (event: { pubkey: string; content: string }) => void;
};

type SubscribeCall = {
	filter: Record<string, unknown>;
	opts: Record<string, unknown>;
	handlers: SubscribeHandlers;
	stopCalls: number;
	stop: () => void;
};

const createFakeNdk = () => {
	const subscribeCalls: SubscribeCall[] = [];

	const ndk = {
		activeUser: {
			pubkey: "local-pubkey",
		},
		signer: {
			pubkey: "local-pubkey",
			encrypt: async (_recipient: unknown, plaintext: string) => plaintext,
			decrypt: async (_sender: unknown, ciphertext: string) => ciphertext,
		},
		subscribe: (
			filter: Record<string, unknown>,
			opts: Record<string, unknown>,
			handlers: SubscribeHandlers,
		) => {
			const call: SubscribeCall = {
				filter,
				opts,
				handlers,
				stopCalls: 0,
				stop() {
					call.stopCalls += 1;
				},
			};
			subscribeCalls.push(call);
			return {
				stop: () => {
					call.stop();
				},
			};
		},
	};

	return {
		ndk,
		subscribeCalls,
	};
};

const createTestBus = () =>
	createNostrMessageBus<{
		ping: {
			input: { n: number };
			output: { ok: number };
		};
	}>({
		namespace: "test-bus",
	});

const parsePublishedRpcMessage = (index = -1) => {
	const event =
		index === -1
			? publishedEvents[publishedEvents.length - 1]
			: publishedEvents[index];
	if (!event) {
		throw new Error("No published event");
	}

	return JSON.parse(event.content) as {
		version: 1;
		namespace: string;
		type: "rpc_request" | "rpc_result" | "rpc_error";
		reqId: string;
		method?: string;
		payload?: unknown;
		error?: string;
		ignoreResponse?: true;
	};
};

const waitForPublishedEvent = async () => {
	for (let i = 0; i < 20; i += 1) {
		if (publishedEvents.length > 0) {
			return;
		}

		await Promise.resolve();
	}

	throw new Error("Timed out waiting for published event");
};

describe("createNostrMessageBus", () => {
	beforeEach(() => {
		publishedEvents = [];
		nextPublishError = undefined;
	});

	it("listen resolves ready listener on EOSE and close stops subscription", async () => {
		const { ndk, subscribeCalls } = createFakeNdk();
		const bus = createTestBus();

		const listenPromise = bus.createInstance({ ndk: ndk as never }).listen({
			ping: async () => ({ ok: 1 }),
		});

		expect(subscribeCalls).toHaveLength(1);
		expect(subscribeCalls[0]?.filter).toEqual({
			kinds: [23195],
			"#p": ["local-pubkey"],
			"#d": ["test-bus"],
			limit: 0,
		});
		expect(subscribeCalls[0]?.opts).toEqual({
			closeOnEose: false,
		});

		subscribeCalls[0]?.handlers.onEose?.();
		const result = errore.unwrap(await listenPromise);

		result.close();
		expect(subscribeCalls[0]?.stopCalls).toBe(1);
	});

	it("listen resolves errore when listener closes before ready", async () => {
		const { ndk, subscribeCalls } = createFakeNdk();
		const bus = createTestBus();

		const listenPromise = bus.createInstance({ ndk: ndk as never }).listen({
			ping: async () => ({ ok: 1 }),
		});

		subscribeCalls[0]?.handlers.onClose?.();
		const result = await listenPromise;

		if (!RpcListenerClosedBeforeReadyError.is(result)) {
			throw new Error("Expected RpcListenerClosedBeforeReadyError");
		}
		expect(result.namespace).toBe("test-bus");
	});

	it("call returns errore for non-JSON request payload", async () => {
		const { ndk } = createFakeNdk();
		const bus = createTestBus();
		const client = bus
			.createInstance({ ndk: ndk as never })
			.getClient({ recipientPubkey: "remote-pubkey" });

		const result = await client.call("ping", { n: (() => 1) as never });

		if (!RpcCallNonJsonRequestPayloadError.is(result)) {
			throw new Error("Expected RpcCallNonJsonRequestPayloadError");
		}
		expect(result.method).toBe("ping");
	});

	it("call resolves errore when client listener closes before ready", async () => {
		const { ndk, subscribeCalls } = createFakeNdk();
		const bus = createTestBus();
		const client = bus
			.createInstance({ ndk: ndk as never })
			.getClient({ recipientPubkey: "remote-pubkey" });

		const callPromise = client.call("ping", { n: 1 });

		expect(subscribeCalls).toHaveLength(1);
		subscribeCalls[0]?.handlers.onClose?.();

		const result = await callPromise;
		if (!RpcClientListenerClosedBeforeReadyError.is(result)) {
			throw new Error("Expected RpcClientListenerClosedBeforeReadyError");
		}
		expect(result.namespace).toBe("test-bus");
	});

	it("call resolves payload for rpc_result response", async () => {
		const { ndk, subscribeCalls } = createFakeNdk();
		const bus = createTestBus();
		const client = bus
			.createInstance({ ndk: ndk as never })
			.getClient({ recipientPubkey: "remote-pubkey" });

		const callPromise = client.call("ping", { n: 3 });

		expect(subscribeCalls).toHaveLength(1);
		subscribeCalls[0]?.handlers.onEose?.();
		await waitForPublishedEvent();

		const requestMessage = parsePublishedRpcMessage();
		expect(requestMessage.type).toBe("rpc_request");
		expect(requestMessage.namespace).toBe("test-bus");
		expect(requestMessage.method).toBe("ping");
		expect(requestMessage.payload).toEqual({ n: 3 });

		subscribeCalls[0]?.handlers.onEvent?.({
			pubkey: "remote-pubkey",
			content: JSON.stringify({
				version: 1,
				namespace: "test-bus",
				type: "rpc_result",
				reqId: requestMessage.reqId,
				payload: { ok: 42 },
			}),
		});

		const result = await callPromise;
		expect(result).toEqual({ ok: 42 });
	});

	it("call resolves RpcRemoteError for rpc_error response", async () => {
		const { ndk, subscribeCalls } = createFakeNdk();
		const bus = createTestBus();
		const client = bus
			.createInstance({ ndk: ndk as never })
			.getClient({ recipientPubkey: "remote-pubkey" });

		const callPromise = client.call("ping", { n: 5 });

		subscribeCalls[0]?.handlers.onEose?.();
		await waitForPublishedEvent();
		const requestMessage = parsePublishedRpcMessage();

		subscribeCalls[0]?.handlers.onEvent?.({
			pubkey: "remote-pubkey",
			content: JSON.stringify({
				version: 1,
				namespace: "test-bus",
				type: "rpc_error",
				reqId: requestMessage.reqId,
				error: "boom",
			}),
		});

		const result = await callPromise;
		if (!RpcRemoteError.is(result)) {
			throw new Error("Expected RpcRemoteError");
		}
		expect(result.method).toBe("ping");
		expect(result.remoteError).toBe("boom");
	});

	it("call(ignoreResponse) resolves RpcPublishRequestFailedError on publish failure", async () => {
		const { ndk } = createFakeNdk();
		const bus = createTestBus();
		const client = bus
			.createInstance({ ndk: ndk as never })
			.getClient({ recipientPubkey: "remote-pubkey" });

		nextPublishError = new Error("publish failed");
		const result = await client.call(
			"ping",
			{ n: 1 },
			{ ignoreResponse: true },
		);

		expect(RpcPublishRequestFailedError.is(result)).toBeTrue();
		if (!RpcPublishRequestFailedError.is(result)) {
			throw new Error("Expected RpcPublishRequestFailedError");
		}
		expect(result.method).toBe("ping");
	});
});
