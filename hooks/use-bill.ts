import { createIdFromString, sqliteTrue } from "@evolu/common";
import { useAtomValue } from "jotai";
import { accountAtom } from "@/atoms/account";
import { useEvolu } from "@/hooks/use-evolu";
import { type PosBill, usePosRows } from "@/hooks/use-pos";
import type { EvoluSchemaType } from "@/lib/evolu";
import type { Id } from "@/lib/evolu/types";
import { createItem } from "@/lib/item/service";
import {
	type Currency,
	Integer,
	type NonEmptyString255,
	PositiveInteger,
	PositiveNumber,
} from "@/lib/shared/types";

export const useBill = () => {
	const account = useAtomValue(accountAtom);
	const evolu = useEvolu();
	const { billRows } = usePosRows();

	const getNextDisplayId = () =>
		PositiveInteger(
			billRows.reduce((max, bill) => Math.max(max, bill.displayId), 0) + 1,
		);

	const createBillInternal = (defaultCurrency: Currency) => {
		const data = {
			deviceId: account.device.id,
			displayId: getNextDisplayId(),
			label: null,
			currency: defaultCurrency,
			tableId: null,
		};
		const { id } = evolu.insert("posBill", data);

		return {
			id,
			...data,
		};
	};

	const copyBillRates = (props: {
		sourceBill: PosBill;
		targetBillId: Id;
		existingCurrencies?: Iterable<Currency>;
	}) => {
		const existingCurrencies = new Set(props.existingCurrencies ?? []);

		for (const rate of props.sourceBill.rates) {
			if (existingCurrencies.has(rate.currency)) {
				continue;
			}

			evolu.upsert("posBillRate", {
				id: createIdFromString(
					`posBillRate:${props.targetBillId}:${rate.currency}`,
				),
				billId: props.targetBillId,
				currency: rate.currency,
				rate: rate.rate,
			});
		}
	};

	const createPosBillItemLineChange = (props: {
		billId: Id;
		itemId: EvoluSchemaType["item"]["id"];
		catalogItemId: EvoluSchemaType["item"]["catalogItemId"];
		quantity: PositiveNumber;
		totalAmount: EvoluSchemaType["posBillItemLine"]["totalAmount"];
		_tag: EvoluSchemaType["posBillItemLine"]["_tag"];
	}) => {
		if (props.quantity <= 0 || props.totalAmount <= 0) {
			return;
		}

		evolu.insert("posBillItemLine", {
			posBillId: props.billId,
			deviceId: account.device.id,
			catalogItemId: props.catalogItemId,
			itemId: props.itemId,
			_tag: props._tag,
			totalAmount: props.totalAmount,
			quantity: props.quantity,
		});
	};

	return {
		deleteBill: (billId: Id) => {
			const bill = billRows.find((bill) => bill.id === billId);
			if (bill === undefined) {
				return;
			}

			evolu.update("posBill", {
				id: billId,
				isDeleted: sqliteTrue,
			});

			for (const rate of bill.rates) {
				evolu.update("posBillRate", {
					id: rate.id,
					isDeleted: sqliteTrue,
				});
			}
		},
		createBill: (props: {
			defaultCurrency: Currency;
			currency?: Currency;
			label?: NonEmptyString255 | null;
			tableId?: Id | null;
			rates?: PosBill["rates"];
		}) => {
			const bill = createBillInternal(props.currency ?? props.defaultCurrency);

			evolu.update("posBill", {
				id: bill.id,
				label: props.label ?? null,
				tableId: props.tableId ?? null,
			});

			if (props.rates) {
				copyBillRates({
					sourceBill: {
						...bill,
						label: props.label ?? null,
						tableId: props.tableId ?? null,
						table: null,
						items: [],
						rates: props.rates,
					},
					targetBillId: bill.id,
				});
			}

			return {
				...bill,
				label: props.label ?? null,
				tableId: props.tableId ?? null,
			};
		},
		addExistingItem: (props: {
			item: PosBill["items"][number];
			quantity: number;
		}) => {
			createPosBillItemLineChange({
				billId: props.item.posBillId,
				catalogItemId: props.item.catalogItemId,
				itemId: props.item.itemId,
				_tag: props.quantity > 0 ? "add" : "remove",
				quantity: PositiveNumber(Math.abs(props.quantity)),
				totalAmount: Integer(
					Math.round(props.item.item.price * Math.abs(props.quantity)),
				),
			});
		},
		addItem: async (props: {
			billId?: Id;
			defaultCurrency: Currency;
			item: EvoluSchemaType["item"];
			quantity: number;
		}) => {
			const bill = props.billId
				? billRows.find((bill) => bill.id === props.billId)
				: {
						...createBillInternal(props.defaultCurrency),
						items: [],
					};
			if (bill === undefined) {
				return;
			}

			await createItem({ evolu })({ item: props.item });

			createPosBillItemLineChange({
				billId: bill.id,
				catalogItemId: props.item.catalogItemId,
				itemId: props.item.id,
				_tag: props.quantity > 0 ? "add" : "remove",
				quantity: PositiveNumber(Math.abs(props.quantity)),
				totalAmount: Integer(Math.round(props.item.price * props.quantity)),
			});

			return bill.id;
		},
		setBillLabel: (props: { billId: Id; label: NonEmptyString255 | null }) => {
			evolu.update("posBill", {
				id: props.billId,
				label: props.label,
			});
		},
		setBillTable: (props: { billId: Id; tableId: Id | null }) => {
			evolu.update("posBill", {
				id: props.billId,
				tableId: props.tableId,
			});
		},
		setBillCurrency: (props: { billId: string; currency: Currency }) => {
			evolu.update("posBill", {
				id: props.billId as Id,
				currency: props.currency,
			});
		},
		setBillRate: (props: { billId: Id; currency: Currency; rate: number }) => {
			if (!Number.isFinite(props.rate) || props.rate <= 0) {
				return;
			}

			evolu.upsert("posBillRate", {
				id: createIdFromString(`posBillRate:${props.billId}:${props.currency}`),
				billId: props.billId,
				currency: props.currency,
				rate: props.rate,
			});
		},
		moveItemsToBill: (props: {
			sourceBillId: Id;
			targetBillId?: Id;
			targetTableId?: Id | null;
			items: Array<{
				item: PosBill["items"][number];
				quantity: number;
			}>;
		}) => {
			const sourceBill = billRows.find(
				(bill) => bill.id === props.sourceBillId,
			);
			if (sourceBill === undefined) {
				return;
			}

			const items = props.items
				.map(({ item, quantity }) => ({
					item,
					quantity: Math.min(item.quantity, Math.max(0, quantity)),
				}))
				.filter((value) => value.quantity > 0);
			if (items.length === 0) {
				return;
			}

			let targetBill = props.targetBillId
				? billRows.find((bill) => bill.id === props.targetBillId)
				: undefined;
			if (props.targetBillId !== undefined && targetBill === undefined) {
				return;
			}
			if (
				targetBill !== undefined &&
				(targetBill.id === sourceBill.id ||
					targetBill.currency !== sourceBill.currency)
			) {
				return;
			}

			if (targetBill === undefined) {
				const createdBill = createBillInternal(sourceBill.currency);

				evolu.update("posBill", {
					id: createdBill.id,
					tableId: props.targetTableId ?? sourceBill.tableId,
				});

				copyBillRates({
					sourceBill,
					targetBillId: createdBill.id,
				});

				targetBill = {
					...createdBill,
					label: null,
					tableId: props.targetTableId ?? sourceBill.tableId,
					table: null,
					items: [],
					rates: sourceBill.rates,
				};
			} else {
				copyBillRates({
					sourceBill,
					targetBillId: targetBill.id,
					existingCurrencies: targetBill.rates.map((rate) => rate.currency),
				});
			}

			for (const { item, quantity } of items) {
				createPosBillItemLineChange({
					billId: sourceBill.id,
					catalogItemId: item.catalogItemId,
					itemId: item.itemId,
					_tag: "remove",
					quantity: PositiveNumber(quantity),
					totalAmount: Integer(Math.round(item.item.price * quantity)),
				});

				createPosBillItemLineChange({
					billId: targetBill.id,
					catalogItemId: item.catalogItemId,
					itemId: item.itemId,
					_tag: "add",
					quantity: PositiveNumber(quantity),
					totalAmount: Integer(Math.round(item.item.price * quantity)),
				});
			}

			return targetBill.id;
		},
	};
};
