import type { Id } from "@evolu/common";
import { BigNumber } from "bignumber.js";
import type {
	BillDriver,
	BillSubscription,
	ScreenData,
} from "@/lib/bill/driver";
import { Integer, NonEmptyString } from "@/lib/shared/types";
import type { PaymentReady } from "@/lib/evolu/model/payment-progress";

const exampleBillItems = {
	"1": new Map([
		[
			"1",
			{
				label: "Maďarský guláš",
				price: Integer(190),
				quantity: 1,
			},
		],
		[
			"2",
			{
				label: "Řízek",
				price: Integer(219),
				quantity: 1,
			},
		],
		[
			"3",
			{
				label: "Pivo",
				price: Integer(49),
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
				price: Integer(2),
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
				price: Integer(-190),
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

		const rootScreen: ScreenData = {
			variant: exampleBillItemId !== "2" ? "payment" : "refund",
			pay: () => Promise.resolve(),
			payload: {
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
		};

		let timeout: null | Timer = null;

		rootScreen.pay = async (params) => {
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
					(acc, value) =>
						acc.plus(new BigNumber(value.price).times(value.quantity)),
					new BigNumber(0),
				);

				timeout = setTimeout(() => {
					if (Math.random() >= 0.5) {
						callback({
							type: "screen",
							payload: {
								variant: "paymentFinished",
								payload: {
									paymentId: params.paymentId as Id,
									type: "failure",
									reason: NonEmptyString("The bill is locked!"),
								},
							},
						});
						resolve();
						return;
					}

					callback({
						type: "screen",
						payload: {
							variant: "paymentFinished",
							payload: {
								paymentId: params.paymentId as Id,
								type: "success",
							},
						},
					});

					resolve();
				}, 3_000);

				callback({
					type: "screen",
					payload: {
						variant: "paymentReady",
						parentScreen: rootScreen,
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
								value: Integer(totalAmount.div(rate).integerValue().toNumber()),
								currency: "BTC",
								rate: rate,
							},
						},
					},
				});
			});
		};

		timeout = setTimeout(() => {
			timeout = setTimeout(() => {
				callback({
					type: "screen",
					payload: rootScreen,
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
		} satisfies BillSubscription;
	}
}
