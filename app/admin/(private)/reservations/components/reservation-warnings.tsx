"use client";

import type { Id } from "@evolu/common";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReservationIssueSummary } from "@/app/admin/(private)/reservations/lib/reservation-rules";
import type { ReservationStateAtoms } from "@/app/admin/(private)/reservations/lib/state-atoms";
import { Button } from "@/components/ui/button";

const IssueWarning: React.FC<{
	count: number;
	message: string;
	actionLabel: string;
	actionVariant: React.ComponentProps<typeof Button>["variant"];
	actionClassName?: string;
	onAction: () => void;
	className: string;
}> = ({
	count,
	message,
	actionLabel,
	actionVariant,
	actionClassName,
	onAction,
	className,
}) => {
	if (count <= 0) return null;
	return (
		<div className={className}>
			<div className="flex items-center justify-between gap-3">
				<div>{message}</div>
				<Button
					type="button"
					size="sm"
					variant={actionVariant}
					className={actionClassName}
					onClick={onAction}
				>
					{actionLabel}
				</Button>
			</div>
		</div>
	);
};

const createFocusHandler = (params: {
	issues: ReservationIssueSummary;
	setHighlightedIds: (value: readonly Id[]) => void;
	setSelectedReservationId: (value: Id) => void;
	setFocusReservationRequest: (value: Id) => void;
}) => {
	const firstId = params.issues.orderedIds[0];
	if (firstId === undefined) return;
	params.setHighlightedIds(params.issues.orderedIds);
	params.setSelectedReservationId(firstId);
	params.setFocusReservationRequest(firstId);
};

export const ReservationWarnings: React.FC<{
	stateAtoms: ReservationStateAtoms;
}> = (props) => {
	const { t } = useTranslation();
	const collisions = useAtomValue(props.stateAtoms.collisionsAtom);
	const tables = useAtomValue(props.stateAtoms.tablesAtom);
	const capacityViolations = useAtomValue(
		props.stateAtoms.capacityViolationsAtom,
	);
	const approvedWithoutTableBookings = useAtomValue(
		props.stateAtoms.approvedBookingWithoutTableAtom,
	);
	const setHighlightedCollisionIds = useSetAtom(
		props.stateAtoms.highlightedCollisionIdsAtom,
	);
	const setHighlightedCapacityIds = useSetAtom(
		props.stateAtoms.highlightedCapacityIdsAtom,
	);
	const setSelectedReservationId = useSetAtom(
		props.stateAtoms.selectedReservationIdAtom,
	);
	const setFocusReservationRequest = useSetAtom(
		props.stateAtoms.focusReservationRequestAtom,
	);
	const openEditDialog = useSetAtom(props.stateAtoms.openEditDialogAtom);
	const openTableDialog = useSetAtom(props.stateAtoms.openTableDialogAtom);
	const [nowEpochMs, setNowEpochMs] = useState(() => Date.now());

	useEffect(() => {
		const timer = window.setInterval(() => {
			setNowEpochMs(Date.now());
		}, 30_000);
		return () => {
			window.clearInterval(timer);
		};
	}, []);

	const futureApprovedWithoutTableBookings = useMemo(
		() =>
			approvedWithoutTableBookings.filter(
				(reservation) => reservation.startAt > nowEpochMs,
			),
		[approvedWithoutTableBookings, nowEpochMs],
	);

	return (
		<>
			<IssueWarning
				count={tables.length === 0 ? 1 : 0}
				className="mb-4 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700"
				message={t("reservations:page.calendar.noTablesWarning")}
				actionLabel={t("reservations:page.actions.addTable")}
				actionVariant={"outline"}
				actionClassName="border-yellow-600/50 text-yellow-800 hover:bg-yellow-500/10"
				onAction={() => openTableDialog()}
			/>
			<IssueWarning
				count={collisions.count}
				className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				message={t("reservations:page.calendar.collisionWarning", {
					count: collisions.count,
				})}
				actionLabel={t("reservations:page.calendar.collisionAction")}
				actionVariant={"destructive"}
				onAction={() =>
					createFocusHandler({
						issues: collisions,
						setHighlightedIds: setHighlightedCollisionIds,
						setSelectedReservationId,
						setFocusReservationRequest,
					})
				}
			/>
			<IssueWarning
				count={futureApprovedWithoutTableBookings.length}
				className="mb-4 rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-700"
				message={t("reservations:page.calendar.approvedWithoutTableWarning", {
					count: futureApprovedWithoutTableBookings.length,
				})}
				actionLabel={t("reservations:page.calendar.approvedWithoutTableAction")}
				actionVariant={"outline"}
				actionClassName="border-orange-500/60 text-orange-800 hover:bg-orange-500/10"
				onAction={() => {
					const targetReservation = futureApprovedWithoutTableBookings[0];
					if (targetReservation === undefined) return;
					openEditDialog(targetReservation);
				}}
			/>
			<IssueWarning
				count={capacityViolations.count}
				className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700"
				message={t("reservations:page.calendar.capacityWarning", {
					count: capacityViolations.count,
				})}
				actionLabel={t("reservations:page.calendar.capacityAction")}
				actionVariant={"outline"}
				actionClassName="border-amber-500/60 text-amber-800 hover:bg-amber-500/10"
				onAction={() =>
					createFocusHandler({
						issues: capacityViolations,
						setHighlightedIds: setHighlightedCapacityIds,
						setSelectedReservationId,
						setFocusReservationRequest,
					})
				}
			/>
		</>
	);
};
