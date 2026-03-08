import { SparkWallet } from "@buildonspark/spark-sdk";
import { createIdFromString, type Id, sqliteTrue } from "@evolu/common";
import NDK, {
	NDKEvent,
	NDKPrivateKeySigner,
	type NDKSigner,
	type NDKUser,
} from "@nostr-dev-kit/ndk";
import { bech32 } from "@scure/base";
import type { NotNull } from "kysely";
import { createQuery, type Evolu, type EvoluSchemaType } from "@/lib/evolu";
import type { PaymentWatchingStopReason } from "@/lib/evolu/model/payment-watching-state";
import {
	type Email,
	Integer,
	NonEmptyString,
	type NonNegativeInteger,
} from "@/lib/shared/types";
import { lazy } from "@/lib/shared/utils/lazy";
import {
	extractExpirationFromLightningInvoice,
	extractPaymentHashFromLnInvoice,
} from "@/lib/shared/utils/ln";

export async function createZapPayment(params: {
	lud16: Email;
	amountInSats: Integer;
	ndk: NDK & {
		signer: NDKSigner;
		activeUser: NDKUser;
	};
	paymentNdk: NDK & {
		signer: NDKSigner;
		activeUser: NDKUser;
	};
}) {
	const [username, domain] = params.lud16.split("@");
	const httpUrl = `https://${domain}/.well-known/lnurlp/${username}`;
	const lnurlResult = await fetch(httpUrl).then((result) => result.json());

	const lnurl = bech32.encode(
		"lnurl",
		bech32.toWords(Buffer.from(httpUrl, "utf8")),
		108,
	);
	console.log("lnurl", lnurl);

	const amountInMilliSats = (params.amountInSats * 1000).toFixed(0);

	const zapRequestEvent = new NDKEvent(params.paymentNdk, {
		kind: 9734,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			["relays", ...params.ndk.explicitRelayUrls], // List of relays for the zap receipt
			["amount", amountInMilliSats], // Amount in millisatoshis
			["lnurl", lnurl], // Recipient’s LNURL
			["p", params.paymentNdk.activeUser.pubkey], // Recipient’s public key
		],
		content: "Zap!",
	});

	await zapRequestEvent.sign();
	console.log("zapRequestEvent", await zapRequestEvent.toNostrEvent());

	const zapResult = await fetch(
		`${lnurlResult.callback}?amount=${amountInMilliSats}&nostr=${encodeURI(JSON.stringify(await zapRequestEvent.toNostrEvent()))}`,
	).then((result) => result.json());
	console.log("zapResult", zapResult);

	return {
		lnInvoice: zapResult.pr,
		walletPubkey: lnurlResult.nostrPubkey,
	} as const;
}

export async function createOutgoingPayment(params: {
	evolu: Evolu;
	payment: Omit<EvoluSchemaType["payment"], "direction" | "id" | "tipAmount">;
}) {
	params.evolu.insert("payment", {
		...params.payment,
		direction: "outgoing",
	});
}

