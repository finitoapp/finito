"use client";

import { sqliteTrue } from "@evolu/common";
import { useAtom, useAtomValue } from "jotai";
import { Trash2Icon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ReservationStateAtoms } from "@/app/admin/(private)/reservations/lib/state-atoms";
import { ReservationForm } from "@/app/admin/(private)/reservations/reservation-form";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useEvolu } from "@/hooks/use-evolu";
import { useGlobalDialog } from "@/hooks/use-global-dialog";

export const ReservationEditorDialog: React.FC<{
	stateAtoms: ReservationStateAtoms;
}> = (props) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const { withConfirm } = useGlobalDialog();
	const [dialogOpen, setDialogOpen] = useAtom(props.stateAtoms.dialogOpenAtom);
	const [draft, setDraft] = useAtom(props.stateAtoms.draftAtom);
	const editingReservationId = useAtomValue(
		props.stateAtoms.editingReservationIdAtom,
	);
	const reservations = useAtomValue(props.stateAtoms.reservationsAtom);
	const editingReservation = useMemo(
		() =>
			reservations.find(
				(reservation) => reservation.id === editingReservationId,
			) ?? null,
		[editingReservationId, reservations],
	);
	const timezone = useAtomValue(props.stateAtoms.timezoneAtom);
	const tableOptions = useAtomValue(props.stateAtoms.tableOptionsAtom);

	const removeReservation = useMemo(
		() =>
			withConfirm(
				async () => {
					if (editingReservationId === null) return;
					evolu.update("reservation", {
						id: editingReservationId,
						isDeleted: sqliteTrue,
					});
					if (editingReservation?._tag === "booking") {
						evolu.update("reservationBooking", {
							id: editingReservationId,
							isDeleted: sqliteTrue,
						});
					}
					if (editingReservation?._tag === "block") {
						evolu.update("reservationBlock", {
							id: editingReservationId,
							isDeleted: sqliteTrue,
						});
					}
					setDialogOpen(false);
					setDraft(null);
				},
				{
					title: t("reservations:page.delete.title"),
					description: t("reservations:page.delete.description"),
					confirmText: t("reservations:page.delete.confirm"),
					cancelText: t("reservations:page.delete.cancel"),
					confirmVariant: "destructive",
				},
			),
		[
			editingReservation?._tag,
			editingReservationId,
			evolu,
			setDialogOpen,
			setDraft,
			t,
			withConfirm,
		],
	);

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle>
						{editingReservationId === null
							? t("reservations:page.form.newTitle")
							: t("reservations:page.form.editTitle")}
					</DialogTitle>
				</DialogHeader>
				<div className="-mx-4 no-scrollbar max-h-[50vh] overflow-y-auto px-4">
					{draft !== null && (
						<ReservationForm
							key={`${editingReservationId ?? "new"}:${timezone}`}
							defaultValues={draft}
							timezone={timezone}
							tables={tableOptions}
							onSuccess={() => {
								setDialogOpen(false);
								setDraft(null);
							}}
						/>
					)}

					{editingReservationId !== null && (
						<div className="flex justify-end">
							<Button
								type="button"
								variant="destructive"
								onClick={removeReservation}
							>
								<Trash2Icon />
								{t("reservations:page.delete.confirm")}
							</Button>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
