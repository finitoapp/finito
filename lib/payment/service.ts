import { SparkWallet } from "@buildonspark/spark-sdk";
import {
	createIdFromString,
	getOrThrow,
	type Id,
	sqliteFalse,
	sqliteTrue,
} from "@evolu/common";
import NDK, {
	NDKEvent,
	type NDKSigner,
	type NDKUser,
} from "@nostr-dev-kit/ndk";
import { bech32 } from "@scure/base";
import type { Evolu } from "@/lib/evolu";
import {
	extractExpirationFromLightningInvoice,
	extractPaymentHashFromLnInvoice,
} from "@/lib/shared/utils/ln";
import { shiftNumericString } from "@/lib/shared/utils/number";
import {
	type StaticOfflinePayment,
	StaticOfflinePaymentSchema,
} from "@/lib/shared/schemas";
import { assertNotNull } from "@/lib/shared/utils/type";
import type { Email, Integer } from "@/lib/shared/types";
import { PaymentStatus } from "@/lib/evolu/model/payment-status";
import type { PaymentWatchingStopReason } from "@/lib/evolu/model/payment-watching-state";

export async function createZapPayment(params: {
	lud16: Email;
	amountInBtc: Integer;
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

	const amountInMilliSats = shiftNumericString(
		params.amountInBtc.toString(),
		3,
	);

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

	const expirationIn = extractExpirationFromLightningInvoice(zapResult.pr);

	assertNotNull(expirationIn);

	return {
		lnInvoice: zapResult.pr,
		walletPubkey: lnurlResult.nostrPubkey,
		expirationIn: expirationIn,
	} as const;
}

export async function createPayment(params: {
	ndk: NDK & {
		signer: NDKSigner;
		activeUser: NDKUser;
	};
	evolu: Evolu;
	paymentNdk: NDK & {
		signer: NDKSigner;
		activeUser: NDKUser;
	};
	expectedTipAmount: number | null;
	paymentData: StaticOfflinePayment;
}) {
	const event = new NDKEvent(params.ndk, {
		kind: 4,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			["p", params.paymentNdk.activeUser.pubkey],
			["finito_type", "static_payment"],
			["finito_version", "1.1"],
		],
		content: await params.ndk.signer.encrypt(
			params.paymentNdk.activeUser,
			JSON.stringify(StaticOfflinePaymentSchema.encode(params.paymentData)),
			"nip04",
		),
	});

	const result = await event.publish();
	console.log("result", result, await event.toNostrEvent());

	const id = createIdFromString(event.id);

	getOrThrow(
		params.evolu.upsert("payment", {
			id,
			type: params.paymentData.paymentOptions?.[0]?.type ?? "cash",
			billCurrency: params.paymentData.bill.currency,
			billAllowTip: params.paymentData.bill.allowTip ? sqliteTrue : sqliteFalse,
			expectedTipAmount: params.expectedTipAmount,
			merchantName: params.paymentData.merchant?.name ?? null,
			onSuccessfulPaymentTag:
				params.paymentData.onSuccessfulPayment?._tag ?? null,
			onSuccessfulPaymentRedirectUrl:
				params.paymentData.onSuccessfulPayment?.redirectUrl ?? null,
			privateKey: params.paymentData.privateKey,
			webPaymentEventId: event.id,
		}),
	);

	for (const [index, billItem] of params.paymentData.bill.items.entries()) {
		getOrThrow(
			params.evolu.upsert("paymentBillItem", {
				id: createIdFromString(`${id}:billItem:${index}`),
				paymentId: id,
				price: Number(billItem.price),
				quantity: billItem.quantity,
				label: billItem.label,
				optionalityChecked: billItem.optionality?.checked ?? null,
			}),
		);
	}

	const paymentOption = params.paymentData.paymentOptions?.[0];
	if (paymentOption?.type === "lnZap") {
		console.log("paymentOption", paymentOption);
		getOrThrow(
			params.evolu.upsert("paymentLnZap", {
				id,
				accountId: paymentOption.accountId as Id,
				lnInvoice: paymentOption.lnInvoice,
				paymentHash: extractPaymentHashFromLnInvoice(paymentOption.lnInvoice),
				walletPubkey: paymentOption.walletPubkey,
				amount: Number(paymentOption.amount),
				expirationIn: paymentOption.expirationIn.getTime(),
			}),
		);
	} else if (paymentOption?.type === "lnSpark") {
		getOrThrow(
			params.evolu.upsert("paymentLnSpark", {
				id,
				accountId: paymentOption.accountId as Id,
				lnInvoice: paymentOption.lnInvoice,
				paymentHash: extractPaymentHashFromLnInvoice(paymentOption.lnInvoice),
				sparkInvoiceId: paymentOption.sparkInvoiceId,
				amount: Number(paymentOption.amount),
				expirationIn: paymentOption.expirationIn.getTime(),
			}),
		);
	} else if (paymentOption?.type === "bankTransferCZ") {
		getOrThrow(
			params.evolu.upsert("paymentBankTransferCZ", {
				id,
				iban: paymentOption.iban,
				variableSymbol: paymentOption.variableSymbol,
			}),
		);
	} else if (paymentOption?.type === "cash" || paymentOption === undefined) {
		getOrThrow(
			params.evolu.upsert("paymentCash", {
				id,
				accountId: paymentOption?.accountId
					? (paymentOption.accountId as Id)
					: null,
			}),
		);
	}

	if (paymentOption?.type === "lnZap" || paymentOption?.type === "lnSpark") {
		getOrThrow(
			params.evolu.upsert("paymentWatchingState", {
				id,
				verifiedAt: null,
				proveType: null,
				transactionId: null,
				stoppedAt: null,
				stopReason: null,
			}),
		);
	}

	getOrThrow(
		params.evolu.upsert("paymentStatus", {
			id,
			status: PaymentStatus.Unpaid,
			proveType: null,
		}),
	);

	return id;
}

export async function stopPaymentWatching(params: {
	evolu: Evolu;
	paymentId: Id;
	reason: PaymentWatchingStopReason;
}) {
	const rows = await params.evolu.loadQuery(
		params.evolu.createQuery((db) =>
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

	getOrThrow(
		params.evolu.upsert("paymentWatchingState", {
			id: params.paymentId,
			stoppedAt: Date.now(),
			stopReason: params.reason,
		}),
	);

	return true;
}

export async function createSparkPayment(params: {
	accountId: Id;
	amountInBtc: Integer;
	ndk: NDK & {
		signer: NDKSigner;
		activeUser: NDKUser;
	};
	evolu: Evolu;
}) {
	const accounts = await params.evolu.loadQuery(
		params.evolu.createQuery((db) =>
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
		amountSats: Number(params.amountInBtc),
		expirySeconds: 3600, // 1 hour
	});

	return {
		lnInvoice: invoice.invoice.encodedInvoice,
		sparkInvoiceId: invoice.id,
		expirationAt: new Date(invoice.invoice.expiresAt),
	} as const;
}
