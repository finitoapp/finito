import { createIdFromString, sqliteTrue } from "@evolu/common";
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

	const createBillInternal = (defaultCurrency: Currency): Id => {
		const { id } = evolu.insert("posBill", {
			displayId: getNextDisplayId(),
			label: null,
			currency: defaultCurrency,
			tableId: null,
		});

		return id;
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
				evolu.update("posBillItem", {
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
			item: EvoluSchemaType["item"];
		}) => {
			const billId = props.billId ?? createBillInternal(props.defaultCurrency);
			const bill = billRows.find((bill) => bill.id === billId);
			if (bill === undefined) {
				return;
			}

			const currentItem = bill.items.find(
				(item) => item.item.sourceItemId === props.item.id,
			);

			if (currentItem) {
				evolu.update("posBillItemLine", {
					id: currentItem.id,
					quantity: currentItem.quantity + 1,
					totalAmount: Integer(
						Math.round(props.item.price * currentItem.quantity + 1),
					),
				});
			} else {
				const { id } = evolu.insert("posBillItemLine", {
					posBillId: billId,
					totalAmount: props.item.price,
					quantity: 1,
				});

				evolu.upsert("posBillItem", {
					...props.item,
					id,
					sourceItemId: props.item.id,
				});
			}

			return billId;
		},
		updateItemQuantity: (props: { billId: Id; itemId: Id; delta: -1 | 1 }) => {
			const bill = billRows.find((bill) => bill.id === props.billId);
			if (bill === undefined) {
				return;
			}

			const currentItem = bill.items.find(
				(item) => item.item.sourceItemId === props.itemId,
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
				evolu.update("posBillItem", {
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
		removeItem: (props: { billId: Id; itemId: Id }) => {
			const bill = billRows.find((bill) => bill.id === props.billId);
			if (bill === undefined) {
				return;
			}

			const currentItem = bill.items.find((item) => item.id === props.itemId);
			if (currentItem === undefined) {
				return;
			}

			evolu.update("posBillItemLine", {
				id: currentItem.id,
				isDeleted: sqliteTrue,
			});
			evolu.update("posBillItem", {
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
