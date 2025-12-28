import { atom } from "jotai";
import type {
	PaymentFinished,
	PaymentReady,
} from "@/storages/payment-progress-storage";

export const createSelectedItemsAtom = () => atom({} as Record<string, number>);
export const createSelectedTipAtom = () => atom(0);
export const createPaymentReadyAtom = () =>
	atom<undefined | null | PaymentReady>(undefined); // null means loading
export const createPaymentFinishedAtom = () =>
	atom<null | PaymentFinished>(null);
export const createLoadingAtom = (defaultValue: string | null) =>
	atom<null | string>(defaultValue);
export type SelectedItemsAtom = ReturnType<typeof createSelectedItemsAtom>;
export type SelectedTipAtom = ReturnType<typeof createSelectedTipAtom>;
export type PaymentReadyAtom = ReturnType<typeof createPaymentReadyAtom>;
export type PaymentFinishedAtom = ReturnType<typeof createPaymentFinishedAtom>;
export type LoadingAtom = ReturnType<typeof createLoadingAtom>;
