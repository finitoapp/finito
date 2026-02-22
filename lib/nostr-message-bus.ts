import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent, type NDKSigner, NDKUser } from "@nostr-dev-kit/ndk";
import type { JsonValue } from "type-fest";
import { z } from "zod";
import { Uuid7, Uuid7Schema } from "@/lib/types";
import { jsonCodec } from "@/lib/zod/jsonCodec";

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
	z.union([
		z.string(),
		z.number(),
		z.boolean(),
		z.null(),
		z.array(JsonValueSchema),
		z.record(z.string(), JsonValueSchema),
	]),
);

export type FunctionDef = {
	input: JsonValue;
	output: JsonValue;
};

const RpcRequestSchema = z.object({
	version: z.literal(1),
	namespace: z.string(),
	type: z.literal("rpc_request"),
	reqId: Uuid7Schema,
	method: z.string(),
	payload: JsonValueSchema,
	ignoreResponse: z.literal(true).optional(),
});

type RpcRequest = z.output<typeof RpcRequestSchema>;

const RpcResultSchema = z.object({
	version: z.literal(1),
	namespace: z.string(),
	type: z.literal("rpc_result"),
	reqId: Uuid7Schema,
	payload: JsonValueSchema,
});

type RpcResult = z.output<typeof RpcResultSchema>;

const RpcErrorSchema = z.object({
	version: z.literal(1),
	namespace: z.string(),
	type: z.literal("rpc_error"),
	reqId: Uuid7Schema,
	error: z.string(),
});

type RpcError = z.output<typeof RpcErrorSchema>;

const RpcMessageSchema = z.union([
	RpcRequestSchema,
	RpcResultSchema,
	RpcErrorSchema,
]);
type RpcMessage = z.output<typeof RpcMessageSchema>;

const messageBusKind = 23195;
// const messageBusKind = 4;
const listenerReadyTimeoutMs = 10_000;
const responseTimeoutMs = 12_000;
const processedRequestCacheSize = 1024;

type BusNdk = NDK & {
	signer: NDKSigner;
	activeUser: NDKUser;
};

type Stoppable = {
	stop: () => void;
};

type PendingCall = {
	method: string;
	timeout: ReturnType<typeof setTimeout>;
	resolve: (output: JsonValue) => void;
	reject: (error: Error) => void;
};

const getErrorMessage = (error: unknown): string => {
	if (error instanceof Error) {
		return error.message;
	}

	return "Unknown error";
};

const publishEncrypted = async (props: {
	ndk: BusNdk;
	recipientPubkey: string;
	namespace: string;
	reqId: string;
	payload: RpcMessage;
	method?: string;
}) => {
	const recipient = new NDKUser({
		pubkey: props.recipientPubkey,
	});
	const tags = [
		["p", props.recipientPubkey],
		["d", props.namespace],
		["q", props.reqId],
	];
	if (props.method) {
		tags.push(["m", props.method]);
	}

	const event = new NDKEvent(props.ndk, {
		kind: messageBusKind,
		created_at: Math.floor(Date.now() / 1000),
		tags,
		content: await props.ndk.signer.encrypt(
			recipient,
			JSON.stringify(props.payload),
			"nip04",
		),
	});

	await event.publish();
};

export type NostrMessageBus<TShape extends Record<string, FunctionDef>> = {
	namespace: string;
	$shape: TShape;

	createInstance: (instanceProps: {
		ndk: NDK & {
			signer: NDKSigner;
			activeUser: NDKUser;
		};
	}) => {
		listen: (
			implementations: {
				[key in keyof TShape]: (
					input: TShape[key]["input"],
				) => Promise<TShape[key]["output"]>;
			},
		) => Promise<{
			close: () => void;
		}>;

		getClient: (clientProps: { recipientPubkey: string }) => {
			call: {
				<TName extends keyof TShape & string>(
					name: TName,
					value: TShape[TName]["input"],
					options: {
						ignoreResponse: true;
					},
				): Promise<undefined>;
				<TName extends keyof TShape & string>(
					name: TName,
					value: TShape[TName]["input"],
					options?: {
						ignoreResponse?: false;
					},
				): Promise<TShape[TName]["output"]>;
			};
		};
	};
};

export const createNostrMessageBus = <
	TShape extends Record<string, FunctionDef>,
