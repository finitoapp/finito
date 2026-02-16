import { formatInTimeZone } from "date-fns-tz";

export const formatDateTimeLocal = (
	epochMs: number,
	timezone: string,
): string =>
	formatInTimeZone(new Date(epochMs), timezone, "yyyy-MM-dd'T'HH:mm");
