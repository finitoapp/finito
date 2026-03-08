import { useSetAtom } from "jotai";
import { useCallback } from "react";
import {
	type GlobalAlertDialog,
	type GlobalConfirmDialog,
	type GlobalDialogDefinition,
	openGlobalDialogAtom,
} from "@/atoms/global-dialog";

export const useGlobalDialog = () => {
	const openDialog = useSetAtom(openGlobalDialogAtom);

	const showDialog = useCallback(
		(definition: GlobalDialogDefinition) =>
			new Promise<boolean>((resolve) => {
				openDialog({ definition, resolve });
			}),
		[openDialog],
	);

	const alert = useCallback(
		(params: Omit<GlobalAlertDialog, "type">) =>
			showDialog({ type: "alert", ...params }).then(() => undefined),
		[showDialog],
	);

	const confirm = useCallback(
		(params: Omit<GlobalConfirmDialog, "type">) =>
			showDialog({ type: "confirm", ...params }),
		[showDialog],
	);

	const withConfirm = useCallback(
		<TArgs extends unknown[], TResult>(
			handler: (...args: TArgs) => TResult | Promise<TResult>,
			dialog: Omit<GlobalConfirmDialog, "type">,
		) => {
			return async (...args: TArgs): Promise<TResult | undefined> => {
				const accepted = await confirm(dialog);
				if (!accepted) {
					return undefined;
				}

				return await handler(...args);
			};
		},
		[confirm],
	);

	return {
		alert,
		confirm,
		showDialog,
		withConfirm,
	};
};
