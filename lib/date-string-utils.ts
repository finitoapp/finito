import type { DateString } from "@/lib/types";

export const isTheSameDateString = (
	date1: DateString,
	date2: DateString,
	mode: "year-month" | "year",
) => {
	const length = mode === "year-month" ? 7 : 4;

	return date1.substring(0, length) === date2.substring(0, length);
};
