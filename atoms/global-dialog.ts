import type { VariantProps } from "class-variance-authority";
import { atom } from "jotai";
import type { ReactNode } from "react";
import type { buttonVariants } from "@/components/ui/button";

export type GlobalDialogBase = {
	title: ReactNode;
	description?: ReactNode;
	confirmText?: string;
	cancelText?: string;
	confirmVariant?: VariantProps<typeof buttonVariants>["variant"];
};

export type GlobalAlertDialog = GlobalDialogBase & {
	type: "alert";
};

export type GlobalConfirmDialog = GlobalDialogBase & {
	type: "confirm";
};

export type GlobalDialogDefinition = GlobalAlertDialog | GlobalConfirmDialog;

type GlobalDialogRequest = {
	id: number;
	definition: GlobalDialogDefinition;
	resolve: (accepted: boolean) => void;
};

let nextGlobalDialogId = 1;

export const globalDialogAtom = atom<GlobalDialogRequest | null>(null);

export const openGlobalDialogAtom = atom(
	null,
	(
		_get,
		set,
		params: {
			definition: GlobalDialogDefinition;
			resolve: (accepted: boolean) => void;
		},
	) => {
		set(globalDialogAtom, {
			id: nextGlobalDialogId++,
			definition: params.definition,
			resolve: params.resolve,
		});
	},
);

export const closeGlobalDialogAtom = atom(
	null,
	(get, set, accepted: boolean) => {
		const currentDialog = get(globalDialogAtom);
		if (!currentDialog) {
			return;
		}

		set(globalDialogAtom, null);
		currentDialog.resolve(accepted);
	},
);
