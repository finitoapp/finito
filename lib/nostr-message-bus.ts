import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent, type NDKSigner, NDKUser } from "@nostr-dev-kit/ndk";
import * as errore from "errore";
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

export class RpcListenerClosedBeforeReadyError extends errore.createTaggedError(
	{
		name: "RpcListenerClosedBeforeReadyError",
		message: 'RPC listener "$namespace" closed before becoming ready',
	},
) {}

export class RpcListenerReadyTimeoutError extends errore.createTaggedError({
	name: "RpcListenerReadyTimeoutError",
	message: 'Timeout while waiting for RPC listener "$namespace" readiness',
}) {}

export class RpcMethodReturnedNonJsonPayloadError extends errore.createTaggedError(
	{
		name: "RpcMethodReturnedNonJsonPayloadError",
		message: 'RPC method "$method" returned non-JSON payload',
	},
) {}

export class RpcClientListenerClosedBeforeReadyError extends errore.createTaggedError(
	{
		name: "RpcClientListenerClosedBeforeReadyError",
		message: 'RPC client listener "$namespace" closed before becoming ready',
	},
) {}

export class RpcClientListenerClosedError extends errore.createTaggedError({
	name: "RpcClientListenerClosedError",
	message: 'RPC client listener "$namespace" was closed',
}) {}

export class RpcClientListenerReadyTimeoutError extends errore.createTaggedError(
	{
		name: "RpcClientListenerReadyTimeoutError",
		message:
			'Timeout while waiting for RPC client listener "$namespace" readiness',
	},
) {}

export class RpcRemoteError extends errore.createTaggedError({
	name: "RpcRemoteError",
	message: 'RPC "$method" failed: $remoteError',
}) {}

export class RpcCallNonJsonRequestPayloadError extends errore.createTaggedError(
	{
		name: "RpcCallNonJsonRequestPayloadError",
		message: 'RPC call "$method" contains non-JSON request payload',
	},
) {}

export class RpcResponseTimeoutError extends errore.createTaggedError({
	name: "RpcResponseTimeoutError",
	message: 'Timeout while waiting for RPC response "$method"',
}) {}

export class RpcPublishRequestFailedError extends errore.createTaggedError({
	name: "RpcPublishRequestFailedError",
	message: 'Failed to publish RPC request "$method"',
}) {}

type BusNdk = NDK & {
	signer: NDKSigner;
	activeUser: NDKUser;
};

type Stoppable = {
	stop: () => void;
};

export type NostrMessageBusListener = {
	close: () => void;
};

export type NostrMessageBusListenError =
	| RpcListenerClosedBeforeReadyError
	| RpcListenerReadyTimeoutError;

export type NostrMessageBusListenResult =
	| NostrMessageBusListener
	| NostrMessageBusListenError;

export type NostrMessageBusCallError =
	| RpcClientListenerClosedBeforeReadyError
	| RpcClientListenerClosedError
	| RpcClientListenerReadyTimeoutError
	| RpcRemoteError
	| RpcCallNonJsonRequestPayloadError
	| RpcResponseTimeoutError
	| RpcPublishRequestFailedError;

export type NostrMessageBusCallResult<TValue extends JsonValue> =
	| TValue
	| NostrMessageBusCallError;

type PendingCall = {
	method: string;
	timeout: ReturnType<typeof setTimeout>;
	resolve: (result: NostrMessageBusCallResult<JsonValue>) => void;
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
		) => Promise<NostrMessageBusListenResult>;

		getClient: (clientProps: { recipientPubkey: string }) => {
			call: {
				<TName extends keyof TShape & string>(
					name: TName,
					value: TShape[TName]["input"],
					options: {
						ignoreResponse: true;
					},
				): Promise<undefined | NostrMessageBusCallError>;
				<TName extends keyof TShape & string>(
					name: TName,
					value: TShape[TName]["input"],
					options?: {
						ignoreResponse?: false;
					},
				): Promise<TShape[TName]["output"] | NostrMessageBusCallError>;
			};
		};
	};
};

