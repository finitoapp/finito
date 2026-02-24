import {
	createIdFromString,
	getOrThrow,
	type Id,
	sqliteTrue,
} from "@evolu/common";
import { useEvolu } from "@/hooks/use-evolu";
import { usePosRows } from "@/hooks/use-pos";
import type { Currency } from "@/lib/shared/types";

type BillInputItem = {
	id: string;
	label: string;
	price: {
		value: number;
		currency: Currency;
	};
};

export const useBill = () => {
	const evolu = useEvolu();
	const { billRows, billItemRows, billRateRows } = usePosRows();

	const getNextDisplayId = () =>
		billRows.reduce((max, bill) => Math.max(max, bill.displayId), 0) + 1;

	const createBillInternal = (defaultCurrency: Currency): Id => {
		const { id } = getOrThrow(
			evolu.insert("posBill", {
				displayId: getNextDisplayId(),
				label: null,
				currency: defaultCurrency,
				tableId: null,
			}),
		);

		return id;
	};

	return {
		deleteBill: (billId: string) => {
			const billIdValue = billId as Id;

			getOrThrow(
				evolu.update("posBill", {
					id: billIdValue,
					isDeleted: sqliteTrue,
				}),
			);

			for (const item of billItemRows) {
				if (item.billId !== billIdValue) {
					continue;
				}

				getOrThrow(
					evolu.update("posBillItem", {
						id: item.id,
						isDeleted: sqliteTrue,
					}),
				);
			}

			for (const rate of billRateRows) {
				if (rate.billId !== billIdValue) {
					continue;
				}

				getOrThrow(
					evolu.update("posBillRate", {
						id: rate.id,
						isDeleted: sqliteTrue,
					}),
				);
			}
		},
		createBill: (props: { defaultCurrency: Currency }) => {
			return createBillInternal(props.defaultCurrency);
		},
		addItem: (props: {
			billId?: string;
			defaultCurrency: Currency;
			item: BillInputItem;
		}) => {
			const billId =
				(props.billId as Id | undefined) ??
				createBillInternal(props.defaultCurrency);

			const currentItem = billItemRows.find(
				(item) => item.billId === billId && item.sourceItemId === props.item.id,
			);

			if (currentItem) {
				getOrThrow(
					evolu.update("posBillItem", {
						id: currentItem.id,
						quantity: currentItem.quantity + 1,
					}),
				);
			} else {
				getOrThrow(
					evolu.insert("posBillItem", {
						billId,
						sourceItemId: props.item.id,
						name: props.item.label,
						price: props.item.price.value,
						quantity: 1,
						currency: props.item.price.currency,
					}),
				);
			}

			return billId;
		},
		updateItemQuantity: (props: {
			billId: string;
			itemId: string;
			delta: -1 | 1;
		}) => {
			const currentItem = billItemRows.find(
				(item) =>
					item.billId === (props.billId as Id) &&
					item.sourceItemId === props.itemId,
			);
			if (currentItem === undefined) {
				return;
			}

			const nextQuantity = currentItem.quantity + props.delta;
			if (nextQuantity <= 0) {
				getOrThrow(
					evolu.update("posBillItem", {
						id: currentItem.id,
						isDeleted: sqliteTrue,
					}),
				);
				return;
			}

			getOrThrow(
				evolu.update("posBillItem", {
					id: currentItem.id,
					quantity: nextQuantity,
				}),
			);
		},
		removeItem: (props: { billId: string; itemId: string }) => {
			const currentItem = billItemRows.find(
				(item) =>
					item.billId === (props.billId as Id) &&
					item.sourceItemId === props.itemId,
			);
			if (currentItem === undefined) {
				return;
			}

			getOrThrow(
				evolu.update("posBillItem", {
					id: currentItem.id,
					isDeleted: sqliteTrue,
				}),
			);
		},
		setBillLabel: (props: { billId: string; label: string }) => {
			getOrThrow(
				evolu.update("posBill", {
					id: props.billId as Id,
					label: props.label.trim() === "" ? null : props.label,
				}),
			);
		},
		setBillTable: (props: { billId: string; tableId: Id | null }) => {
			getOrThrow(
				evolu.update("posBill", {
					id: props.billId as Id,
					tableId: props.tableId,
				}),
			);
		},
		setBillCurrency: (props: { billId: string; currency: Currency }) => {
			getOrThrow(
				evolu.update("posBill", {
					id: props.billId as Id,
					currency: props.currency,
				}),
			);
		},
		setBillRate: (props: {
			billId: string;
			currency: Currency;
			rate: number;
		}) => {
			if (!Number.isFinite(props.rate) || props.rate <= 0) {
				return;
			}

			getOrThrow(
				evolu.upsert("posBillRate", {
					id: createIdFromString(
						`posBillRate:${props.billId}:${props.currency}`,
					),
					billId: props.billId as Id,
					currency: props.currency,
					rate: props.rate,
				}),
			);
		},
	};
};
