import type { NumberString } from "@/lib/types";

export function shiftNumericString(
	value: NumberString,
	shift: number,
): NumberString {
	if (shift === 0) return value;

	// Handle sign
	const sign = value.startsWith("-") ? "-" : "";

	// Split into integer and fractional parts
	const [intPart, fracPart = ""] = value.replace(/^-/, "").split(".");

	// Concatenate all digits
	let allDigits = intPart + fracPart;

	// Current decimal index from the left
	const decimalIdx = intPart.length;

	// New decimal index
	let newDecimalIdx = decimalIdx + shift;

	// Append zeros if shifting right beyond current length
	while (newDecimalIdx > allDigits.length) {
		allDigits += "0";
	}

	// Prepend zeros if shifting left beyond start
	while (newDecimalIdx < 0) {
		allDigits = `0${allDigits}`;
		newDecimalIdx++;
	}

	// Split into new integer and fractional parts
	const newIntPart =
		allDigits.slice(0, newDecimalIdx).replace(/^0+/, "") || "0";
	const newFracPart = allDigits.slice(newDecimalIdx).replace(/0+$/, "");

	return (sign +
		(newFracPart
			? `${newIntPart}.${newFracPart}`
			: newIntPart)) as NumberString;
}