// RPC protocol behavior and wire format are documented in docs/nostr-rpc-nip-draft.md.
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
				return new Promise<NostrMessageBusListenResult>((resolve) => {
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
								resolve(
									new RpcListenerClosedBeforeReadyError({
										namespace: props.namespace,
									}),
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
									const output = await errore.tryAsync(() =>
										handler(message.payload as TShape[keyof TShape]["input"]),
									);
									if (errore.isError(output)) {
										console.error(
											`RPC listener "${props.namespace}" failed in method "${message.method}"`,
											output,
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
												error: getErrorMessage(output),
											} satisfies RpcError,
										});
										return;
									}

									const parsedOutput = JsonValueSchema.safeParse(output);
									if (!parsedOutput.success) {
										const nonJsonError =
											new RpcMethodReturnedNonJsonPayloadError({
												method: message.method,
											});
										console.error(
											`RPC listener "${props.namespace}" failed in method "${message.method}"`,
											nonJsonError,
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
												error: getErrorMessage(nonJsonError),
											} satisfies RpcError,
										});
										return;
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
						resolve(
							new RpcListenerReadyTimeoutError({
								namespace: props.namespace,
							}),
						);
					}, listenerReadyTimeoutMs);
				});
			},

			getClient: (clientProps) => {
				let responseSubscription: Stoppable | undefined;
				let responseReadyPromise:
					| Promise<
							| undefined
							| RpcClientListenerClosedBeforeReadyError
							| RpcClientListenerReadyTimeoutError
					  >
					| undefined;
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

				const resolveAllPendingCalls = (error: NostrMessageBusCallError) => {
					for (const reqId of pendingCalls.keys()) {
						const pendingCall = clearPendingCall(reqId);
						pendingCall?.resolve(error);
					}
				};

				const ensureResponseListener = async () => {
					if (responseReadyPromise) {
						return responseReadyPromise;
					}

					responseReadyPromise = new Promise<
						| undefined
						| RpcClientListenerClosedBeforeReadyError
						| RpcClientListenerReadyTimeoutError
					>((resolve) => {
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
							resolve(undefined);
						};

						const resolveErrorOnce = (
							error:
								| RpcClientListenerClosedBeforeReadyError
								| RpcClientListenerReadyTimeoutError,
						) => {
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
							resolve(error);
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
										resolveErrorOnce(
											new RpcClientListenerClosedBeforeReadyError({
												namespace: props.namespace,
											}),
										);
										return;
									}

									responseSubscription = undefined;
									responseReadyPromise = undefined;
									resolveAllPendingCalls(
										new RpcClientListenerClosedError({
											namespace: props.namespace,
										}),
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

										pendingCall.resolve(
											new RpcRemoteError({
												method: pendingCall.method,
												remoteError: message.error,
											}),
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
							resolveErrorOnce(
								new RpcClientListenerReadyTimeoutError({
									namespace: props.namespace,
								}),
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
				): Promise<undefined | NostrMessageBusCallError>;
				function call<TName extends keyof TShape & string>(
					name: TName,
					input: TShape[TName]["input"],
					options?: {
						ignoreResponse?: false;
					},
				): Promise<TShape[TName]["output"] | NostrMessageBusCallError>;
				async function call<TName extends keyof TShape & string>(
					name: TName,
					input: TShape[TName]["input"],
					options?: {
						ignoreResponse?: boolean;
					},
				): Promise<
					TShape[TName]["output"] | undefined | NostrMessageBusCallError
				> {
					const parsedInput = JsonValueSchema.safeParse(input);
					if (!parsedInput.success) {
						return new RpcCallNonJsonRequestPayloadError({
							method: name,
						});
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
						const publishResult = await errore.tryAsync({
							try: () =>
								publishEncrypted({
									ndk: instanceProps.ndk,
									recipientPubkey: clientProps.recipientPubkey,
									namespace: props.namespace,
									reqId,
									method: name,
									payload: requestMessage,
								}),
							catch: (cause) =>
								new RpcPublishRequestFailedError({
									method: name,
									cause,
								}),
						});
						if (errore.isError(publishResult)) {
							return publishResult;
						}
						return undefined;
					}

					const listenerReadyResult = await ensureResponseListener();
					if (errore.isError(listenerReadyResult)) {
						return listenerReadyResult;
					}

					return new Promise<
						TShape[TName]["output"] | NostrMessageBusCallError
					>((resolve) => {
						const timeout = setTimeout(() => {
							clearPendingCall(reqId);
							resolve(
								new RpcResponseTimeoutError({
									method: name,
								}),
							);
						}, responseTimeoutMs);

						pendingCalls.set(reqId, {
							method: name,
							timeout,
							resolve: (result) => {
								resolve(
									result as TShape[TName]["output"] | NostrMessageBusCallError,
								);
							},
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
							pendingCall.resolve(
								new RpcPublishRequestFailedError({
									method: name,
									cause: error,
								}),
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
