import { describe, expect, it } from "bun:test";
import { computeSubsequentInvoiceNumber } from "@/lib/invoice-number-service";
import { DateString } from "@/lib/types";

describe("computeSubsequentInvoiceNumber", () => {
	it.each([
		{
			prefix: "",
			serialNumberDigits: 4,
			yearFormat: "default",
			monthFormat: "hidden",
			dayFormat: "hidden",
			lastDate: DateString("2025-10-16"),
			expected: "20250004",
		},
		{
			prefix: "",
			serialNumberDigits: 4,
			yearFormat: "default",
			monthFormat: "hidden",
			dayFormat: "hidden",
			lastDate: DateString("2024-12-31"),
			expected: "20250001",
		},
		{
			prefix: "a",
			serialNumberDigits: 3,
			yearFormat: "short",
			monthFormat: "hidden",
			dayFormat: "hidden",
			lastDate: DateString("2025-10-16"),
			expected: "a25004",
		},
		{
			prefix: "a",
			serialNumberDigits: 3,
			yearFormat: "short",
			monthFormat: "default",
			dayFormat: "hidden",
			lastDate: DateString("2025-10-16"),
			expected: "a2510004",
		},
		{
			prefix: "a",
			serialNumberDigits: 3,
			yearFormat: "short",
			monthFormat: "default",
			dayFormat: "hidden",
			lastDate: DateString("2025-09-30"),
			expected: "a2510001",
		},
		{
			prefix: "b",
			serialNumberDigits: 3,
			yearFormat: "short",
			monthFormat: "default",
			dayFormat: "default",
			lastDate: DateString("2025-10-16"),
			expected: "b251016004",
		},
		{
			prefix: "b",
			serialNumberDigits: 3,
			yearFormat: "short",
			monthFormat: "default",
			dayFormat: "default",
			lastDate: DateString("2025-10-15"),
			expected: "b251016001",
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
			computeSubsequentInvoiceNumber({
				now,
				timezone: "Europe/Prague",
				yearFormat,
				monthFormat,
				dayFormat,
				serialNumberDigits,
				lastSerialNumber: 3,
				lastDate,
				prefix,
			}).invoiceNumber,
		).toBe(expected);
	});
});
