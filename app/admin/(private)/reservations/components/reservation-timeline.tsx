"use client";

import type { Id } from "@evolu/common";
import { useAtomValue, useSetAtom } from "jotai";
import { PlusIcon } from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCalendarPan } from "@/app/admin/(private)/reservations/hooks/use-calendar-pan";
import { useCurrentTimeScroll } from "@/app/admin/(private)/reservations/hooks/use-current-time-scroll";
import { useReservationDrag } from "@/app/admin/(private)/reservations/hooks/use-reservation-drag";
import { useSlotSelection } from "@/app/admin/(private)/reservations/hooks/use-slot-selection";
import {
	CALENDAR_SETTINGS,
	getRowHeightPx,
	toLocalDayLabel,
} from "@/app/admin/(private)/reservations/lib/calendar-math";
import type { ReservationStateAtoms } from "@/app/admin/(private)/reservations/lib/state-atoms";
import { Button } from "@/components/ui/button";
import { useEvolu } from "@/hooks/use-evolu";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { cn } from "@/lib/shared/ui/cn";
import { ReservationRow } from "./timeline/reservation-row";
import { TimelineHeader } from "./timeline/timeline-header";

export const ReservationTimeline: React.FC<{
	stateAtoms: ReservationStateAtoms;
}> = (props) => {
	const tableColumnWidthPx = 176;
	const { t } = useTranslation();
	const evolu = useEvolu();
	const { confirm } = useGlobalDialog();
	const timelineScrollerRef = useRef<HTMLDivElement | null>(null);
	const panBlockedRef = useRef(false);
	const reservationElementRefs = useRef(new Map<Id, HTMLDivElement>());
	const { isPanning, panHandlers, suppressClickUntilRef } = useCalendarPan({
		timelineScrollerRef,
		isPanBlockedRef: panBlockedRef,
	});
	const selectedDay = useAtomValue(props.stateAtoms.selectedDayAtom);
	const dayRange = useAtomValue(props.stateAtoms.dayRangeAtom);
	const timezone = useAtomValue(props.stateAtoms.timezoneAtom);
	const isLongPressPreviewVisible = useAtomValue(
		props.stateAtoms.isLongPressPreviewVisibleAtom,
	);
	const verticalZoom = useAtomValue(props.stateAtoms.verticalZoomAtom);
	const tables = useAtomValue(props.stateAtoms.tablesAtom);
	const filteredTables = useAtomValue(props.stateAtoms.filteredTablesAtom);
	const focusReservationRequest = useAtomValue(
		props.stateAtoms.focusReservationRequestAtom,
	);
	const setPreviewReservation = useSetAtom(
		props.stateAtoms.previewReservationAtom,
	);
	const setSelectedReservationId = useSetAtom(
		props.stateAtoms.selectedReservationIdAtom,
	);
	const setFocusReservationRequest = useSetAtom(
		props.stateAtoms.focusReservationRequestAtom,
	);
	const openCreateDialog = useSetAtom(props.stateAtoms.openCreateDialogAtom);
	const openTableDialog = useSetAtom(props.stateAtoms.openTableDialogAtom);
	const { slotMs, slotCount, timelineWidthPx, hourLabelBlocks } = useAtomValue(
		props.stateAtoms.timelineMetricsAtom,
	);
	const rowHeightPx = getRowHeightPx(verticalZoom);

	const nowEpochMs = Date.now();
	const selectedDayLabel = toLocalDayLabel(selectedDay, timezone);
	const currentDayLabel = toLocalDayLabel(new Date(nowEpochMs), timezone);
	const showCurrentTimeLine =
		selectedDayLabel === currentDayLabel &&
		nowEpochMs >= dayRange.openMs &&
		nowEpochMs <= dayRange.closeMs;
	const currentTimeLineLeftPercent = showCurrentTimeLine
		? ((nowEpochMs - dayRange.openMs) / (dayRange.closeMs - dayRange.openMs)) *
			100
		: 0;

	useCurrentTimeScroll({
		showCurrentTimeLine,
		currentTimeLineLeftPercent,
		timelineScrollerRef,
		scrollKey: `${selectedDayLabel}:${timezone}`,
	});

	useEffect(() => {
		if (focusReservationRequest === null) return;
		requestAnimationFrame(() => {
			const element = reservationElementRefs.current.get(
				focusReservationRequest,
			);
			if (element) {
				element.scrollIntoView({
					behavior: "smooth",
					block: "nearest",
					inline: "center",
				});
			}
			setFocusReservationRequest(null);
		});
	}, [focusReservationRequest, setFocusReservationRequest]);

	const { beginDrag } = useReservationDrag({
		evolu,
		confirm,
		t,
		timezone,
		tables,
		slotMs,
		slotCount,
		timelineWidthPx,
		setSelectedReservationId,
		setPreviewReservation,
	});
	const { onSlotPointerDown } = useSlotSelection({
		stateAtoms: props.stateAtoms,
		suppressClickUntilRef,
		panBlockedRef,
		dayOpenMs: dayRange.openMs,
		slotMs,
		slotCount,
		slotMinutes: CALENDAR_SETTINGS.slotMinutes,
		onCreateReservation: ({ tableId, startAt, durationMinutes }) => {
			openCreateDialog({ tableId, startAt, durationMinutes });
		},
	});

	const registerReservationElement = (
		reservationId: Id,
		element: HTMLDivElement | null,
	) => {
		if (element === null) {
			reservationElementRefs.current.delete(reservationId);
			return;
		}
		reservationElementRefs.current.set(reservationId, element);
	};

	return (
		<div
			ref={timelineScrollerRef}
			className={cn(
				"overflow-auto rounded-lg border select-none",
				isLongPressPreviewVisible ? "cursor-none" : "cursor-grab",
				isPanning && "cursor-grabbing",
			)}
			onPointerDownCapture={panHandlers.onPointerDownCapture}
			onPointerMoveCapture={panHandlers.onPointerMoveCapture}
			onPointerUpCapture={panHandlers.onPointerUpCapture}
			onPointerCancelCapture={panHandlers.onPointerCancelCapture}
			onClickCapture={panHandlers.onClickCapture}
		>
			<div
				className="grid"
				style={{
					gridTemplateColumns: `${tableColumnWidthPx}px minmax(0, 1fr)`,
				}}
			>
				<TimelineHeader
					tableColumnLabel={t("reservations:page.calendar.tableColumn")}
					slotCount={slotCount}
					timelineWidthPx={timelineWidthPx}
					rowHeightPx={rowHeightPx}
					hourLabelBlocks={hourLabelBlocks}
					dayOpenMs={dayRange.openMs}
					slotMs={slotMs}
					timezone={timezone}
					showCurrentTimeLine={showCurrentTimeLine}
					currentTimeLineLeftPercent={currentTimeLineLeftPercent}
				/>

				{filteredTables.map((table) => (
					<ReservationRow
						key={table.id}
						table={table}
						stateAtoms={props.stateAtoms}
						dayRange={dayRange}
						slotCount={slotCount}
						timelineWidthPx={timelineWidthPx}
						rowHeightPx={rowHeightPx}
						showCurrentTimeLine={showCurrentTimeLine}
						currentTimeLineLeftPercent={currentTimeLineLeftPercent}
						onSlotPointerDown={onSlotPointerDown}
						beginDrag={beginDrag}
						registerReservationElement={registerReservationElement}
					/>
				))}
				<div
					className="sticky left-0 z-30 flex items-center border-b bg-card px-2 shadow-[2px_0_0_0_var(--border)]"
					style={{ minHeight: rowHeightPx }}
				>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 w-full justify-start px-1 text-xs"
						onClick={() => openTableDialog()}
					>
						<PlusIcon />
						{t("reservations:page.actions.addTable")}
					</Button>
				</div>
				<div className="relative z-10">
					<div
						className="border-b border-dashed"
						style={{
							minHeight: rowHeightPx,
							width: timelineWidthPx,
						}}
					/>
				</div>
			</div>
		</div>
	);
};
