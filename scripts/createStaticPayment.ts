import {
	createOwnerSecret,
	createRandomBytes,
	ownerSecretToMnemonic,
} from "@evolu/common";
import NDK, { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { bech32 } from "@scure/base";
import { createStore } from "jotai";
import { evoluAtom } from "@/atoms/evolu";
import { ndkAtom } from "@/atoms/ndk";
import { extractExpirationFromLightningInvoice } from "@/lib/ln-utils";
import type { StaticOfflinePayment } from "@/lib/schemas";
import { assertNotNull } from "@/lib/type-utils";
import { Currency } from "@/lib/types";

(async () => {
	const amount = 2000;
	const _nsec =
		"nsec1sg0cxhuqwr6gpd7ftdl24dh9cyufw6zsr3ckgwv7yas2vf8cc8esdwt3x7";

	const store = createStore();
	const evolu = store.get(evoluAtom);
	await evolu.restoreAppOwner(
		ownerSecretToMnemonic(
			createOwnerSecret({
				randomBytes: createRandomBytes(),
			}),
		),
	);
	const ndk = await store.get(ndkAtom);
	console.log("npub", ndk.activeUser?.npub);
	console.log("pubkey", ndk.activeUser?.pubkey);

	const paymentSigner = NDKPrivateKeySigner.generate();

	const httpUrl =
		"https://walletofsatoshi.com/.well-known/lnurlp/soothedcoat52";
	const lnurlResult = await fetch(httpUrl).then((result) => result.json());

	console.log("lnurlResult", lnurlResult);

	const lnurl = bech32.encode(
		"lnurl",
		bech32.toWords(Buffer.from(httpUrl, "utf8")),
		108,
	);
	console.log("lnurl", lnurl);

	const paymentNdk = new NDK({
		explicitRelayUrls: ndk.explicitRelayUrls,
		signer: paymentSigner,
	});
	const zapRequestEvent = new NDKEvent(paymentNdk, {
		kind: 9734,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			["relays", ...ndk.explicitRelayUrls], // List of relays for the zap receipt
			["amount", amount.toString()], // Amount in millisatoshis
			["lnurl", lnurl], // Recipient’s LNURL
			["p", ndk.activeUser?.pubkey], // Recipient’s public key
			// ["e", event.id],
			// ["k", "4"],
		],
		content: "Zap!",
	});

	await zapRequestEvent.sign();

	console.log("zapRequestEvent", await zapRequestEvent.toNostrEvent());

	const zapResult = await fetch(
		`${lnurlResult.callback}?amount=${amount}&nostr=${encodeURI(JSON.stringify(await zapRequestEvent.toNostrEvent()))}`,
	).then((result) => result.json());

	console.log("zapResult", zapResult);

	const expirationIn = extractExpirationFromLightningInvoice(zapResult.pr);

	assertNotNull(expirationIn);

	const event = new NDKEvent(ndk, {
		kind: 4,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			["p", paymentSigner.pubkey],
			["finito_type", "static_payment"],
			["finito_version", "1.1"],
		],
		content: await ndk.signer.encrypt(
			paymentSigner.userSync,
			JSON.stringify({
				bill: {
					currency: Currency.BTC,
					allowTip: false,
					items: [
						{
							id: "Polévka",
							price: amount,
							quantity: 1,
							label: "Polévka",
						},
					],
				},
				paymentOptions: [
					{
						type: "lnZap",
						amount,
						lnInvoice: zapResult.pr,
						walletPubkey: lnurlResult.nostrPubkey,
						expirationIn: expirationIn.getTime() / 1000,
					},
				],
				privateKey: paymentSigner.privateKey,
			} satisfies StaticOfflinePayment),
			"nip04",
		),
	});

	await event.publish();
})();
