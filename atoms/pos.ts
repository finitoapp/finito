import type { Id } from "@evolu/common";
import { atomWithStorage } from "jotai/utils";
import type { Currency, NonEmptyString } from "@/lib/types";

type Item = {
	id: string;
	name: string;
	price: number;
	quantity: number;
	currency: Currency;
};

type Bill = {
	id: number; // autoincrement
	label: string;
	items: Item[];
	currency: Currency; // primal currency
	rates: Partial<Record<Currency, number>>;
	table?: {
		id: Id;
		name: NonEmptyString;
	};
};

export type Pos = {
	bills: Record<string, Bill>;
};

export const posAtom = atomWithStorage<Pos>(
	"pos",
	{
		bills: {},
	},
	undefined,
	{
		getOnInit: true,
	},
);
