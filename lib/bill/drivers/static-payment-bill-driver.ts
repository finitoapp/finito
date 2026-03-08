import { createIdFromString } from "@evolu/common";
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
import { Integer, NonEmptyString } from "@/lib/shared/types";
import {
	extractExpirationFromLightningInvoice,
	extractPaymentHashFromLnInvoice,
} from "@/lib/shared/utils/ln";

export class StaticPaymentBillDriver implements BillDriver {
	public async subscribe({
		billId,
		screenStack,
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
				screenStack.replace({
					variant: "info",
					payload: {
						status: "failure",
						text: NonEmptyString("The payment is not ready yet."),
					},
				});
				return;
			}

			const totalAmount = Integer(
				staticOfflinePayment.bill.items.reduce((acc, row) => {
					return acc + Math.round(row.price * row.quantity);
				}, 0),
			);

			const paymentOption = staticOfflinePayment.paymentOptions.find(
				(paymentOption) =>
					paymentOption.type === "lnSpark" || paymentOption.type === "lnZap",
			);

			if (paymentOption === undefined) {
				screenStack.replace({
					variant: "info",
					payload: {
						status: "failure",
						text: NonEmptyString(
							"The payment does not support this payment method.",
						),
					},
				});
				return;
			}

			screenStack.push({
				variant: "payment",
				payload: {
					payment: {
						id: params.paymentId as unknown as NonEmptyString,
						direction: "incoming",
						totalAmount,
						currency: staticOfflinePayment.bill.currency,
						paymentSpecification: {
							type: "lnInvoice",
							lnInvoice: paymentOption.lnInvoice,
							paymentHash: extractPaymentHashFromLnInvoice(
								paymentOption.lnInvoice,
							),
							expirationIn: extractExpirationFromLightningInvoice(
								paymentOption.lnInvoice,
							),
						},
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

					screenStack.push({
						variant: "table",
						pay,
						payload: {
							bill: {
								allowTip: staticOfflinePayment.bill.allowTip,
								currency: staticOfflinePayment.bill.currency,
								items: Array.from(
									staticOfflinePayment.bill.items.map((item) => ({
										id: createIdFromString(item.id),
										quantity: item.quantity,
										item: {
											label: item.label,
											price: item.price,
										},
									})),
								),
							},
							merchant: staticOfflinePayment.merchant,
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
										screenStack.replace({
											variant: "info",
											payload: {
												status: "success",
												text: NonEmptyString("The bill is successfully paid!"),
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
			close: async () => {
				billSubscription.stop();
				if (zapVerificationSubscription !== null) {
					zapVerificationSubscription.stop();
				}
			},
		} satisfies BillSubscription;
	}
}
