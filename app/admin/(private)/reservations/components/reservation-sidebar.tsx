"use client";

import type { Id } from "@evolu/common";
import { useAtomValue, useSetAtom } from "jotai";
import {
	ArrowLeftIcon,
	CheckIcon,
	CircleDashedIcon,
	MapPinnedIcon,
	PencilIcon,
	UserCheckIcon,
	XIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toLocalTimeLabel } from "@/app/admin/(private)/reservations/lib/calendar-math";
import type { ReservationStateAtoms } from "@/app/admin/(private)/reservations/lib/state-atoms";
import { Button } from "@/components/ui/button";
import { useEvolu } from "@/hooks/use-evolu";
import { ReservationOperationsPanel } from "./reservation-operations-panel";

const ReservationDetailPanel: React.FC<{
	stateAtoms: ReservationStateAtoms;
	reservationId: Id;
}> = (props) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const reservation = useAtomValue(
		props.stateAtoms.reservationByIdAtomFamily(props.reservationId),
	);
	const timezone = useAtomValue(props.stateAtoms.timezoneAtom);
	const tableLabelById = useAtomValue(props.stateAtoms.tableLabelByIdAtom);
	const setSelectedReservationId = useSetAtom(
		props.stateAtoms.selectedReservationIdAtom,
	);
	const openEditDialog = useSetAtom(props.stateAtoms.openEditDialogAtom);

	if (reservation === null) {
		return (
			<div className="rounded-lg border">
				<div className="border-b px-4 py-3">
					<h3 className="font-medium">
						{t("reservations:page.details.title")}
					</h3>
				</div>
				<div className="p-3 text-sm text-muted-foreground">
					{t("reservations:page.details.notFound")}
				</div>
			</div>
		);
	}

	const tableLabel =
		reservation.tableId === null
			? t("reservations:form.table.unassigned")
			: (tableLabelById.get(reservation.tableId) ??
				t("reservations:form.table.unassigned"));
	const isBooking = reservation._tag === "booking";
	const canAssignTable = isBooking && reservation.tableId === null;
	const canApprove =
		isBooking &&
		reservation.approvalStatus !== "approved" &&
		reservation.tableId !== null;
	const canReject = isBooking && reservation.approvalStatus !== "rejected";
	const canMarkSeated =
		isBooking &&
		reservation.approvalStatus === "approved" &&
		reservation.serviceStatus === "upcoming";
	const canMarkCompleted =
		isBooking &&
		reservation.approvalStatus === "approved" &&
		reservation.serviceStatus === "seated";
	const canMarkNoShow =
		isBooking &&
		reservation.approvalStatus === "approved" &&
		reservation.serviceStatus === "upcoming";

	return (
		<div className="rounded-lg border">
			<div className="flex items-center justify-between gap-2 border-b px-4 py-3">
				<h3 className="font-medium">{t("reservations:page.details.title")}</h3>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 px-2 text-xs"
					onClick={() => setSelectedReservationId(null)}
				>
					<ArrowLeftIcon />
					{t("reservations:page.details.back")}
				</Button>
			</div>
			<div className="space-y-3 p-3 text-sm">
				<div>
					<div className="text-xs text-muted-foreground">
						{reservation._tag === "booking"
							? t("reservations:form.fields.name")
							: t("reservations:form.fields.label")}
					</div>
					<div className="font-medium">
						{reservation._tag === "booking"
							? reservation.name
							: reservation.label}
					</div>
				</div>
				<div>
					<div className="text-xs text-muted-foreground">
						{t("reservations:page.details.time")}
					</div>
					<div className="font-medium">
						{toLocalTimeLabel(reservation.startAt, timezone)} -{" "}
						{toLocalTimeLabel(reservation.endAt, timezone)}
					</div>
				</div>
				<div>
					<div className="text-xs text-muted-foreground">
						{t("reservations:form.fields.tableId")}
					</div>
					<div className="font-medium">{tableLabel}</div>
				</div>
				{reservation._tag === "booking" && (
					<>
						<div>
							<div className="text-xs text-muted-foreground">
								{t("reservations:form.fields.numberOfPeople")}
							</div>
							<div className="font-medium">{reservation.numberOfPeople}</div>
						</div>
						<div>
							<div className="text-xs text-muted-foreground">
								{t("reservations:form.fields.phone")}
							</div>
							<div className="font-medium">{reservation.phone ?? "—"}</div>
						</div>
						<div>
							<div className="text-xs text-muted-foreground">
								{t("reservations:form.fields.email")}
							</div>
							<div className="font-medium">{reservation.email ?? "—"}</div>
						</div>
						<div>
							<div className="text-xs text-muted-foreground">
								{t("reservations:form.fields.approvalStatus")}
							</div>
							<div className="font-medium">
								{t(
									`reservations:form.approval.${reservation.approvalStatus}` as const,
								)}
							</div>
						</div>
						<div>
							<div className="text-xs text-muted-foreground">
								{t("reservations:form.fields.serviceStatus")}
							</div>
							<div className="font-medium">
								{t(
									`reservations:form.service.${reservation.serviceStatus}` as const,
								)}
							</div>
						</div>
					</>
				)}
				<div>
					<div className="text-xs text-muted-foreground">
						{t("reservations:form.fields.note")}
					</div>
					<div className="font-medium">{reservation.note || "—"}</div>
				</div>
				<div>
					<div className="mb-2 text-xs text-muted-foreground">
						{t("reservations:page.details.quickActions")}
					</div>
					<div className="flex flex-wrap gap-1">
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="h-7 px-2 text-xs"
							onClick={() => openEditDialog(reservation)}
						>
							<PencilIcon />
							{t("reservations:page.actions.edit")}
						</Button>
						{isBooking && (
							<>
								{canAssignTable && (
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="h-7 px-2 text-xs"
										onClick={() => openEditDialog(reservation)}
									>
										<MapPinnedIcon />
										{t("reservations:page.actions.assignTable")}
									</Button>
								)}
								{canApprove && (
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="h-7 px-2 text-xs"
										onClick={() => {
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
								{canReject && (
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="h-7 px-2 text-xs"
										onClick={() => {
											evolu.update("reservationBooking", {
												id: reservation.id,
												approvalStatus: "rejected",
											});
										}}
									>
										<XIcon />
										{t("reservations:page.actions.rejectReservation")}
									</Button>
								)}
								{canMarkSeated && (
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="h-7 px-2 text-xs"
										onClick={() => {
											evolu.update("reservationBooking", {
												id: reservation.id,
												serviceStatus: "seated",
											});
										}}
									>
										<UserCheckIcon />
										{t("reservations:page.actions.markSeated")}
									</Button>
								)}
								{canMarkCompleted && (
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="h-7 px-2 text-xs"
										onClick={() => {
											evolu.update("reservationBooking", {
												id: reservation.id,
												serviceStatus: "completed",
											});
										}}
									>
										<CheckIcon />
										{t("reservations:page.actions.markCompleted")}
									</Button>
								)}
								{canMarkNoShow && (
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="h-7 px-2 text-xs"
										onClick={() => {
											evolu.update("reservationBooking", {
												id: reservation.id,
												serviceStatus: "noShow",
											});
										}}
									>
										<CircleDashedIcon />
										{t("reservations:page.actions.markNoShow")}
									</Button>
								)}
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export const ReservationSidebar: React.FC<{
	stateAtoms: ReservationStateAtoms;
}> = (props) => {
	const selectedReservationId = useAtomValue(
		props.stateAtoms.selectedReservationIdAtom,
	);

	if (selectedReservationId === null) {
		return <ReservationOperationsPanel stateAtoms={props.stateAtoms} />;
	}

	return (
		<ReservationDetailPanel
			stateAtoms={props.stateAtoms}
			reservationId={selectedReservationId}
		/>
	);
};
