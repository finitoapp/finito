import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent, type NDKSigner, NDKUser } from "@nostr-dev-kit/ndk";
import type { JsonValue } from "type-fest";
import { z } from "zod";
import { Uuid7, Uuid7Schema } from "@/lib/types";
import { jsonCodec } from "@/lib/zod/jsonCodec";

const ReqSchema = z.object({
	type: z.literal("req"),
	reqId: Uuid7Schema,
	name: z.string(),
	input: z.unknown(),
	ignoreResponse: z.literal(true).optional(),
});

type Req = z.output<typeof ReqSchema>;

const ResSchema = z.object({
	type: z.literal("res"),
	reqId: Uuid7Schema,
	output: z.unknown(),
});

type Res = z.output<typeof ResSchema>;

type FunctionDef = {
	input: JsonValue;
	output: JsonValue;
};

// const messageBusKind = 4;
const messageBusKind = 23194;

export type NostrMessageBus<TShape extends Record<string, FunctionDef>> = {
	namespace: string;
	$shape: TShape;

	createInstance: (instanceProps: { pubkey: string }) => {
		listen: (
			serverProps: {
				ndk: NDK & {
					signer: NDKSigner;
					activeUser: NDKUser;
				};
			},
			implementations: {
				[key in keyof TShape]: (
					input: TShape[key]["input"],
				) => Promise<TShape[key]["output"]>;
			},
		) => Promise<{
			close: () => void;
		}>;

		getClient: (clientProps: {
			ndk: NDK & {
				signer: NDKSigner;
				activeUser: NDKUser;
			};
		}) => {
			call: <TName extends keyof TShape & string, TIgnore extends boolean>(
				name: TName,
				value: TShape[TName]["input"],
				options?: {
					ignoreResponse: TIgnore;
				},
			) => [TIgnore] extends [true] ? void : Promise<TShape[TName]["output"]>;
		};
	};
};

export const createNostrMessageBus = <
	TShape extends Record<string, FunctionDef>,
>(props: {
	namespace: string;
}) => {
	return {
		namespace: props.namespace,
		$shape: undefined as unknown as TShape,

		createInstance: (instanceProps) => ({
			listen: (serverProps, implementations) => {
				return new Promise((resolve) => {
					const subscription = serverProps.ndk.subscribe(
						{
							kinds: [messageBusKind],
							"#p": [instanceProps.pubkey],
							limit: 0,
						},
						{
							closeOnEose: false,
						},
						{
							onEose: () => {
								resolve({
									close: () => {
										subscription.stop();
									},
								});
							},
							onEvent: async (event) => {
								if (event.tagValue("d") !== props.namespace) {
									return;
								}

								const ndkUser = new NDKUser({
									pubkey: event.pubkey,
								});

								const message = await serverProps.ndk.signer.decrypt(
									ndkUser,
									event.content,
									"nip04",
								);

								const requestData = jsonCodec(ReqSchema).safeDecode(message);
								if (!requestData.success) {
									return;
								}

								const handler = implementations[requestData.data.name];
								if (handler === undefined) {
									return;
								}

								const output = await handler(
									requestData.data.input as TShape[string]["input"],
								);

								if (requestData.data.ignoreResponse) {
									return;
								}

								const responseEvent = new NDKEvent(serverProps.ndk, {
									kind: messageBusKind,
									created_at: Math.floor(Date.now() / 1000),
									tags: [
										["p", event.pubkey],
										["d", props.namespace],
									],
									content: await serverProps.ndk.signer.encrypt(
										ndkUser,
										JSON.stringify({
											type: "res",
											reqId: requestData.data.reqId,
											output,
										} satisfies Res),
										"nip04",
									),
								});

								await responseEvent.publish();
							},
						},
					);
				});
			},

			getClient: (clientProps) => ({
				call: async (name, input, options) => {
					const reqId = Uuid7.random();

					const recipientUser = new NDKUser({
						pubkey: instanceProps.pubkey,
					});

					const event = new NDKEvent(clientProps.ndk, {
						kind: messageBusKind,
						created_at: Math.floor(Date.now() / 1000),
						tags: [
							["p", instanceProps.pubkey],
							["d", props.namespace],
						],
						content: await clientProps.ndk.signer.encrypt(
							recipientUser,
							JSON.stringify({
								type: "req",
								reqId,
								name,
								input,
								...(options && options.ignoreResponse
									? { ignoreResponse: true }
									: {}),
							} satisfies Req),
							"nip04",
						),
					});

					if (options && options.ignoreResponse) {
						void event.publish();
						return;
					}

					return new Promise((resolve) => {
						const subscription = clientProps.ndk.subscribe(
							{
								kinds: [messageBusKind],
								"#p": [clientProps.ndk.signer.pubkey],
								limit: 0,
							},
							{},
							{
								onEvent: async (event) => {
									if (event.tagValue("d") !== props.namespace) {
										return;
									}

									const ndkUser = new NDKUser({
										pubkey: event.pubkey,
									});

									const message = await clientProps.ndk.signer.decrypt(
										ndkUser,
										event.content,
										"nip04",
									);

									const requestData = jsonCodec(ResSchema).safeDecode(message);
									if (!requestData.success) {
										return;
									}

									if (requestData.data.reqId !== reqId) {
										return;
									}

									subscription.stop();
									resolve(requestData.data.output as TShape[string]["output"]);
								},
							},
						);

						event.publish();
					});
				},
			}),
		}),
	} as NostrMessageBus<TShape>;
};
