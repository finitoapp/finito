import { describe, expect, it } from "bun:test";
import { parseCzechBankAccountFromIban } from "@/lib/iban-utils";
import { Iban } from "@/lib/types";

describe("parseCzechBankAccountFromIban", () => {
	it.each([
		{
			iban: "CZ4907100000000000123457",
			expected: "123457/0710",
		},
		{
			iban: "CZ6907100000190001234562",
			expected: "19-0001234562/0710",
		},
	] as const)("should parse correctly (%o)", ({ iban, expected }) => {
		expect(parseCzechBankAccountFromIban(Iban(iban))).toBe(expected);
	});

	it.each([
		{
			iban: "DE16030000000289111210",
		},
	] as const)("should not parse", ({ iban }) => {
		expect(parseCzechBankAccountFromIban(Iban(iban))).toBeNull();
	});
});
