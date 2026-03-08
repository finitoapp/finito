"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { PencilIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toLocalTimeLabel } from "@/app/admin/(private)/reservations/lib/calendar-math";
import type { ReservationStateAtoms } from "@/app/admin/(private)/reservations/lib/state-atoms";
import { Button } from "@/components/ui/button";

export const UnassignedReservationsPanel: React.FC<{
	stateAtoms: ReservationStateAtoms;
}> = (props) => {
	const { t } = useTranslation();
	const timezone = useAtomValue(props.stateAtoms.timezoneAtom);
	const unassignedReservations = useAtomValue(
		props.stateAtoms.unassignedReservationsAtom,
	);
	const openEditDialog = useSetAtom(props.stateAtoms.openEditDialogAtom);

	return (
		<div className="rounded-lg border">
			<div className="border-b px-4 py-3">
				<h3 className="font-medium">
					{t("reservations:page.calendar.unassigned.title")}
				</h3>
			</div>
			<div className="space-y-2 p-3">
				{unassignedReservations.length === 0 ? (
					<div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
						{t("reservations:page.calendar.unassigned.empty")}
					</div>
				) : (
					unassignedReservations.map((reservation) => (
						<div key={reservation.id} className="rounded-md border p-3 text-sm">
							<div className="font-medium">
								{reservation._tag === "booking"
									? reservation.name
									: reservation.label}
							</div>
							<div className="text-muted-foreground">
								{toLocalTimeLabel(reservation.startAt, timezone)} -{" "}
								{toLocalTimeLabel(reservation.endAt, timezone)}
								{reservation._tag === "booking"
									? ` • ${reservation.numberOfPeople}`
									: ` • ${t("reservations:form.tag.reservationBlock")}`}
							</div>
							{reservation._tag === "booking" && (
								<div className="text-xs text-muted-foreground">
									{t(
										`reservations:form.approval.${reservation.approvalStatus}` as const,
									)}
									{" · "}
									{t(
										`reservations:form.service.${reservation.serviceStatus}` as const,
									)}
								</div>
							)}
							<div className="mt-2">
								<Button
									size="sm"
									variant="outline"
									onClick={() => openEditDialog(reservation)}
								>
									<PencilIcon />
									{t("reservations:page.actions.edit")}
								</Button>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
};
