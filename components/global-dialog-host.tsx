"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { closeGlobalDialogAtom, globalDialogAtom } from "@/atoms/global-dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function GlobalDialogHost() {
	const currentDialog = useAtomValue(globalDialogAtom);
	const closeDialog = useSetAtom(closeGlobalDialogAtom);
	const [lastDialog, setLastDialog] = useState(currentDialog);

	useEffect(() => {
		if (currentDialog !== null) {
			setLastDialog(currentDialog);
		}
	}, [currentDialog]);

	const definition = currentDialog?.definition ?? lastDialog?.definition;

	if (definition === undefined) {
		return null;
	}

	return (
		<AlertDialog
			open={currentDialog !== null}
			onOpenChange={(open) => {
				if (!open) {
					closeDialog(false);
				}
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{definition?.title}</AlertDialogTitle>
					{definition?.description !== undefined ? (
						<AlertDialogDescription>
							{definition.description}
						</AlertDialogDescription>
					) : null}
				</AlertDialogHeader>
				<AlertDialogFooter>
					{definition?.type === "confirm" ? (
						<AlertDialogCancel
							onClick={() => {
								closeDialog(false);
							}}
						>
							{definition.cancelText ?? "Cancel"}
						</AlertDialogCancel>
					) : null}
					<AlertDialogAction
						variant={definition?.confirmVariant}
						onClick={() => {
							closeDialog(true);
						}}
					>
						{definition?.confirmText ?? "OK"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
