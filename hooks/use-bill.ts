import { createIdFromString, sqliteFalse, sqliteTrue } from "@evolu/common";
import { useEvolu } from "@/hooks/use-evolu";
import { usePosRows } from "@/hooks/use-pos";
import type { EvoluSchemaType } from "@/lib/evolu";
import type { Id } from "@/lib/evolu/types";
import {
	type Currency,
	Integer,
	type NonEmptyString255,
	PositiveInteger,
} from "@/lib/shared/types";

export const useBill = () => {
	const evolu = useEvolu();
	const { billRows } = usePosRows();

	const getNextDisplayId = () =>
		PositiveInteger(
			billRows.reduce((max, bill) => Math.max(max, bill.displayId), 0) + 1,
		);

	const createBillInternal = (defaultCurrency: Currency) => {
		const data = {
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

			for (const item of bill.items) {
				evolu.update("posBillItemLine", {
					id: item.id,
					isDeleted: sqliteTrue,
				});
			}

			for (const rate of bill.rates) {
				evolu.update("posBillRate", {
					id: rate.id,
					isDeleted: sqliteTrue,
				});
			}
		},
		createBill: (props: { defaultCurrency: Currency }) => {
			return createBillInternal(props.defaultCurrency);
		},
		addItem: (props: {
			billId?: Id;
			defaultCurrency: Currency;
			item: EvoluSchemaType["itemRevision"];
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

			const posBillItemLineId = createIdFromString(
				`posBillItemLine:${bill.id}:${props.item.id}`,
			);
			const currentItem = bill.items.find(
				(item) => item.id === posBillItemLineId,
			);
			if (currentItem) {
				evolu.update("posBillItemLine", {
					isDeleted: sqliteFalse, // Let's undelete previously removed line
					id: currentItem.id,
					quantity: currentItem.quantity + 1,
					totalAmount: Integer(
						Math.round(props.item.price * currentItem.quantity + 1),
					),
				});
			} else {
				evolu.upsert("posBillItemLine", {
					isDeleted: sqliteFalse, // Let's undelete previously removed line
					id: posBillItemLineId,
					posBillId: bill.id,
					totalAmount: props.item.price,
					quantity: 1,
					itemRevisionId: props.item.id,
				});
			}

			return bill.id;
		},
		updateItemQuantity: (props: {
			billId: Id;
			itemLineId: Id;
			delta: -1 | 1;
		}) => {
			const bill = billRows.find((bill) => bill.id === props.billId);
			if (bill === undefined) {
				return;
			}

			const currentItem = bill.items.find(
				(item) => item.id === props.itemLineId,
			);
			if (currentItem === undefined) {
				return;
			}

			const nextQuantity = currentItem.quantity + props.delta;
			if (nextQuantity <= 0) {
				evolu.update("posBillItemLine", {
					id: currentItem.id,
					isDeleted: sqliteTrue,
				});
				return;
			}

			evolu.update("posBillItemLine", {
				id: currentItem.id,
				quantity: nextQuantity,
				totalAmount: Integer(Math.round(currentItem.item.price * nextQuantity)),
			});
		},
		removeItem: (props: { billId: Id; itemLineId: Id }) => {
			const bill = billRows.find((bill) => bill.id === props.billId);
			if (bill === undefined) {
				return;
			}

			const currentItem = bill.items.find(
				(item) => item.id === props.itemLineId,
			);
			if (currentItem === undefined) {
				return;
			}

			evolu.update("posBillItemLine", {
				id: currentItem.id,
				isDeleted: sqliteTrue,
			});
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
	};
};
