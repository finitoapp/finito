import { describe, expect, it } from "bun:test";
import { isTheSameDateString } from "@/lib/date-string-utils";
import { DateString } from "@/lib/types";

describe("isTheSameDateString", () => {
	it.each([
		{
			date1: DateString("2025-10-01"),
			date2: DateString("2025-10-01"),
			mode: "year-month",
			expected: true,
		},
		{
			date1: DateString("2025-10-01"),
			date2: DateString("2025-10-02"),
			mode: "year-month",
			expected: true,
		},
		{
			date1: DateString("2025-10-01"),
			date2: DateString("2025-11-01"),
			mode: "year-month",
			expected: false,
		},
		{
			date1: DateString("2025-10-01"),
			date2: DateString("2025-11-01"),
			mode: "year",
			expected: true,
		},
		{
			date1: DateString("2025-10-01"),
			date2: DateString("2026-11-01"),
			mode: "year",
			expected: false,
		},
	] as const)("should compare correctly (%o)", ({
		date1,
		date2,
		mode,
		expected,
	}) => {
		expect(isTheSameDateString(date1, date2, mode)).toBe(expected);
	});
});
