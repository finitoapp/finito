import { createIdFromString } from "@evolu/common";
import { BigNumber } from "bignumber.js";
import type {
	BillDriver,
	BillSubscription,
	ScreenData,
} from "@/lib/bill/driver";
import { Currency, Integer, NonEmptyString } from "@/lib/shared/types";
import {
	extractExpirationFromLightningInvoice,
	extractPaymentHashFromLnInvoice,
} from "@/lib/shared/utils/ln";

const exampleBillItems = {
	"1": new Map([
		[
			"1",
			{
				item: {
					id: createIdFromString("Maďarský guláš"),
					label: "Maďarský guláš",
					price: Integer(190),
				},
				quantity: 1,
			},
		],
		[
			"2",
			{
				item: {
					id: createIdFromString("Řízek"),
					label: "Řízek",
					price: Integer(219),
				},
				quantity: 1,
			},
		],
		[
			"3",
			{
				item: {
					id: createIdFromString("Pivo"),
					label: "Pivo",
					price: Integer(49),
				},
				quantity: 3,
				optionality: {
					checked: 2,
				},
			},
		],
		[
			"4",
			{
				item: {
					id: createIdFromString("Volitelné párátko"),
					label: "Volitelné párátko",
					price: Integer(2),
				},
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
				item: {
					id: createIdFromString("Refund"),
					label: "Refund",
					price: Integer(-190),
				},
				quantity: 1,
			},
		],
	]),
} as Record<
	string,
	Map<
		string,
		NonNullable<
			Extract<ScreenData, { variant: "table" }>["payload"]["bill"]
		>["itemLines"][number]
	>
>;

export class ExampleBillDriver implements BillDriver {
	public async subscribe({
		billId,
		screenStack,
	}: Parameters<BillDriver["subscribe"]>[0]) {
		const [_, exampleBillItemId] = /^example-([0-9a-z]+)$/.exec(billId) ?? [
			null,
			null,
		];

		if (exampleBillItemId === null) {
			return null;
		}

		if (exampleBillItemId === "loading") {
			screenStack.replaceLast({
				variant: "loading",
				payload: {
					text: "Loading screen...",
				},
			});

			return {
				close: async () => {},
			} satisfies BillSubscription;
		}

		const items = exampleBillItems[exampleBillItemId];
		if (items === undefined) {
			return null;
		}

		const rootScreen: Extract<ScreenData, { variant: "table" }> = {
			variant: "table",
			pay: () => Promise.resolve(),
			payload: {
				merchant: {
					name: NonEmptyString("The best restaurant"),
				},
				bill: {
					allowTip: exampleBillItemId !== "2",
					currency: "CZK",
					itemLines: Array.from(
						items.entries().map(([id, values]) => ({
							id: createIdFromString(id),
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

				let totalAmount = new BigNumber(0);
				for (const item of params.items) {
					const finalItem = items.get(item.id);
					if (finalItem === undefined) {
						return;
					}

					totalAmount = totalAmount.plus(
						new BigNumber(finalItem.item.price).times(finalItem.quantity),
					);
				}

				timeout = setTimeout(() => {
					if (Math.random() >= 0.5) {
						screenStack.replaceLast({
							variant: "info",
							payload: {
								status: "failure",
								text: NonEmptyString("The bill is locked!"),
							},
						});
						resolve();
						return;
					}

					screenStack.replaceLast({
						variant: "info",
						payload: {
							status: "success",
							text: NonEmptyString("The bill is successfully paid!"),
						},
					});

					resolve();
				}, 3_000);

				const lnInvoice = NonEmptyString(
					"lnbc10n1p564j4ppp5aqtgx7tua76eggt4raal4py0j36dqj8sv0mtcn886lxe9wdtw67sdqqcqzzsxqrrsssp5x45v7knsz233fe6v497yhk77ekg66fq377s0955g6dsvkpn2ey8s9qxpqysgq3tf98g8hcxzhapa0p8s2xpu4ap44xu603l6z97d6wyxaskftc0hpwy5hce5awy0y6ksnuqs3pk6vu04ja5x795werrd2qxq22k9lx4qpxsj5ms",
				);

				screenStack.push({
					variant: "payment",
					parentScreen: rootScreen,
					payload: {
						payment: {
							id: params.paymentId as unknown as NonEmptyString,
							direction: "outgoing",
							totalAmount: Integer(
								Math.round(totalAmount.div(rate).integerValue().toNumber()),
							),
							currency: Currency.BTC,
							paymentSpecification: {
								type: "lnInvoice",
								lnInvoice,
								paymentHash: extractPaymentHashFromLnInvoice(lnInvoice),
								expirationIn: extractExpirationFromLightningInvoice(lnInvoice),
							},
						},
					},
				});
			});
		};

		timeout = setTimeout(() => {
			timeout = setTimeout(() => {
				screenStack.replaceLast(rootScreen);
			}, 1200);

			screenStack.replaceLast({
				variant: "loading",
				payload: {
					text: "Collecting items...",
				},
			});
		}, 800);

		return {
			close: async () => {
				if (timeout !== null) {
					clearTimeout(timeout);
				}
			},
		} satisfies BillSubscription;
	}
}
