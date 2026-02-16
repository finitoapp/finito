"use client";

import { useAtom } from "jotai";
import { MinusIcon, PlusCircleIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
	MAX_VERTICAL_ZOOM,
	MAX_ZOOM,
	MIN_VERTICAL_ZOOM,
	MIN_ZOOM,
} from "@/app/admin/(private)/reservations/lib/calendar-math";
import type { ReservationStateAtoms } from "@/app/admin/(private)/reservations/lib/state-atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ZOOM_STEP = 0.1;

const clampZoomStep = (
	value: number,
	min: number,
	max: number,
	delta: number,
) => Math.min(max, Math.max(min, Number((value + delta).toFixed(2))));

const ZoomControl: React.FC<{
	value: number;
	min: number;
	max: number;
	label: string;
	onChange: (next: number) => void;
}> = ({ value, min, max, label, onChange }) => {
	const percent = Math.round(value * 100);
	return (
		<div className="flex items-center gap-1 rounded-md border bg-background px-2 py-1">
			<Button
				type="button"
				size="icon"
				variant="ghost"
				onClick={() => onChange(clampZoomStep(value, min, max, -ZOOM_STEP))}
				disabled={percent <= Math.round(min * 100)}
			>
				<MinusIcon />
			</Button>
			<span className="min-w-14 text-center text-xs text-muted-foreground">
				{label}
			</span>
			<Button
				type="button"
				size="icon"
				variant="ghost"
				onClick={() => onChange(clampZoomStep(value, min, max, ZOOM_STEP))}
				disabled={percent >= Math.round(max * 100)}
			>
				<PlusCircleIcon />
			</Button>
		</div>
	);
};

export const ReservationControls: React.FC<{
	stateAtoms: ReservationStateAtoms;
}> = (props) => {
	const { t } = useTranslation();
	const [minSeatsFilter, setMinSeatsFilter] = useAtom(
		props.stateAtoms.minSeatsFilterAtom,
	);
	const [zoom, setZoom] = useAtom(props.stateAtoms.zoomAtom);
	const [verticalZoom, setVerticalZoom] = useAtom(
		props.stateAtoms.verticalZoomAtom,
	);

	return (
		<div className="mb-4 flex flex-wrap items-center gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<ZoomControl
					value={zoom}
					min={MIN_ZOOM}
					max={MAX_ZOOM}
					label={t("reservations:page.calendar.zoomHorizontal", {
						percent: Math.round(zoom * 100),
					})}
					onChange={(next) => setZoom(next)}
				/>
				<ZoomControl
					value={verticalZoom}
					min={MIN_VERTICAL_ZOOM}
					max={MAX_VERTICAL_ZOOM}
					label={t("reservations:page.calendar.zoomVertical", {
						percent: Math.round(verticalZoom * 100),
					})}
					onChange={(next) => setVerticalZoom(next)}
				/>
				<div className="flex items-center gap-2 bg-background px-2 py-1">
					<span className="text-xs text-muted-foreground">
						{t("reservations:page.calendar.seatsFilter")}
					</span>
					<Input
						type="number"
						min={0}
						step={1}
						value={minSeatsFilter}
						onChange={(event) => setMinSeatsFilter(event.target.value)}
						placeholder={t("reservations:page.calendar.seatsMin")}
						className="h-8 w-20"
					/>
				</div>
			</div>
		</div>
	);
};
