import { describe, expect, it } from "bun:test";
import { extractBtcAmountFromLightningInvoice } from "@/lib/ln-utils";

describe("extractBtcAmountFromLightningInvoice", () => {
	it.each([
		{
			value:
				"lnbc230n1p5j6s8wpp56prvhfxh2h4qgmkzwu2lrn9t0y9jpt8n3z7le2p6uj6rj5sd6ptsdqqcqzzsxqrrsssp5uzjst5hwes3l6pg22fsxcm7kawp7m53wc76hrlppjt2snyuwhkls9qxpqysgqg7e6xvfl9ghevhmyqyxshcqp0dwz4sj7km5x5zvwf99jmw2j7vw53utaywjh2szxhecg0dpv85qmsyy9233np87mp6l32t32hy7aepqpk9wn3s",
			expected: 0.00000023,
		},
	] as const)("should parse correctly (%o)", ({ value, expected }) => {
		expect(extractBtcAmountFromLightningInvoice(value)).toBe(expected);
	});

	it.each([
		{
			value: "invalidInvoice",
		},
	] as const)("should parse correctly (%o)", ({ value }) => {
		expect(() => extractBtcAmountFromLightningInvoice(value)).toThrow(
			"Not a proper lightning payment request",
		);
	});
});
