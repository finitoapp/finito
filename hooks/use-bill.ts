import { createIdFromString, sqliteTrue } from "@evolu/common";
import { useAtomValue } from "jotai";
import { accountAtom } from "@/atoms/account";
import { useEvolu } from "@/hooks/use-evolu";
import { type PosBill, usePosRows } from "@/hooks/use-pos";
import type { EvoluSchemaType } from "@/lib/evolu";
import type { Id } from "@/lib/evolu/types";
import { createItemRevision } from "@/lib/item/service";
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

	const createPosBillItemLineChange = (props: {
		billId: Id;
		itemRevisionId: EvoluSchemaType["itemRevision"]["id"];
		itemId: EvoluSchemaType["itemRevision"]["itemId"];
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
			itemId: props.itemId,
			itemRevisionId: props.itemRevisionId,
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
		createBill: (props: { defaultCurrency: Currency }) => {
			return createBillInternal(props.defaultCurrency);
		},
		addExistingItem: (props: {
			item: PosBill["items"][number];
			quantity: number;
		}) => {
			createPosBillItemLineChange({
				billId: props.item.posBillId,
				itemRevisionId: props.item.itemRevisionId,
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
			item: EvoluSchemaType["itemRevision"];
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

			await createItemRevision({ evolu })({ item: props.item });

			createPosBillItemLineChange({
				billId: bill.id,
				itemRevisionId: props.item.id,
				itemId: props.item.itemId,
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
	};
};