export async function createPayment(
	params: {
		ndk: NDK & {
			signer: NDKSigner;
			activeUser: NDKUser;
		};
		evolu: Evolu;
		// paymentNdk: NDK & {
		// 	signer: NDKSigner;
		// 	activeUser: NDKUser;
		// };
		// paymentData: StaticOfflinePayment;
		payment: Omit<
			EvoluSchemaType["payment"],
			"direction" | "totalAmount" | "tipAmount"
		>;
		webData?: Omit<
			EvoluSchemaType["paymentWebData"],
			"id" | "privateKey" | "webPaymentEventId"
		>;
		paymentLnZap?: Omit<
			EvoluSchemaType["paymentLnZap"],
			| "id"
			| "expirationIn"
			| "paymentHash"
			| "lnInvoice"
			| "privateKey"
			| "walletPubkey"
		>;
		paymentLnSpark?: Omit<
			EvoluSchemaType["paymentLnSpark"],
			"id" | "expirationIn" | "paymentHash" | "lnInvoice" | "sparkInvoiceId"
		>;
		paymentBankTransferCZ?: Omit<
			EvoluSchemaType["paymentBankTransferCZ"],
			"id"
		>;
		paymentCash?: Omit<EvoluSchemaType["paymentCash"], "id">;
		tipAmount: NonNegativeInteger | null;
	} & (
		| {
				items: {
					line: Omit<EvoluSchemaType["paymentItemLine"], "id" | "paymentId">;
					item: Omit<EvoluSchemaType["paymentItem"], "id" | "paymentId">;
				}[];
				totalAmount?: undefined;
		  }
		| {
				items?: undefined;
				totalAmount: NonNegativeInteger;
		  }
	),
) {
	const id = params.payment.id;

	let webPaymentEventId: NonEmptyString | null = null;

	const getPaymentNdk = lazy(async () => {
		const paymentSigner = NDKPrivateKeySigner.generate();
		const paymentNdk = new NDK({
			explicitRelayUrls: params.ndk.explicitRelayUrls,
			signer: paymentSigner,
		}) as NDK & {
			signer: NDKSigner;
			activeUser: NDKUser;
		};

		await paymentNdk.connect();

		return { paymentNdk, paymentSigner };
	});

	if (params.webData) {
		const { paymentNdk } = await getPaymentNdk();
		const event = new NDKEvent(params.ndk, {
			kind: 4,
			created_at: Math.floor(Date.now() / 1000),
			tags: [
				["p", paymentNdk.activeUser.pubkey],
				["finito_type", "static_payment"],
				["finito_version", "1.1"],
			],
			content: await params.ndk.signer.encrypt(
				paymentNdk.activeUser,
				JSON.stringify({}),
				"nip04",
			),
		});

		const result = await event.publish();
		console.log("result", result, await event.toNostrEvent());
		webPaymentEventId = NonEmptyString(event.id);
	}

	const paymentLnSpark = params.paymentLnSpark;
	let sparkPaymentResult: Awaited<
		ReturnType<typeof createSparkPayment>
	> | null = null;
	if (paymentLnSpark) {
		sparkPaymentResult = await createSparkPayment({
			ndk: params.ndk,
			evolu: params.evolu,
			amountInSats: paymentLnSpark.amount,
			accountId: paymentLnSpark.accountId,
		});
	}

	const paymentLnZap = params.paymentLnZap;
	if (paymentLnZap) {
		const { paymentNdk, paymentSigner } = await getPaymentNdk();

		const accountRows = await params.evolu.loadQuery(
			createQuery((db) =>
				db
					.selectFrom("accountLud16")
					.select(["accountLud16.lud16 as lud16"] as const)
					.where("accountLud16.id", "=", paymentLnZap.accountId)
					.where("accountLud16.isDeleted", "is not", sqliteTrue)
					.where("accountLud16.lud16", "is not", null)
					.$narrowType<{
						lud16: NotNull;
					}>(),
			),
		);

		const account = accountRows[0];
		if (account !== undefined) {
			const zapPaymentResult = await createZapPayment({
				amountInSats: paymentLnZap.amount,
				lud16: account.lud16,
				ndk: params.ndk,
				paymentNdk,
			});

			params.evolu.upsert("paymentLnZap", {
				...paymentLnZap,
				id,
				walletPubkey: zapPaymentResult.walletPubkey,
				lnInvoice: zapPaymentResult.lnInvoice,
				paymentHash: extractPaymentHashFromLnInvoice(
					zapPaymentResult.lnInvoice,
				),
				expirationIn: extractExpirationFromLightningInvoice(
					zapPaymentResult.lnInvoice,
				),
				privateKey: NonEmptyString(paymentSigner.privateKey),
			});
		} else {
			console.warn("Account not found");
		}
	}

	params.evolu.upsert("payment", {
		...params.payment,
		id,
		direction: "incoming",
		// billAllowTip: params.paymentData.bill.allowTip ? sqliteTrue : sqliteFalse,
		tipAmount: params.tipAmount,
		totalAmount: Integer(
			(params.tipAmount ?? 0) +
				(params.totalAmount ??
					params.items.reduce((acc, value) => {
						return acc + value.line.totalAmount;
					}, 0)),
		),
	});

	if (params.webData && webPaymentEventId) {
		const paymentSigner = NDKPrivateKeySigner.generate();

		params.evolu.upsert("paymentWebData", {
			...params.webData,
			privateKey: NonEmptyString(paymentSigner.privateKey),
			webPaymentEventId,
			id,
		});
	}

	// params.evolu.upsert("paymentWebData", {
	// 	id,
	// 	merchantName: params.paymentData.merchant?.name ?? null,
	// 	onSuccessfulPaymentTag:
	// 		params.paymentData.onSuccessfulPayment?._tag ?? null,
	// 	onSuccessfulPaymentRedirectUrl:
	// 		params.paymentData.onSuccessfulPayment?.redirectUrl ?? null,
	// 	webPaymentEventId: NonEmptyString(event.id),
	// 	privateKey: params.paymentData.privateKey,
	// });

	if (params.items) {
		for (const [index, { item, line }] of params.items.entries()) {
			const itemId = createIdFromString(`${id}:billItem:${index}`);
			params.evolu.upsert("paymentItemLine", {
				...line,
				id: itemId,
				paymentId: id,
			});
			params.evolu.upsert("paymentItem", {
				...item,
				id: itemId,
				paymentId: id,
			});
		}
	}

	// for (const [index, billItem] of params.paymentData.bill.items.entries()) {
	// 	const itemId = createIdFromString(`${id}:billItem:${index}`);
	// 	params.evolu.upsert("paymentItemLine", {
	// 		id: itemId,
	// 		paymentId: id,
	// 		price: billItem.price,
	// 		quantity: billItem.quantity,
	// 		optionalityChecked: billItem.optionality?.checked ?? null,
	// 	});
	// 	params.evolu.upsert("paymentItem", {
	// 		id: itemId,
	// 		paymentId: id,
	// 		price: billItem.price,
	// 		label: billItem.label,
	// 	});
	// }

	if (params.paymentLnSpark && sparkPaymentResult) {
		params.evolu.upsert("paymentLnSpark", {
			...params.paymentLnSpark,
			lnInvoice: sparkPaymentResult.lnInvoice,
			sparkInvoiceId: sparkPaymentResult.sparkInvoiceId,
			paymentHash: extractPaymentHashFromLnInvoice(
				sparkPaymentResult.lnInvoice,
			),
			expirationIn: extractExpirationFromLightningInvoice(
				sparkPaymentResult.lnInvoice,
			),
			id,
		});
	}

	if (params.paymentBankTransferCZ) {
		params.evolu.upsert("paymentBankTransferCZ", {
			...params.paymentBankTransferCZ,
			id,
		});
	}

	if (params.paymentCash) {
		params.evolu.upsert("paymentCash", {
			...params.paymentCash,
			id,
		});
	}

	// const paymentOption = params.paymentData.paymentOptions?.[0];
	// if (paymentOption?.type === "lnZap") {
	// 	console.log("paymentOption", paymentOption);
	// 	params.evolu.upsert("paymentLnZap", {
	// 		id,
	// 		accountId: paymentOption.accountId as Id,
	// 		lnInvoice: paymentOption.lnInvoice,
	// 		paymentHash: extractPaymentHashFromLnInvoice(paymentOption.lnInvoice),
	// 		walletPubkey: paymentOption.walletPubkey,
	// 		amount: Number(paymentOption.amount),
	// 		expirationIn: paymentOption.expirationIn.getTime(),
	// 	});
	// } else if (paymentOption?.type === "lnSpark") {
	// 	params.evolu.upsert("paymentLnSpark", {
	// 		id,
	// 		accountId: paymentOption.accountId as Id,
	// 		lnInvoice: paymentOption.lnInvoice,
	// 		paymentHash: extractPaymentHashFromLnInvoice(paymentOption.lnInvoice),
	// 		sparkInvoiceId: paymentOption.sparkInvoiceId,
	// 		amount: Number(paymentOption.amount),
	// 		expirationIn: paymentOption.expirationIn.getTime(),
	// 	});
	// } else if (paymentOption?.type === "bankTransferCZ") {
	// 	params.evolu.upsert("paymentBankTransferCZ", {
	// 		id,
	// 		iban: paymentOption.iban,
	// 		variableSymbol: paymentOption.variableSymbol,
	// 	});
	// } else if (paymentOption?.type === "cash" || paymentOption === undefined) {
	// 	params.evolu.upsert("paymentCash", {
	// 		id,
	// 		accountId: paymentOption?.accountId
	// 			? (paymentOption.accountId as Id)
	// 			: null,
	// 	});
	// }
	//
	// if (paymentOption?.type === "lnZap" || paymentOption?.type === "lnSpark") {
	// 	params.evolu.upsert("paymentWatchingState", {
	// 		id,
	// 		verifiedAt: null,
	// 		proveType: null,
	// 		transactionId: null,
	// 		stoppedAt: null,
	// 		stopReason: null,
	// 	});
	// }

	if (params.paymentLnSpark || params.paymentLnZap) {
		params.evolu.upsert("paymentWatchingState", {
			id,
			verifiedAt: null,
			proveType: null,
			transactionId: null,
			stoppedAt: null,
			stopReason: null,
		});
	}

	return id;
}

