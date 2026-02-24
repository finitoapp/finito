import { atom } from "jotai";
import type {
	PaymentFinished,
	PaymentReady,
} from "@/lib/evolu/model/payment-progress";

export const createSelectedItemsAtom = () => atom({} as Record<string, number>);
export const createSelectedTipAtom = () => atom(0);
atom<undefined | null | PaymentReady>(undefined); // null means loading
atom<null | PaymentFinished>(null);
export const createLoadingAtom = (defaultValue: string | null) =>
	atom<null | string>(defaultValue);
export type SelectedItemsAtom = ReturnType<typeof createSelectedItemsAtom>;
export type SelectedTipAtom = ReturnType<typeof createSelectedTipAtom>;
export type LoadingAtom = ReturnType<typeof createLoadingAtom>;
