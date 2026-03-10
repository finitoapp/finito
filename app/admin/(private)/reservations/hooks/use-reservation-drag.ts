import type { Id } from "@evolu/common";
import type { TFunction } from "i18next";
import type React from "react";
import { useRef } from "react";
import {
	DRAG_START_THRESHOLD_PX,
	toLocalTimeLabel,
} from "@/app/admin/(private)/reservations/lib/calendar-math";
import type {
	DragMode,
	DragOperation,
	PreviewReservation,
	ReservationVm,
	TableVm,
} from "@/app/admin/(private)/reservations/lib/types";
import { withWindowPointerSession } from "@/app/admin/(private)/reservations/lib/window-pointer-session";
import type { GlobalConfirmDialog } from "@/atoms/global-dialog";
import type { useEvolu } from "@/hooks/use-evolu";
import type { TimestampMs } from "@/lib/shared/types";

type EvoluClient = ReturnType<typeof useEvolu>;

export const useReservationDrag = (params: {
	evolu: EvoluClient;
	confirm: (value: Omit<GlobalConfirmDialog, "type">) => Promise<boolean>;
	t: TFunction;
	timezone: string;
	tables: ReadonlyArray<TableVm>;
	slotMs: number;
	slotCount: number;
	timelineWidthPx: number;
	setSelectedReservationId: (id: Id) => void;
	setPreviewReservation: (value: PreviewReservation | null) => void;
}) => {
	const previewReservationRef = useRef<PreviewReservation | null>(null);
	const dragRef = useRef<DragOperation | null>(null);
	const cleanupSessionRef = useRef<(() => void) | null>(null);

	const applyDragPreview = (
		reservationId: Id,
		startAt: TimestampMs,
		endAt: TimestampMs,
		tableId: Id | null,
	) => {
		const previous = previewReservationRef.current;
		if (
			previous !== null &&
			previous.id === reservationId &&
			previous.startAt === startAt &&
			previous.endAt === endAt &&
			previous.tableId === tableId
		) {
			return;
		}

		const preview = {
			id: reservationId,
			startAt,
			endAt,
			tableId,
		};
		previewReservationRef.current = preview;
		params.setPreviewReservation(preview);
	};

	const stopDrag = async () => {
		const preview = previewReservationRef.current;
		const drag = dragRef.current;
		dragRef.current = null;

		if (preview === null || drag === null) {
			previewReservationRef.current = null;
			params.setPreviewReservation(null);
			return;
		}

		const changed =
			preview.startAt !== drag.originalStartAt ||
			preview.endAt !== drag.originalEndAt ||
			preview.tableId !== drag.originalTableId;
		if (!changed) {
			previewReservationRef.current = null;
			params.setPreviewReservation(null);
			return;
		}

		const toRangeLabel = (startAt: number, endAt: number) =>
			`${toLocalTimeLabel(startAt, params.timezone)}-${toLocalTimeLabel(endAt, params.timezone)}`;
		const originalRangeLabel = toRangeLabel(
			drag.originalStartAt,
			drag.originalEndAt,
		);
		const nextRangeLabel = toRangeLabel(preview.startAt, preview.endAt);
		const originalTableLabel = drag.originalTableId
			? (params.tables.find((table) => table.id === drag.originalTableId)
					?.label ?? drag.originalTableId)
			: params.t("reservations:form.table.unassigned");
		const nextTableLabel = preview.tableId
			? (params.tables.find((table) => table.id === preview.tableId)?.label ??
				preview.tableId)
			: params.t("reservations:form.table.unassigned");
		const descriptionParts: string[] = [];
		if (originalRangeLabel !== nextRangeLabel) {
			descriptionParts.push(
				params.t("reservations:page.dragConfirm.timeChange", {
					from: originalRangeLabel,
					to: nextRangeLabel,
				}),
			);
		}
		if (originalTableLabel !== nextTableLabel) {
			descriptionParts.push(
				params.t("reservations:page.dragConfirm.tableChange", {
					from: originalTableLabel,
					to: nextTableLabel,
				}),
			);
		}

		const accepted = await params.confirm({
			title: params.t("reservations:page.dragConfirm.title"),
			description:
				descriptionParts.join(" | ") ||
				params.t("reservations:page.dragConfirm.description"),
			confirmText: params.t("reservations:page.dragConfirm.confirm"),
			cancelText: params.t("reservations:page.dragConfirm.cancel"),
			confirmVariant: "default",
		});
		if (!accepted) {
			previewReservationRef.current = null;
			params.setPreviewReservation(null);
			return;
		}

		params.evolu.update("reservation", {
			id: preview.id,
			startAt: preview.startAt,
			endAt: preview.endAt,
			tableId: preview.tableId,
		});
		previewReservationRef.current = null;
		params.setPreviewReservation(null);
	};

	const beginDrag = (
		event: React.PointerEvent<HTMLElement>,
		args: {
			reservation: ReservationVm;
			mode: DragMode;
		},
	) => {
		event.preventDefault();
		event.stopPropagation();

		const timeline = (event.currentTarget.closest("[data-timeline]") ??
			event.currentTarget.parentElement) as HTMLElement | null;
		const timelineWidth =
			timeline?.getBoundingClientRect().width ?? params.timelineWidthPx;

		dragRef.current = {
			reservationId: args.reservation.id,
			mode: args.mode,
			originalStartAt: args.reservation.startAt,
			originalEndAt: args.reservation.endAt,
			originalTableId: args.reservation.tableId,
			slotWidthPx: timelineWidth / params.slotCount,
			startClientX: event.clientX,
			startClientY: event.clientY,
			isDragging: false,
		};
		params.setSelectedReservationId(args.reservation.id);

		const onPointerMove = (pointerEvent: PointerEvent) => {
			const drag = dragRef.current;
			if (drag === null) return;
			const deltaPxX = pointerEvent.clientX - drag.startClientX;
			const deltaPxY = pointerEvent.clientY - drag.startClientY;
			const distance = Math.hypot(deltaPxX, deltaPxY);
			if (!drag.isDragging && distance < DRAG_START_THRESHOLD_PX) {
				return;
			}
			drag.isDragging = true;

			const deltaSlots = Math.round(
				(pointerEvent.clientX - drag.startClientX) / drag.slotWidthPx,
			);
			let nextStartAt = drag.originalStartAt;
			let nextEndAt = drag.originalEndAt;
			let nextTableId = drag.originalTableId;

			if (drag.mode === "move") {
				nextStartAt += deltaSlots * params.slotMs;
				nextEndAt += deltaSlots * params.slotMs;

				const row = document
					.elementsFromPoint(pointerEvent.clientX, pointerEvent.clientY)
					.find(
						(element) =>
							element instanceof HTMLElement &&
							element.dataset.reservationRowId !== undefined,
					) as HTMLElement | undefined;

				if (row !== undefined) {
					nextTableId =
						(row.dataset.reservationRowId as Id | undefined) ?? null;
				}
			} else {
				nextEndAt += deltaSlots * params.slotMs;
				nextEndAt = Math.max(nextEndAt, drag.originalStartAt + params.slotMs);
			}

			applyDragPreview(
				drag.reservationId,
				nextStartAt as TimestampMs,
				nextEndAt as TimestampMs,
				nextTableId,
			);
		};

		const onPointerUp = () => {
			cleanupSessionRef.current?.();
			cleanupSessionRef.current = null;
			const wasDragging = dragRef.current?.isDragging === true;
			if (wasDragging) {
				void stopDrag();
			} else {
				dragRef.current = null;
			}
		};
		const onPointerCancel = () => {
			cleanupSessionRef.current?.();
			cleanupSessionRef.current = null;
			previewReservationRef.current = null;
			dragRef.current = null;
			params.setPreviewReservation(null);
		};

		cleanupSessionRef.current?.();
		cleanupSessionRef.current = withWindowPointerSession({
			onPointerMove,
			onPointerUp,
			onPointerCancel,
		});
	};

	return {
		beginDrag,
	};
};
