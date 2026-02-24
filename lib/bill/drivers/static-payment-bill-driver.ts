import NDK, {
	NDKPrivateKeySigner,
	type NDKSubscription,
	NDKUser,
} from "@nostr-dev-kit/ndk";
import { defaultRelays } from "@/atoms/nostr-relays";
import type {
	BillDriver,
	BillSubscription,
	ScreenDataPaymentPayFunction,
} from "@/lib/bill/driver";
import {
	type StaticOfflinePayment,
	StaticOfflinePaymentSchema,
} from "@/lib/shared/schemas";
import { NonEmptyString } from "@/lib/shared/types";

export class StaticPaymentBillDriver implements BillDriver {
	public async subscribe({
		billId,
		callback,
	}: Parameters<BillDriver["subscribe"]>[0]) {
		const [prefix, privateKey, ...rest] = billId.split("-");
		if (prefix !== "s") {
			return null;
		}

		if (rest.length !== 0) {
			return null;
		}

		const signer = (() => {
			try {
				return new NDKPrivateKeySigner(privateKey);
			} catch (_e) {
				return null;
			}
		})();

		if (signer === null) {
			return null; // Invalid privateKey
		}

		const ndk = new NDK({
			signer,
			explicitRelayUrls: defaultRelays,
		});

		await ndk.connect();

		let staticOfflinePayment: StaticOfflinePayment | null = null;
		let zapVerificationSubscription: NDKSubscription | null = null;

		let resolvePaymentFinished: () => void = () => {};
		const paymentFinishedPromise = new Promise<void>((resolve) => {
			resolvePaymentFinished = resolve;
		});

		const pay: ScreenDataPaymentPayFunction = async (params) => {
			if (staticOfflinePayment === null) {
				callback({
					type: "screen",
					payload: {
						variant: "paymentFinished",
						payload: {
							type: "failure",
							paymentId: params.paymentId,
							reason: NonEmptyString("The payment is not ready yet."),
						},
					},
				});
				return;
			}

			const zapWallet = staticOfflinePayment.paymentOptions.find(
				(paymentOption) => paymentOption.type === "lnZap",
			);

			callback({
				type: "screen",
				payload: {
					variant: "paymentReady",
					payload: {
						paymentId: params.paymentId,
						bill: {
							currency: staticOfflinePayment.bill.currency,
							items: staticOfflinePayment.bill.items,
						},
						type: "btcLn",
						lnInvoice: zapWallet ? zapWallet.lnInvoice : "",
					},
				},
			});

			return paymentFinishedPromise;
		};

		const billSubscription = ndk.subscribe(
			{
				kinds: [4], // zap receipt
				"#p": [signer.pubkey],
				// "#finito_type": ["static_payment"],
				// "#finito_version": ["1.1"],
				limit: 5,
			},
			{},
			{
				onEvent: async (event) => {
					if (ndk.activeUser === undefined) {
						return;
					}

					const ndkUser = new NDKUser({
						pubkey: event.pubkey,
					});

					const message = await signer.decrypt(ndkUser, event.content, "nip04");

					let data: unknown = null;
					try {
						data = JSON.parse(message);
					} catch {
						return;
					}

					const staticOfflinePaymentResult =
						StaticOfflinePaymentSchema.safeParse(data);
					if (!staticOfflinePaymentResult.success) {
						return;
					}

					staticOfflinePayment = staticOfflinePaymentResult.data;

					callback({
						type: "screen",
						payload: {
							variant: "payment",
							pay,
							payload: {
								bill: staticOfflinePayment.bill,
								merchant: staticOfflinePayment.merchant,
							},
						},
					});

					if (zapVerificationSubscription === null) {
						const zapWallet =
							staticOfflinePaymentResult.data.paymentOptions.find(
								(paymentOption) => paymentOption.type === "lnZap",
							);

						if (zapWallet !== undefined) {
							zapVerificationSubscription = ndk.subscribe(
								{
									kinds: [9735], // zap receipt
									authors: [zapWallet.walletPubkey],
									"#p": [signer.pubkey],
									limit: 5,
								},
								{},
								{
									onEvent: async () => {
										callback({
											type: "screen",
											payload: {
												variant: "paymentFinished",
												payload: {
													type: "success",
												},
											},
										});
										resolvePaymentFinished();
									},
								},
							);
						}
					}
				},
			},
		);

		return {
			refresh: async () => {},
			close: async () => {
				billSubscription.stop();
				if (zapVerificationSubscription !== null) {
					zapVerificationSubscription.stop();
				}
			},
		} satisfies BillSubscription;
	}
}
