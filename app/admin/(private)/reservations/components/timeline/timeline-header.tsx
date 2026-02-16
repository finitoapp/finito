"use client";

import type React from "react";
import { toLocalTimeLabel } from "@/app/admin/(private)/reservations/lib/calendar-math";
import { cn } from "@/lib/utils";

export const TimelineHeader: React.FC<{
	tableColumnLabel: string;
	slotCount: number;
	timelineWidthPx: number;
	rowHeightPx: number;
	hourLabelBlocks: number;
	dayOpenMs: number;
	slotMs: number;
	timezone: string;
	showCurrentTimeLine: boolean;
	currentTimeLineLeftPercent: number;
}> = (props) => (
	<>
		<div
			className="sticky left-0 z-50 flex items-center border-b bg-card px-2 text-xs font-semibold tracking-wide shadow-[2px_0_0_0_var(--border)]"
			style={{ minHeight: props.rowHeightPx }}
		>
			{props.tableColumnLabel}
		</div>
		<div className="relative z-10 bg-card p-0">
			<div
				className="relative border-b border-border/80 bg-muted/35"
				style={{
					width: props.timelineWidthPx,
				}}
			>
				<div
					className="grid"
					style={{
						gridTemplateColumns: `repeat(${props.slotCount}, minmax(0, 1fr))`,
					}}
				>
					{Array.from({ length: props.slotCount }).map((_, slotIndex) => (
						<div
							key={`time-${props.dayOpenMs + slotIndex * props.slotMs}`}
							className={cn(slotIndex % 2 === 0 && "border-l border-border/70")}
							style={{ height: props.rowHeightPx }}
						/>
					))}
				</div>
				<div className="pointer-events-none absolute inset-0">
					{Array.from({ length: props.hourLabelBlocks }).map(
						(_, hourBlockIndex) => {
							const startSlot = hourBlockIndex * 2;
							const spanSlots = Math.min(2, props.slotCount - startSlot);
							if (spanSlots <= 0) return null;

							return (
								<div
									key={`time-label-${startSlot}`}
									className="absolute inset-y-0 flex items-center justify-center px-1 text-center text-xs font-semibold text-foreground/90 whitespace-nowrap"
									style={{
										left: `${(startSlot / props.slotCount) * 100}%`,
										width: `${(spanSlots / props.slotCount) * 100}%`,
									}}
								>
									{toLocalTimeLabel(
										props.dayOpenMs + startSlot * props.slotMs,
										props.timezone,
									)}
								</div>
							);
						},
					)}
				</div>
				{props.showCurrentTimeLine && (
					<div
						className="pointer-events-none absolute top-0 bottom-0 z-20 border-l border-destructive"
						style={{
							left: `${props.currentTimeLineLeftPercent}%`,
						}}
					/>
				)}
			</div>
		</div>
	</>
);