>(props: {
	namespace: string;
}): NostrMessageBus<TShape> => {
	return {
		namespace: props.namespace,
		$shape: undefined as unknown as TShape,

		createInstance: (instanceProps) => ({
			listen: (implementations) => {
				return new Promise((resolve, reject) => {
					const handledRequestIds = new Set<string>();
					const requestOrder: string[] = [];
					let settled = false;
					let readyTimeout: ReturnType<typeof setTimeout> | undefined;

					const rememberRequestId = (reqId: string): boolean => {
						if (handledRequestIds.has(reqId)) {
							return false;
						}

						handledRequestIds.add(reqId);
						requestOrder.push(reqId);
						if (requestOrder.length > processedRequestCacheSize) {
							const oldestReqId = requestOrder.shift();
							if (oldestReqId) {
								handledRequestIds.delete(oldestReqId);
							}
						}

						return true;
					};

					const subscription = instanceProps.ndk.subscribe(
						{
							kinds: [messageBusKind],
							"#p": [instanceProps.ndk.activeUser.pubkey],
							"#d": [props.namespace],
							limit: 0,
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
								if (readyTimeout) {
									clearTimeout(readyTimeout);
								}
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
								if (readyTimeout) {
									clearTimeout(readyTimeout);
								}
								reject(
									new Error(
										`RPC listener "${props.namespace}" closed before becoming ready`,
									),
								);
							},
							onEvent: (event) => {
								void (async () => {
									const sender = new NDKUser({
										pubkey: event.pubkey,
									});

									const decrypted = await instanceProps.ndk.signer.decrypt(
										sender,
										event.content,
										"nip04",
									);
									const parsed =
										jsonCodec(RpcMessageSchema).safeDecode(decrypted);
									if (!parsed.success || parsed.data.type !== "rpc_request") {
										return;
									}

									const message = parsed.data;
									if (message.namespace !== props.namespace) {
										return;
									}

									if (!rememberRequestId(message.reqId)) {
										return;
									}

									if (!Object.hasOwn(implementations, message.method)) {
										if (message.ignoreResponse) {
											return;
										}

										await publishEncrypted({
											ndk: instanceProps.ndk,
											recipientPubkey: event.pubkey,
											namespace: props.namespace,
											reqId: message.reqId,
											payload: {
												version: 1,
												namespace: props.namespace,
												type: "rpc_error",
												reqId: message.reqId,
												error: `Unknown RPC method "${message.method}"`,
											} satisfies RpcError,
										});
										return;
									}

									const handler =
										implementations[message.method as keyof TShape];
									try {
										const output = await handler(
											message.payload as TShape[keyof TShape]["input"],
										);
										const parsedOutput = JsonValueSchema.safeParse(output);
										if (!parsedOutput.success) {
											throw new Error(
												`RPC method "${message.method}" returned non-JSON payload`,
											);
										}

										if (message.ignoreResponse) {
											return;
										}

										await publishEncrypted({
											ndk: instanceProps.ndk,
											recipientPubkey: event.pubkey,
											namespace: props.namespace,
											reqId: message.reqId,
											method: message.method,
											payload: {
												version: 1,
												namespace: props.namespace,
												type: "rpc_result",
												reqId: message.reqId,
												payload: parsedOutput.data,
											} satisfies RpcResult,
										});
									} catch (error) {
										console.error(
											`RPC listener "${props.namespace}" failed in method "${message.method}"`,
											error,
										);

										if (message.ignoreResponse) {
											return;
										}

										await publishEncrypted({
											ndk: instanceProps.ndk,
											recipientPubkey: event.pubkey,
											namespace: props.namespace,
											reqId: message.reqId,
											method: message.method,
											payload: {
												version: 1,
												namespace: props.namespace,
												type: "rpc_error",
												reqId: message.reqId,
												error: getErrorMessage(error),
											} satisfies RpcError,
										});
									}
								})().catch((error) => {
									console.error(
										`RPC listener "${props.namespace}" failed to process event`,
										error,
									);
								});
							},
						},
					);

					readyTimeout = setTimeout(() => {
						if (settled) {
							return;
						}
						settled = true;
						subscription.stop();
						reject(
							new Error(
								`Timeout while waiting for RPC listener "${props.namespace}" readiness`,
							),
						);
					}, listenerReadyTimeoutMs);
				});
			},

			getClient: (clientProps) => {
				let responseSubscription: Stoppable | undefined;
				let responseReadyPromise: Promise<void> | undefined;
				const pendingCalls = new Map<string, PendingCall>();

				const clearPendingCall = (reqId: string) => {
					const pendingCall = pendingCalls.get(reqId);
					if (!pendingCall) {
						return undefined;
					}

					pendingCalls.delete(reqId);
					clearTimeout(pendingCall.timeout);
					return pendingCall;
				};

				const rejectAllPendingCalls = (error: Error) => {
					for (const reqId of pendingCalls.keys()) {
						const pendingCall = clearPendingCall(reqId);
						pendingCall?.reject(error);
					}
				};

				const ensureResponseListener = async () => {
					if (responseReadyPromise) {
						return responseReadyPromise;
					}

					responseReadyPromise = new Promise<void>((resolve, reject) => {
						let settled = false;
						let readyTimeout: ReturnType<typeof setTimeout> | undefined;

						const resolveOnce = () => {
							if (settled) {
								return;
							}
							settled = true;
							if (readyTimeout) {
								clearTimeout(readyTimeout);
							}
							resolve();
						};

						const rejectOnce = (error: Error) => {
							if (settled) {
								return;
							}
							settled = true;
							if (readyTimeout) {
								clearTimeout(readyTimeout);
							}
							responseSubscription?.stop();
							responseSubscription = undefined;
							responseReadyPromise = undefined;
							reject(error);
						};

						const subscription = instanceProps.ndk.subscribe(
							{
								kinds: [messageBusKind],
								"#p": [instanceProps.ndk.activeUser.pubkey],
								"#d": [props.namespace],
								limit: 0,
							},
							{
								closeOnEose: false,
							},
							{
								onEose: () => {
									resolveOnce();
								},
								onClose: () => {
									if (!settled) {
										rejectOnce(
											new Error(
												`RPC client listener "${props.namespace}" closed before becoming ready`,
											),
										);
										return;
									}

									responseSubscription = undefined;
									responseReadyPromise = undefined;
									rejectAllPendingCalls(
										new Error(
											`RPC client listener "${props.namespace}" was closed`,
										),
									);
								},
								onEvent: (event) => {
									void (async () => {
										// console.log("new", await event.toNostrEvent());
										if (event.pubkey !== clientProps.recipientPubkey) {
											return;
										}

										const sender = new NDKUser({
											pubkey: event.pubkey,
										});

										const decrypted = await instanceProps.ndk.signer.decrypt(
											sender,
											event.content,
											"nip04",
										);
										const parsed =
											jsonCodec(RpcMessageSchema).safeDecode(decrypted);
										if (!parsed.success) {
											return;
										}

										const message = parsed.data;
										if (message.namespace !== props.namespace) {
											return;
										}

										if (message.type === "rpc_request") {
											return;
										}

										const pendingCall = clearPendingCall(message.reqId);
										if (!pendingCall) {
											return;
										}

										if (message.type === "rpc_result") {
											pendingCall.resolve(message.payload);
											return;
										}

										pendingCall.reject(
											new Error(
												`RPC "${pendingCall.method}" failed: ${message.error}`,
											),
										);
									})().catch((error) => {
										console.error(
											`RPC client "${props.namespace}" failed to process response`,
											error,
										);
									});
								},
							},
						);

						responseSubscription = subscription;
						readyTimeout = setTimeout(() => {
							rejectOnce(
								new Error(
									`Timeout while waiting for RPC client listener "${props.namespace}" readiness`,
								),
							);
						}, listenerReadyTimeoutMs);
					});

					return responseReadyPromise;
				};

				function call<TName extends keyof TShape & string>(
					name: TName,
					input: TShape[TName]["input"],
					options: {
						ignoreResponse: true;
					},
				): Promise<undefined>;
				function call<TName extends keyof TShape & string>(
					name: TName,
					input: TShape[TName]["input"],
					options?: {
						ignoreResponse?: false;
					},
				): Promise<TShape[TName]["output"]>;
				async function call<TName extends keyof TShape & string>(
					name: TName,
					input: TShape[TName]["input"],
					options?: {
						ignoreResponse?: boolean;
					},
				): Promise<TShape[TName]["output"] | undefined> {
					const parsedInput = JsonValueSchema.safeParse(input);
					if (!parsedInput.success) {
						throw new Error(
							`RPC call "${name}" contains non-JSON request payload`,
						);
					}

					const reqId = Uuid7.random();
					const requestMessage = {
						version: 1,
						namespace: props.namespace,
						type: "rpc_request",
						reqId,
						method: name,
						payload: parsedInput.data,
						...(options?.ignoreResponse ? { ignoreResponse: true } : {}),
					} satisfies RpcRequest;

					if (options?.ignoreResponse) {
						await publishEncrypted({
							ndk: instanceProps.ndk,
							recipientPubkey: clientProps.recipientPubkey,
							namespace: props.namespace,
							reqId,
							method: name,
							payload: requestMessage,
						});
						return undefined;
					}

					await ensureResponseListener();

					return new Promise<TShape[TName]["output"]>((resolve, reject) => {
						const timeout = setTimeout(() => {
							clearPendingCall(reqId);
							reject(
								new Error(`Timeout while waiting for RPC response "${name}"`),
							);
						}, responseTimeoutMs);

						pendingCalls.set(reqId, {
							method: name,
							timeout,
							resolve: (output) => {
								resolve(output as TShape[TName]["output"]);
							},
							reject,
						});

						void publishEncrypted({
							ndk: instanceProps.ndk,
							recipientPubkey: clientProps.recipientPubkey,
							namespace: props.namespace,
							reqId,
							method: name,
							payload: requestMessage,
						}).catch((error) => {
							const pendingCall = clearPendingCall(reqId);
							if (!pendingCall) {
								return;
							}
							console.error(`Failed to publish RPC request "${name}"`, error);
							pendingCall.reject(
								new Error(`Failed to publish RPC request "${name}"`),
							);
						});
					});
				}

				return {
					call,
				};
			},
		}),
	};
};
