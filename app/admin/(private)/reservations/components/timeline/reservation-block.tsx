"use client";

import { getOrThrow, type Id } from "@evolu/common";
import { AnimatePresence, motion } from "framer-motion";
import { useAtomValue, useSetAtom } from "jotai";
import {
	ArrowLeftRightIcon,
	CheckIcon,
	MoveIcon,
	PencilIcon,
	XIcon,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createLongPressTracker } from "@/app/admin/(private)/reservations/lib/long-press-tracker";
import type { ReservationStateAtoms } from "@/app/admin/(private)/reservations/lib/state-atoms";
import type {
	DragMode,
	ReservationVm,
} from "@/app/admin/(private)/reservations/lib/types";
import { withWindowPointerSession } from "@/app/admin/(private)/reservations/lib/window-pointer-session";
import { useEvolu } from "@/hooks/use-evolu";
import { cn } from "@/lib/shared/ui/cn";

const RESERVATION_EDIT_LONG_PRESS_MS = 700;
const RESERVATION_EDIT_LONG_PRESS_MOVE_THRESHOLD_PX = 4;

export type BeginDrag = (
	event: React.PointerEvent<HTMLElement>,
	args: {
		reservation: ReservationVm;
		mode: DragMode;
	},
) => void;

export const ReservationBlock: React.FC<{
	reservationId: Id;
	stateAtoms: ReservationStateAtoms;
	dayRange: { openMs: number; closeMs: number };
	rowHeightPx: number;
	beginDrag: BeginDrag;
	registerReservationElement: (id: Id, element: HTMLDivElement | null) => void;
}> = ({
	reservationId,
	stateAtoms,
	dayRange,
	rowHeightPx,
	beginDrag,
	registerReservationElement,
}) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const reservation = useAtomValue(
		stateAtoms.reservationByIdAtomFamily(reservationId),
	);
	const isSelected = useAtomValue(
		stateAtoms.isSelectedReservationAtomFamily(reservationId),
	);
	const isCollision = useAtomValue(
		stateAtoms.isCollisionReservationAtomFamily(reservationId),
	);
	const isCapacityViolation = useAtomValue(
		stateAtoms.isCapacityViolationReservationAtomFamily(reservationId),
	);
	const isHighlightedCollision = useAtomValue(
		stateAtoms.isHighlightedCollisionReservationAtomFamily(reservationId),
	);
	const isHighlightedCapacity = useAtomValue(
		stateAtoms.isHighlightedCapacityReservationAtomFamily(reservationId),
	);
	const setSelectedReservationId = useSetAtom(
		stateAtoms.selectedReservationIdAtom,
	);
	const setHighlightedCollisionIds = useSetAtom(
		stateAtoms.highlightedCollisionIdsAtom,
	);
	const setHighlightedCapacityIds = useSetAtom(
		stateAtoms.highlightedCapacityIdsAtom,
	);
	const openEditDialog = useSetAtom(stateAtoms.openEditDialogAtom);
	const longPressTriggeredRef = useRef(false);
	const cleanupSessionRef = useRef<(() => void) | null>(null);
	const stopLongPressRef = useRef<(() => void) | null>(null);
	const [editLongPressProgress, setEditLongPressProgress] = useState<
		number | null
	>(null);

	useEffect(
		() => () => {
			stopLongPressRef.current?.();
			stopLongPressRef.current = null;
			cleanupSessionRef.current?.();
			cleanupSessionRef.current = null;
		},
		[],
	);

	if (reservation === null) {
		return null;
	}
	const isBlock = reservation._tag === "reservationBlock";
	const isRejected =
		reservation._tag === "reservationBooking" &&
		reservation.approvalStatus === "rejected";
	const isPending =
		reservation._tag === "reservationBooking" &&
		reservation.approvalStatus === "pending";

	const visibleStart = Math.max(reservation.startAt, dayRange.openMs);
	const visibleEnd = Math.min(reservation.endAt, dayRange.closeMs);
	if (visibleEnd <= visibleStart) return null;

	const leftPercent =
		((visibleStart - dayRange.openMs) / (dayRange.closeMs - dayRange.openMs)) *
		100;
	const widthPercent =
		((visibleEnd - visibleStart) / (dayRange.closeMs - dayRange.openMs)) * 100;

	return (
		<div
			data-reservation-block="true"
			ref={(element) => registerReservationElement(reservation.id, element)}
			className={cn(
				"absolute rounded-md border px-1.5 text-[11px] shadow-sm",
				isCollision
					? "border-destructive bg-destructive/15 text-destructive"
					: isBlock
						? "border-slate-500/50 bg-slate-500/15 text-slate-800"
						: isRejected
							? "border-zinc-400/60 bg-zinc-400/15 text-zinc-700"
							: isPending
								? "border-amber-500/60 bg-amber-500/15 text-amber-900"
								: isCapacityViolation
									? "border-amber-500/60 bg-amber-500/15 text-amber-900"
									: "border-primary/40 bg-primary/15",
				isSelected && "ring-2 ring-primary/60 border-primary/60",
				isHighlightedCollision &&
					"ring-2 ring-destructive/70 border-destructive",
				isHighlightedCapacity && "ring-2 ring-amber-500/80 border-amber-500",
			)}
			style={{
				top: "2px",
				bottom: "2px",
				left: `calc(${leftPercent}% + 2px)`,
				width: `calc(${Math.max(widthPercent, 3)}% - 4px)`,
			}}
		>
			<AnimatePresence initial={false}>
				{isSelected && (
					<motion.div
						className="pointer-events-auto absolute left-1/2 z-40 flex items-center gap-1 rounded-md border bg-card p-1 shadow"
						data-pan-ignore="true"
						initial={{ opacity: 0, y: 6, x: "-50%" }}
						animate={{ opacity: 1, y: 0, x: "-50%" }}
						exit={{ opacity: 0, y: 6, x: "-50%" }}
						transition={{ duration: 0.18, ease: "easeOut" }}
						style={{ top: -Math.max(30, Math.round(rowHeightPx * 0.6)) }}
					>
						{reservation._tag === "reservationBooking" && (
							<>
								<button
									type="button"
									data-pan-ignore="true"
									title={t("reservations:page.actions.approveReservation")}
									aria-label={t("reservations:page.actions.approveReservation")}
									className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm border border-border/60 bg-background text-[10px] leading-none hover:bg-muted"
									onClick={(event) => {
										event.stopPropagation();
										getOrThrow(
											evolu.update("reservationBooking", {
												id: reservation.id,
												approvalStatus: "approved",
												statusReason: null,
											}),
										);
									}}
								>
									<CheckIcon className="h-3 w-3" />
								</button>
								<button
									type="button"
									data-pan-ignore="true"
									title={t("reservations:page.actions.rejectReservation")}
									aria-label={t("reservations:page.actions.rejectReservation")}
									className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm border border-border/60 bg-background text-[10px] leading-none hover:bg-muted"
									onClick={(event) => {
										event.stopPropagation();
										getOrThrow(
											evolu.update("reservationBooking", {
												id: reservation.id,
												approvalStatus: "rejected",
											}),
										);
									}}
								>
									<XIcon className="h-3 w-3" />
								</button>
							</>
						)}
						<button
							type="button"
							data-pan-ignore="true"
							title={t("reservations:page.actions.moveReservation")}
							aria-label={t("reservations:page.actions.moveReservation")}
							className="inline-flex h-6 w-6 cursor-move items-center justify-center rounded-sm border border-border/60 bg-background text-[10px] leading-none hover:bg-muted"
							onPointerDown={(event) => {
								event.stopPropagation();
								beginDrag(event, {
									reservation,
									mode: "move",
								});
							}}
						>
							<MoveIcon className="h-3 w-3" />
						</button>
						<button
							type="button"
							data-pan-ignore="true"
							title={t("reservations:page.actions.resizeReservation")}
							aria-label={t("reservations:page.actions.resizeReservation")}
							className="inline-flex h-6 w-6 cursor-ew-resize items-center justify-center rounded-sm border border-border/60 bg-background text-[10px] leading-none hover:bg-muted"
							onPointerDown={(event) => {
								event.stopPropagation();
								beginDrag(event, {
									reservation,
									mode: "resize",
								});
							}}
						>
							<ArrowLeftRightIcon className="h-3 w-3" />
						</button>
						<button
							type="button"
							data-pan-ignore="true"
							title={t("reservations:page.actions.edit")}
							aria-label={t("reservations:page.actions.edit")}
							className="ml-2 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm border border-border/60 bg-background text-[10px] leading-none hover:bg-muted"
							onClick={(event) => {
								event.stopPropagation();
								openEditDialog(reservation);
							}}
						>
							<PencilIcon className="h-3 w-3" />
						</button>
					</motion.div>
				)}
			</AnimatePresence>
			<button
				type="button"
				data-pan-ignore="true"
				className={cn(
					"h-full w-full rounded-sm px-1 text-start outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
					reservation._tag === "reservationBooking" &&
						"flex flex-col items-start justify-center gap-0.5 leading-tight",
				)}
				onPointerDown={(event) => {
					if (event.button !== 0) return;

					stopLongPressRef.current?.();
					stopLongPressRef.current = null;
					cleanupSessionRef.current?.();
					cleanupSessionRef.current = null;

					const longPress = createLongPressTracker({
						durationMs: RESERVATION_EDIT_LONG_PRESS_MS,
						moveThresholdPx: RESERVATION_EDIT_LONG_PRESS_MOVE_THRESHOLD_PX,
						startClientX: event.clientX,
						startClientY: event.clientY,
						onProgress: setEditLongPressProgress,
						onTriggered: () => {
							longPressTriggeredRef.current = true;
							setHighlightedCollisionIds([]);
							setHighlightedCapacityIds([]);
							setSelectedReservationId(reservation.id);
							openEditDialog(reservation);
						},
					});
					stopLongPressRef.current = () => longPress.stop("done");

					cleanupSessionRef.current = withWindowPointerSession({
						onPointerMove: longPress.onPointerMove,
						onPointerUp: () => {
							longPress.stop("done");
							cleanupSessionRef.current?.();
							cleanupSessionRef.current = null;
							stopLongPressRef.current = null;
						},
						onPointerCancel: () => {
							longPress.stop("cancel");
							cleanupSessionRef.current?.();
							cleanupSessionRef.current = null;
							stopLongPressRef.current = null;
						},
					});
				}}
				onClick={(event) => {
					event.stopPropagation();
					if (longPressTriggeredRef.current) {
						longPressTriggeredRef.current = false;
						return;
					}
					setHighlightedCollisionIds([]);
					setHighlightedCapacityIds([]);
					setSelectedReservationId(reservation.id);
				}}
				onKeyDown={(event) => {
					if (event.key !== "Enter") return;
					event.preventDefault();
					if (!isSelected) {
						setHighlightedCollisionIds([]);
						setHighlightedCapacityIds([]);
						setSelectedReservationId(reservation.id);
						return;
					}
					setHighlightedCollisionIds([]);
					setHighlightedCapacityIds([]);
					openEditDialog(reservation);
				}}
			>
				{reservation._tag === "reservationBooking" ? (
					<>
						<span className={cn("truncate", isRejected && "line-through")}>
							{`${reservation.name} (${reservation.numberOfPeople})`}
						</span>
						<span className="truncate text-[10px] opacity-80">
							{t(
								`reservations:form.approval.${reservation.approvalStatus}` as const,
							)}
							{" · "}
							{t(
								`reservations:form.service.${reservation.serviceStatus}` as const,
							)}
						</span>
					</>
				) : (
					reservation.label
				)}
			</button>
			{editLongPressProgress !== null && (
				<div className="pointer-events-none absolute top-0 right-0 z-40 flex h-6 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-background/95 shadow-sm">
					<svg
						viewBox="0 0 20 20"
						className="-rotate-90 h-5 w-5 text-primary"
						aria-hidden="true"
						focusable="false"
					>
						<circle
							cx="10"
							cy="10"
							r="7"
							stroke="currentColor"
							strokeWidth="2"
							fill="none"
							opacity="0.2"
						/>
						<circle
							cx="10"
							cy="10"
							r="7"
							stroke="currentColor"
							strokeWidth="2"
							fill="none"
							strokeLinecap="round"
							strokeDasharray="43.98"
							strokeDashoffset={43.98 * (1 - editLongPressProgress)}
						/>
					</svg>
				</div>
			)}
		</div>
	);
};
