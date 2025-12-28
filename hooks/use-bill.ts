import { useSetAtom } from "jotai";
import { type Pos, posAtom } from "@/atoms/pos";
import { type Currency, Uuid7 } from "@/lib/types";
import type { Item } from "@/storages/item-storage";

export const createEmptyBill = (props: {
	defaultCurrency: Currency;
}): Pos["bills"][string] => ({
	id: 1,
	label: ``,
	items: [],
	currency: props.defaultCurrency,
	rates: {},
});

export const useBill = () => {
	const setPos = useSetAtom(posAtom);

	return {
		deleteBill: (billId: string) => {
			void setPos((prev) => {
				const bills = {
					...prev.bills,
				};
				delete bills[billId];

				return {
					...prev,
					bills,
				};
			});
		},
		createBill: (props: { defaultCurrency: Currency }) => {
			const billId = Uuid7.random();

			setPos((previous) => {
				let maxId = 0;

				for (const bill of Object.values(previous.bills)) {
					if (bill.id > maxId) {
						maxId = bill.id;
					}
				}

				return {
					...previous,
					bills: {
						...previous.bills,
						[billId]: {
							...createEmptyBill(props),
							id: maxId + 1,
						},
					},
				};
			});

			return billId;
		},
		addItem: (props: {
			billId: Uuid7;
			defaultCurrency: Currency;
			item: Item;
		}) => {
			setPos((prev) => {
				const billId = props.billId ?? Uuid7.random();
				const currentBill = prev.bills[billId] ?? createEmptyBill(props);

				const index = currentBill.items.findIndex(
					(billItem) => billItem.id === props.item.id,
				);
				if (index !== -1) {
					return {
						...prev,
						bills: {
							...prev.bills,
							[billId]: {
								...currentBill,
								items: [
									...currentBill.items.slice(0, index),
									{
										...currentBill.items[index],
										quantity: currentBill.items[index].quantity + 1,
									},
									...currentBill.items.slice(index + 1),
								],
							},
						},
					};
				}

				return {
					...prev,
					bills: {
						...prev.bills,
						[billId]: {
							...currentBill,
							items: [
								...currentBill.items,
								{
									id: props.item.id,
									currency: props.item.price.currency,
									name: props.item.label,
									price: props.item.price.value,
									quantity: 1,
								},
							],
						},
					},
				};
			});
		},
	};
};
