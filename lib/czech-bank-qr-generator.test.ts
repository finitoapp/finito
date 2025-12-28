import { describe, expect, it } from "bun:test";
import { Iban } from "@/lib/types";
import { generateCzechBankQrCode } from "./czech-bank-qr-generator";

describe("epcCodeGenerator.ts", () => {
	it("generateEpcCode simple", () => {
		const code = generateCzechBankQrCode({
			amount: 123.45,
			currency: "CZK",
			iban: Iban("BE72000000001616"),
		});

		expect(code).toMatchInlineSnapshot(
			'"SPD*1.0*ACC:BE72000000001616*AM:123.45*CC:CZK"',
		);
	});

	it("generateEpcCode", () => {
		const code = generateCzechBankQrCode({
			amount: 123.45,
			currency: "EUR",
			iban: Iban("BE72000000001616"),
			specificSymbol: "41",
			variableSymbol: "5002758806",
		});

		expect(code).toMatchInlineSnapshot(
			'"SPD*1.0*ACC:BE72000000001616*AM:123.45*CC:EUR*X-VS:5002758806*X-SS:41"',
		);
	});

	it("generateEpcCode with message", () => {
		const code = generateCzechBankQrCode({
			amount: 123.45,
			currency: "EUR",
			iban: Iban("BE72000000001616"),
			message: "hello",
			recipientName: "PayU S. A.",
			specificSymbol: "41",
			title: "payment",
			variableSymbol: "5002758806",
		});

		expect(code).toMatchInlineSnapshot(
			'"SPD*1.0*ACC:BE72000000001616*AM:123.45*CC:EUR*RF:payment*RN:PayU S. A.*X-VS:5002758806*X-SS:41*MSG:hello"',
		);
	});

	it("generateEpcCode with message 2", () => {
		const code = generateCzechBankQrCode({
			amount: 1.0,
			currency: "EUR",
			iban: Iban("PL81114011245008012563936048"),
			message: "XX2563936048XX",
			recipientName: "PayU S. A.",
		});

		expect(code).toMatchInlineSnapshot(
			'"SPD*1.0*ACC:PL81114011245008012563936048*AM:1.00*CC:EUR*RN:PayU S. A.*MSG:XX2563936048XX"',
		);
	});

	it("generateEpcCode with message 3", () => {
		const code = generateCzechBankQrCode({
			amount: 81000.0,
			currency: "CZK",
			iban: Iban("CZ6620100000002800446325"),
			message: "QRPLATBA",
			variableSymbol: "20220005",
		});

		expect(code).toMatchInlineSnapshot(
			'"SPD*1.0*ACC:CZ6620100000002800446325*AM:81000.00*CC:CZK*X-VS:20220005*MSG:QRPLATBA"',
		);
	});
});
