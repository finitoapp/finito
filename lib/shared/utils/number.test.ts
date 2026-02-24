import { describe, expect, it } from "bun:test";
import { shiftNumericString } from "@/lib/shared/utils/number";
import { NumberString } from "@/lib/shared/types";

describe("shiftNumericString", () => {
	it.each([
		{
			value: NumberString("12.34567"),
			shift: 0,
			expected: NumberString("12.34567"),
		},
		{
			value: NumberString("0"),
			shift: 1,
			expected: NumberString("0"),
		},
		{
			value: NumberString("0"),
			shift: -1,
			expected: NumberString("0"),
		},
		{
			value: NumberString("1"),
			shift: 1,
			expected: NumberString("10"),
		},
		{
			value: NumberString("1"),
			shift: -1,
			expected: NumberString("0.1"),
		},
		{
			value: NumberString("12.34567"),
			shift: 1,
			expected: NumberString("123.4567"),
		},
		{
			value: NumberString("123456.7"),
			shift: 2,
			expected: NumberString("12345670"),
		},
		{
			value: NumberString("2.00"),
			shift: 1,
			expected: NumberString("20"),
		},
		{
			value: NumberString("2.00"),
			shift: -1,
			expected: NumberString("0.2"),
		},
	] as const)("should shift correctly (%o)", ({ value, shift, expected }) => {
		expect(shiftNumericString(value, shift)).toBe(expected);
	});
});
