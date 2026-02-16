import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { DayRange } from "./types";

export const CALENDAR_SETTINGS = {
	slotMinutes: 30,
	defaultDurationMinutes: 60,
	openHour: 0,
	closeHour: 24,
	defaultTimezone: "Europe/Prague",
} as const;

export const MINUTES_PER_HOUR = 60;
export const MS_PER_MINUTE = 60 * 1000;
export const BASE_SLOT_WIDTH_PX = 48;
export const BASE_ROW_HEIGHT_PX = 48;
export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 1.25;
export const MIN_VERTICAL_ZOOM = 0.65;
export const MAX_VERTICAL_ZOOM = 2.2;
export const DRAG_START_THRESHOLD_PX = 5;

export const toLocalTimeLabel = (epochMs: number, timezone: string) =>
	formatInTimeZone(new Date(epochMs), timezone, "HH:mm");

export const toLocalDayLabel = (date: Date, timezone: string) =>
	formatInTimeZone(date, timezone, "yyyy-MM-dd");

export const createDayRange = (date: Date, timezone: string): DayRange => {
	const day = toLocalDayLabel(date, timezone);
	const nextDay = toLocalDayLabel(addDays(date, 1), timezone);
	const dayStartMs = fromZonedTime(`${day}T00:00:00`, timezone).getTime();
	const openMinutes = CALENDAR_SETTINGS.openHour * MINUTES_PER_HOUR;
	const closeMinutes = CALENDAR_SETTINGS.closeHour * MINUTES_PER_HOUR;
	const openMs = dayStartMs + openMinutes * MS_PER_MINUTE;
	const closeMsCandidate = dayStartMs + closeMinutes * MS_PER_MINUTE;
	const closeMs =
		closeMinutes <= openMinutes
			? closeMsCandidate + 24 * MINUTES_PER_HOUR * MS_PER_MINUTE
			: closeMsCandidate;

	return {
		dayStartMs,
		dayEndMs: fromZonedTime(`${nextDay}T00:00:00`, timezone).getTime(),
		openMs,
		closeMs,
	};
};

export const getTimelineMetrics = (zoom: number) => {
	const slotMs = CALENDAR_SETTINGS.slotMinutes * MS_PER_MINUTE;
	const openMinutes = CALENDAR_SETTINGS.openHour * MINUTES_PER_HOUR;
	const closeMinutes = CALENDAR_SETTINGS.closeHour * MINUTES_PER_HOUR;
	const totalMinutesBase = closeMinutes - openMinutes;
	const totalMinutes =
		totalMinutesBase <= 0
			? totalMinutesBase + 24 * MINUTES_PER_HOUR
			: totalMinutesBase;
	const slotCount = totalMinutes / CALENDAR_SETTINGS.slotMinutes;
	const timelineWidthPx = slotCount * BASE_SLOT_WIDTH_PX * zoom;
	const zoomPercent = Math.round(zoom * 100);
	const hourLabelBlocks = Math.ceil(slotCount / 2);

	return {
		slotMs,
		slotCount,
		timelineWidthPx,
		zoomPercent,
		hourLabelBlocks,
	};
};

export const getRowHeightPx = (verticalZoom: number) =>
	Math.max(28, Math.round(BASE_ROW_HEIGHT_PX * verticalZoom));
