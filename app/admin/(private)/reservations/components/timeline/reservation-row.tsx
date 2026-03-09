import type { Id } from "@evolu/common";
import { useAtomValue } from "jotai";
import type React from "react";
import { Fragment } from "react";
import type { ReservationStateAtoms } from "@/app/admin/(private)/reservations/lib/state-atoms";
import type { TableVm } from "@/app/admin/(private)/reservations/lib/types";
import { cn } from "@/lib/shared/ui/cn";
import { type BeginDrag, ReservationBlock } from "./reservation-block";

export const ReservationRow: React.FC<{
	table: TableVm;
	stateAtoms: ReservationStateAtoms;
	dayRange: { openMs: number; closeMs: number };
	slotCount: number;
	timelineWidthPx: number;
	rowHeightPx: number;
	showCurrentTimeLine: boolean;
	currentTimeLineLeftPercent: number;
	onSlotPointerDown: (
		event: React.PointerEvent<HTMLButtonElement>,
		args: { tableId: Id; slotIndex: number },
	) => void;
	beginDrag: BeginDrag;
	registerReservationElement: (id: Id, element: HTMLDivElement | null) => void;
}> = (props) => {
	const reservationIds = useAtomValue(
		props.stateAtoms.rowReservationIdsAtomFamily(props.table.id),
	);
	const slotSelectionPreview = useAtomValue(
		props.stateAtoms.slotSelectionPreviewForTableAtomFamily(props.table.id),
	);
	const longPressPreview = useAtomValue(
		props.stateAtoms.longPressPreviewForTableAtomFamily(props.table.id),
	);

	return (
		<Fragment>
			<div
				className="sticky left-0 z-40 flex items-center border-b bg-card px-2 shadow-[2px_0_0_0_var(--border)]"
				style={{ minHeight: props.rowHeightPx }}
			>
				<div className="flex min-w-0 items-center gap-1.5">
					<div className="truncate text-sm font-medium leading-tight">
						{props.table.label}
					</div>
					<div className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
						{props.table.numberOfSeats}
					</div>
				</div>
			</div>
			<div className="relative z-10">
				<div
					data-reservation-row-id={props.table.id}
					data-timeline="true"
					className="relative border-b"
					style={{ width: props.timelineWidthPx }}
				>
					<div
						className="grid"
						style={{
							gridTemplateColumns: `repeat(${props.slotCount}, minmax(0, 1fr))`,
						}}
					>
						{Array.from({ length: props.slotCount }).map((_, slotIndex) => (
							<button
								type="button"
								key={`${props.table.id}-${
									// biome-ignore lint/suspicious/noArrayIndexKey: It's OK here
									slotIndex
								}`}
								data-slot-index={slotIndex}
								data-slot-table-id={props.table.id}
								className={cn(
									"border-l transition-colors hover:bg-primary/5",
									slotIndex % 2 === 0 && "bg-muted/20",
									"cursor-grab",
								)}
								style={{ height: props.rowHeightPx }}
								onPointerDown={(event) =>
									props.onSlotPointerDown(event, {
										tableId: props.table.id,
										slotIndex,
									})
								}
							/>
						))}
					</div>
					{slotSelectionPreview !== null && (
						<div
							className="pointer-events-none absolute z-30 rounded-md border border-primary/40 bg-primary/15 shadow-sm"
							style={{
								top: "2px",
								bottom: "2px",
								left: `calc(${(slotSelectionPreview.startSlotIndex / props.slotCount) * 100}% + 2px)`,
								width: `calc(${((slotSelectionPreview.endSlotIndex - slotSelectionPreview.startSlotIndex + 1) / props.slotCount) * 100}% - 4px)`,
							}}
						/>
					)}
					{longPressPreview !== null && (
						<div
							className="pointer-events-none absolute z-30"
							style={{
								top: "2px",
								bottom: "2px",
								left: `calc(${(longPressPreview.slotIndex / props.slotCount) * 100}% + 2px)`,
								width: `calc(${(1 / props.slotCount) * 100}% - 4px)`,
							}}
						>
							<div className="absolute top-0 right-0 flex h-6 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-background/90 shadow-sm">
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
										strokeDashoffset={43.98 * (1 - longPressPreview.progress)}
									/>
								</svg>
							</div>
						</div>
					)}
					{props.showCurrentTimeLine && (
						<div
							className="pointer-events-none absolute top-0 bottom-0 z-20 border-l border-destructive"
							style={{
								left: `${props.currentTimeLineLeftPercent}%`,
							}}
						/>
					)}

					{reservationIds.map((reservationId) => (
						<ReservationBlock
							key={reservationId}
							reservationId={reservationId}
							stateAtoms={props.stateAtoms}
							dayRange={props.dayRange}
							rowHeightPx={props.rowHeightPx}
							beginDrag={props.beginDrag}
							registerReservationElement={props.registerReservationElement}
						/>
					))}
				</div>
			</div>
		</Fragment>
	);
};
