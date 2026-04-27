import { describe, expect, it } from "bun:test";
import { computeSubsequentPaymentReceiptNumber } from "@/lib/payment-receipt/number-service";
import { DateString } from "@/lib/shared/types";

describe("computeSubsequentPaymentReceiptNumber", () => {
	it.each([
		{
			prefix: "R",
			serialNumberDigits: 4,
			yearFormat: "default",
			monthFormat: "hidden",
			dayFormat: "hidden",
			lastDate: DateString("2025-10-16"),
			expected: "R20250004",
		},
		{
			prefix: "R",
			serialNumberDigits: 4,
			yearFormat: "default",
			monthFormat: "hidden",
			dayFormat: "hidden",
			lastDate: DateString("2024-12-31"),
			expected: "R20250001",
		},
		{
			prefix: "P",
			serialNumberDigits: 3,
			yearFormat: "short",
			monthFormat: "hidden",
			dayFormat: "hidden",
			lastDate: DateString("2025-10-16"),
			expected: "P25004",
		},
		{
			prefix: "P",
			serialNumberDigits: 3,
			yearFormat: "short",
			monthFormat: "default",
			dayFormat: "default",
			lastDate: DateString("2025-10-15"),
			expected: "P251016001",
		},
	] as const)("(%o)", ({
		prefix,
		yearFormat,
		monthFormat,
		dayFormat,
		serialNumberDigits,
		lastDate,
		expected,
	}) => {
		const now = new Date("2025-10-16");

		expect(
			computeSubsequentPaymentReceiptNumber({
				now,
				timezone: "Europe/Prague",
				yearFormat,
				monthFormat,
				dayFormat,
				serialNumberDigits,
				lastSerialNumber: 3,
				lastDate,
				prefix,
			}).receiptNumber,
		).toBe(expected);
	});
});
