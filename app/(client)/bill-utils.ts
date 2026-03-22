import { atom } from "jotai";

export const createSelectedItemsAtom = () => atom({} as Record<string, number>);
export const createSelectedTipAtom = () => atom(0);

export type SelectedItemsAtom = ReturnType<typeof createSelectedItemsAtom>;
export type SelectedTipAtom = ReturnType<typeof createSelectedTipAtom>;
