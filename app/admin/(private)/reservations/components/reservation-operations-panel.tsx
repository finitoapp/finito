"use client";

import type { Id } from "@evolu/common";
import { useAtomValue, useSetAtom } from "jotai";
import {
	CheckIcon,
	CircleDashedIcon,
	MapPinnedIcon,
	UserCheckIcon,
	XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toLocalTimeLabel } from "@/app/admin/(private)/reservations/lib/calendar-math";
import type { ReservationStateAtoms } from "@/app/admin/(private)/reservations/lib/state-atoms";
import { Button } from "@/components/ui/button";
import { useEvolu } from "@/hooks/use-evolu";

const NEAREST_LOOKBACK_MS = 30 * 60 * 1000;
const NEAREST_LIMIT = 8;

export const ReservationOperationsPanel: React.FC<{
	stateAtoms: ReservationStateAtoms;
}> = (props) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const timezone = useAtomValue(props.stateAtoms.timezoneAtom);
	const tableLabelById = useAtomValue(props.stateAtoms.tableLabelByIdAtom);
	const pendingBookings = useAtomValue(
		props.stateAtoms.pendingBookingReservationsAtom,
	);
	const approvedWithoutTableBookings = useAtomValue(
		props.stateAtoms.approvedBookingWithoutTableAtom,
	);
	const upcomingOperationalBookings = useAtomValue(
		props.stateAtoms.upcomingOperationalBookingReservationsAtom,
	);
	const seatedOperationalBookings = useAtomValue(
		props.stateAtoms.seatedOperationalBookingReservationsAtom,
	);
	const setSelectedReservationId = useSetAtom(
		props.stateAtoms.selectedReservationIdAtom,
	);
	const setFocusReservationRequest = useSetAtom(
		props.stateAtoms.focusReservationRequestAtom,
	);
	const setHighlightedCollisionIds = useSetAtom(
		props.stateAtoms.highlightedCollisionIdsAtom,
	);
	const setHighlightedCapacityIds = useSetAtom(
		props.stateAtoms.highlightedCapacityIdsAtom,
	);
	const openEditDialog = useSetAtom(props.stateAtoms.openEditDialogAtom);

	const [nowEpochMs, setNowEpochMs] = useState(() => Date.now());

	useEffect(() => {
		const timer = window.setInterval(() => {
			setNowEpochMs(Date.now());
		}, 30_000);
		return () => {
			window.clearInterval(timer);
		};
	}, []);

	const pendingFutureBookings = useMemo(
		() =>
			pendingBookings.filter((reservation) => reservation.startAt > nowEpochMs),
		[nowEpochMs, pendingBookings],
	);
	const nearestBookings = useMemo(
		() =>
			upcomingOperationalBookings
				.filter(
					(reservation) =>
						reservation.startAt >= nowEpochMs - NEAREST_LOOKBACK_MS,
				)
				.slice(0, NEAREST_LIMIT),
		[nowEpochMs, upcomingOperationalBookings],
	);
	const seatedBookings = useMemo(
		() => seatedOperationalBookings.slice(0, NEAREST_LIMIT),
		[seatedOperationalBookings],
	);

	const focusReservation = (id: Id) => {
		setHighlightedCollisionIds([]);
		setHighlightedCapacityIds([]);
		setSelectedReservationId(id);
		setFocusReservationRequest(id);
	};

	const getTableLabel = (tableId: Id | null) =>
		tableId === null
			? t("reservations:form.table.unassigned")
			: (tableLabelById.get(tableId) ??
				t("reservations:form.table.unassigned"));

	return (
		<div className="rounded-lg border">
			<div className="border-b px-4 py-3">
				<h3 className="font-medium">
					{t("reservations:page.operations.title")}
				</h3>
			</div>
			<div className="space-y-4 p-3">
				{approvedWithoutTableBookings.length > 0 && (
					<div>
						<div className="mb-2 text-sm font-medium text-orange-700">
							{t("reservations:page.operations.invalidTitle")}
						</div>
						<div className="space-y-2">
							{approvedWithoutTableBookings.map((reservation) => (
								<div
									key={reservation.id}
									className="rounded-md border border-orange-500/30 bg-orange-500/10 p-2 text-xs"
								>
									<button
										type="button"
										className="w-full cursor-pointer text-left"
										onClick={() => focusReservation(reservation.id)}
									>
										<div className="font-medium">
											{reservation.name} ({reservation.numberOfPeople})
										</div>
										<div className="text-muted-foreground">
											{toLocalTimeLabel(reservation.startAt, timezone)} -{" "}
											{toLocalTimeLabel(reservation.endAt, timezone)} •{" "}
											{t("reservations:form.table.unassigned")}
										</div>
									</button>
									<div className="mt-2 flex flex-wrap gap-1">
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="h-7 px-2 text-xs"
											onClick={(event) => {
												event.stopPropagation();
												openEditDialog(reservation);
											}}
										>
											<MapPinnedIcon />
											{t("reservations:page.actions.assignTable")}
										</Button>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				<div>
					<div className="mb-2 text-sm font-medium">
						{t("reservations:page.operations.pendingTitle")}
					</div>
					<div className="space-y-2">
						{pendingFutureBookings.length === 0 ? (
							<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
								{t("reservations:page.operations.pendingEmpty")}
							</div>
						) : (
							pendingFutureBookings.map((reservation) => (
								<div
									key={reservation.id}
									className="rounded-md border p-2 text-xs hover:bg-muted/30"
								>
									<button
										type="button"
										className="w-full cursor-pointer text-left"
										onClick={() => focusReservation(reservation.id)}
									>
										<div className="font-medium">
											{reservation.name} ({reservation.numberOfPeople})
										</div>
										<div className="text-muted-foreground">
											{toLocalTimeLabel(reservation.startAt, timezone)} -{" "}
											{toLocalTimeLabel(reservation.endAt, timezone)} •{" "}
											{getTableLabel(reservation.tableId)}
										</div>
									</button>
									<div className="mt-2 flex gap-1">
										{reservation.tableId === null ? (
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="h-7 px-2 text-xs"
												onClick={(event) => {
													event.stopPropagation();
													openEditDialog(reservation);
												}}
											>
												<MapPinnedIcon />
												{t("reservations:page.actions.assignTable")}
											</Button>
										) : (
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="h-7 px-2 text-xs"
												onClick={(event) => {
													event.stopPropagation();
													evolu.update("reservationBooking", {
														id: reservation.id,
														approvalStatus: "approved",
														statusReason: null,
													});
												}}
											>
												<CheckIcon />
												{t("reservations:page.actions.approveReservation")}
											</Button>
										)}
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="h-7 px-2 text-xs"
											onClick={(event) => {
												event.stopPropagation();
												evolu.update("reservationBooking", {
													id: reservation.id,
													approvalStatus: "rejected",
												});
											}}
										>
											<XIcon />
											{t("reservations:page.actions.rejectReservation")}
										</Button>
									</div>
								</div>
							))
						)}
					</div>
				</div>

				<div>
					<div className="mb-2 text-sm font-medium">
						{t("reservations:page.operations.nearestTitle")}
					</div>
					<div className="space-y-2">
						{nearestBookings.length === 0 ? (
							<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
								{t("reservations:page.operations.nearestEmpty")}
							</div>
						) : (
							nearestBookings.map((reservation) => (
								<div
									key={reservation.id}
									className="rounded-md border p-2 text-xs hover:bg-muted/30"
								>
									<button
										type="button"
										className="w-full cursor-pointer text-left"
										onClick={() => focusReservation(reservation.id)}
									>
										<div className="font-medium">
											{reservation.name} ({reservation.numberOfPeople})
										</div>
										<div className="text-muted-foreground">
											{toLocalTimeLabel(reservation.startAt, timezone)} -{" "}
											{toLocalTimeLabel(reservation.endAt, timezone)} •{" "}
											{getTableLabel(reservation.tableId)}
										</div>
									</button>
									<div className="mt-2 flex flex-wrap gap-1">
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="h-7 px-2 text-xs"
											onClick={(event) => {
												event.stopPropagation();
												evolu.update("reservationBooking", {
													id: reservation.id,
													serviceStatus: "seated",
												});
											}}
										>
											<UserCheckIcon />
											{t("reservations:page.actions.markSeated")}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="h-7 px-2 text-xs"
											onClick={(event) => {
												event.stopPropagation();
												evolu.update("reservationBooking", {
													id: reservation.id,
													serviceStatus: "noShow",
												});
											}}
										>
											<CircleDashedIcon />
											{t("reservations:page.actions.markNoShow")}
										</Button>
									</div>
								</div>
							))
						)}
					</div>
				</div>

				<div>
					<div className="mb-2 text-sm font-medium">
						{t("reservations:page.operations.seatedTitle")}
					</div>
					<div className="space-y-2">
						{seatedBookings.length === 0 ? (
							<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
								{t("reservations:page.operations.seatedEmpty")}
							</div>
						) : (
							seatedBookings.map((reservation) => (
								<div
									key={reservation.id}
									className="rounded-md border p-2 text-xs hover:bg-muted/30"
								>
									<button
										type="button"
										className="w-full cursor-pointer text-left"
										onClick={() => focusReservation(reservation.id)}
									>
										<div className="font-medium">
											{reservation.name} ({reservation.numberOfPeople})
										</div>
										<div className="text-muted-foreground">
											{toLocalTimeLabel(reservation.startAt, timezone)} -{" "}
											{toLocalTimeLabel(reservation.endAt, timezone)} •{" "}
											{getTableLabel(reservation.tableId)}
										</div>
									</button>
									<div className="mt-2 flex flex-wrap gap-1">
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="h-7 px-2 text-xs"
											onClick={(event) => {
												event.stopPropagation();
												evolu.update("reservationBooking", {
													id: reservation.id,
													serviceStatus: "completed",
												});
											}}
										>
											<CheckIcon />
											{t("reservations:page.actions.markCompleted")}
										</Button>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
};
