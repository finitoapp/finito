import type { BillDriver, BillSubscription } from "@/lib/bill/billDriver";
import { NonEmptyString } from "@/lib/types";
import type { PaymentReady } from "@/storages/payment-progress-storage";

const exampleBillItems = {
	"1": new Map([
		[
			"1",
			{
				label: "Maďarský guláš",
				price: 190,
				quantity: 1,
			},
		],
		[
			"2",
			{
				label: "Řízek",
				price: 219,
				quantity: 1,
			},
		],
		[
			"3",
			{
				label: "Pivo",
				price: 49,
				quantity: 3,
				optionality: {
					checked: 2,
				},
			},
		],
		[
			"4",
			{
				label: "Volitelné párátko",
				price: 2,
				quantity: 1,
				optionality: {
					checked: 1,
				},
			},
		],
	]),
	"2": new Map([
		[
			"1",
			{
				label: "Refund",
				price: -190,
				quantity: 1,
			},
		],
	]),
} as Record<
	string,
	Map<string, Omit<PaymentReady["bill"]["items"][number], "id">>
>;

export class ExampleBillDriver implements BillDriver {
	public async subscribe({
		billId,
		callback,
	}: Parameters<BillDriver["subscribe"]>[0]) {
		const [_, exampleBillItemId] = /^example-([0-9]+)$/.exec(billId) ?? [
			null,
			null,
		];

		if (exampleBillItemId === null) {
			return null;
		}

		const items = exampleBillItems[exampleBillItemId];
		if (items === undefined) {
			return null;
		}

		let timeout: null | Timer = null;

		timeout = setTimeout(() => {
			timeout = setTimeout(() => {
				callback({
					type: "bill",
					payload: {
						variant: exampleBillItemId !== "2" ? "payment" : "refund",
						merchant: {
							name: NonEmptyString("The best restaurant"),
						},
						bill: {
							allowTip: exampleBillItemId !== "2",
							currency: "CZK",
							items: Array.from(
								items.entries().map(([id, values]) => ({
									id,
									...values,
								})),
							),
						},
					},
				});
			}, 1200);

			callback({
				type: "billLoading",
				payload: {
					text: "Collecting items...",
				},
			});
		}, 800);

		return {
			refresh: async () => {},
			close: async () => {
				if (timeout !== null) {
					clearTimeout(timeout);
				}
			},
			pay: async (params) => {
				await new Promise((resolve) => setTimeout(resolve, 1000));

				return new Promise((resolve) => {
					const rate = 1_913_775;

					const finalItems: PaymentReady["bill"]["items"] = [];

					for (const item of params.items) {
						const finalItem = items.get(item.id);
						if (finalItem === undefined) {
							return;
						}
						finalItems.push({
							...finalItem,
							id: item.id,
						});
					}

					const totalAmount = finalItems.reduce(
						(acc, value) => acc + value.price * value.quantity,
						0,
					);

					timeout = setTimeout(() => {
						if (Math.random() >= 0.5) {
							resolve({
								paymentId: params.paymentId,
								type: "failure",
								reason: NonEmptyString("The bill is locked!"),
							});
							return;
						}

						resolve({
							paymentId: params.paymentId,
							type: "success",
						});
					}, 3_000);

					callback({
						type: "paymentReady",
						payload: {
							paymentId: params.paymentId,
							bill: {
								items: finalItems,
								tip: params.tip,
								currency: params.currency,
							},
							type: "btcLn",
							lnInvoice: "abc",
							amountExpectedToPay: {
								value: totalAmount / rate,
								currency: "BTC",
								rate: rate,
							},
						},
					});
				});
			},
		} satisfies BillSubscription;
	}
}