export async function stopPaymentWatching(params: {
	evolu: Evolu;
	paymentId: Id;
	reason: PaymentWatchingStopReason;
}) {
	const rows = await params.evolu.loadQuery(
		createQuery((db) =>
			db
				.selectFrom("paymentWatchingState")
				.select([
					"paymentWatchingState.verifiedAt as verifiedAt",
					"paymentWatchingState.stoppedAt as stoppedAt",
				] as const)
				.where("paymentWatchingState.isDeleted", "is not", sqliteTrue)
				.where("paymentWatchingState.id", "=", params.paymentId)
				.limit(1),
		),
	);
	const paymentWatchingState = rows[0];

	if (
		paymentWatchingState === undefined ||
		paymentWatchingState.verifiedAt !== null ||
		paymentWatchingState.stoppedAt !== null
	) {
		return false;
	}

	params.evolu.upsert("paymentWatchingState", {
		id: params.paymentId,
		stoppedAt: Date.now(),
		stopReason: params.reason,
	});

	return true;
}

async function createSparkPayment(params: {
	accountId: Id;
	amountInSats: Integer;
	ndk: NDK & {
		signer: NDKSigner;
		activeUser: NDKUser;
	};
	evolu: Evolu;
}) {
	const accounts = await params.evolu.loadQuery(
		createQuery((db) =>
			db
				.selectFrom("account")
				.leftJoin("accountSpark", "accountSpark.id", "account.id")
				.select([
					"account._tag as _tag",
					"accountSpark.mnemonic as mnemonic",
				] as const)
				.where("account.isDeleted", "is not", sqliteTrue)
				.where("account.id", "=", params.accountId),
		),
	);

	const account = accounts[0];
	if (account === undefined) {
		return;
	}

	if (account._tag !== "accountSpark" || !account.mnemonic) {
		return;
	}

	const { wallet } = await SparkWallet.initialize({
		mnemonicOrSeed: account.mnemonic,
		options: {
			network: "MAINNET",
		},
	});

	const invoice = await wallet.createLightningInvoice({
		amountSats: Number(params.amountInSats),
		expirySeconds: 3600, // 1 hour
	});

	return {
		lnInvoice: NonEmptyString(invoice.invoice.encodedInvoice),
		sparkInvoiceId: NonEmptyString(invoice.id),
		expirationAt: new Date(invoice.invoice.expiresAt),
	} as const;
}
