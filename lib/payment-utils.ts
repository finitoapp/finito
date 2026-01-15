import { SparkWallet } from "@buildonspark/spark-sdk";
import NDK, {
	NDKEvent,
	type NDKSigner,
	type NDKUser,
} from "@nostr-dev-kit/ndk";
import { bech32 } from "@scure/base";
import { extractExpirationFromLightningInvoice } from "@/lib/ln-utils";
import { shiftNumericString } from "@/lib/number-utils";
import type { StaticOfflinePayment } from "@/lib/schemas";
import { assertNotNull } from "@/lib/type-utils";
import { type Email, NumberString, Uuid7 } from "@/lib/types";
import { accountStorage } from "@/storages/account-storage";
import { notificationStorage } from "@/storages/notification-storage";
import {
	PaymentStatus,
	paymentStatusStorage,
} from "@/storages/payment-status-storage";
import { paymentStorage } from "@/storages/payment-storage";

export async function createZapPayment(params: {
	lud16: Email;
	amountInBtc: number;
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
		NumberString(params.amountInBtc.toFixed(8)),
		11,
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
		expirationIn: expirationIn.getTime() / 1000,
	} as const;
}

export async function createPayment(params: {
	ndk: NDK & {
		signer: NDKSigner;
		activeUser: NDKUser;
	};
	paymentNdk: NDK & {
		signer: NDKSigner;
		activeUser: NDKUser;
	};
	paymentId: Uuid7;
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
			JSON.stringify(params.paymentData),
			"nip04",
		),
	});

	const result = await event.publish();
	console.log("result", result, await event.toNostrEvent());

	const promises: Promise<unknown>[] = [];

	promises.push(
		notificationStorage.insertOrUpdate(
			{ ndk: params.ndk },
			`verifyPayment_${params.paymentId}`,
			{
				type: "verifyPayment",
				id: Uuid7.random(),
				paymentId: params.paymentId,
			},
		),
	);

	promises.push(
		paymentStatusStorage.insertOrUpdate({ ndk: params.ndk }, params.paymentId, {
			paymentId: params.paymentId,
			status: PaymentStatus.Unpaid,
		}),
	);

	await Promise.all(promises);

	await paymentStorage.insertOrUpdate({ ndk: params.ndk }, params.paymentId, {
		id: params.paymentId,
		webPaymentEventId: event.id,
		...params.paymentData,
	});
}

export async function createSparkPayment(params: {
	accountId: string;
	amountInBtc: number;
	ndk: NDK & {
		signer: NDKSigner;
		activeUser: NDKUser;
	};
}) {
	const { data: accounts } = await accountStorage.select(
		{ ndk: params.ndk },
		{
			key: params.accountId,
			limit: 1,
		},
	);

	const account = accounts[0];
	if (account === undefined) {
		return;
	}

	if (account.value._tag !== "spark") {
		return;
	}

	const { wallet } = await SparkWallet.initialize({
		mnemonicOrSeed: account.value.mnemonic,
		options: {
			network: "MAINNET",
		},
	});

	const invoice = await wallet.createLightningInvoice({
		amountSats: params.amountInBtc * 100000000,
		expirySeconds: 3600, // 1 hour
	});

	return {
		lnInvoice: invoice.invoice.encodedInvoice,
		sparkInvoiceId: invoice.id,
		expirationAt: new Date(invoice.invoice.expiresAt),
	} as const;
}
