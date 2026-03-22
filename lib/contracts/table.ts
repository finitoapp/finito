import { z } from "zod";
import { PaymentMerchantSchema } from "@/lib/evolu/model/payment";
import { TableIdSchema } from "@/lib/evolu/types";
import {
	Currency,
	IntegerSchema,
	NonNegativeIntegerSchema,
} from "@/lib/shared/types";

const BillPaymentOption = {
	BtcLn: "btcLn",
	BankTransferCZ: "bankTransferCZ",
} as const;

export const TablePaymentRequest = z.object({
	paymentId: TableIdSchema,
	items: z
		.object({
			// The POS must verify that the item ID exists on the current bill.
			id: z.string(),
			// The POS must verify that the item price is still the same.
			price: IntegerSchema,
			// The POS must verify that the requested quantity can be paid.
			// The quantity must not exceed what is available on the bill and must not use finer units than allowed.
			quantity: z.number(),
			// The POS should ignore label changes.
			// The label is primarily used for display in payment details.
			// The label is used by the POS to generate better user messages (e.g., "Beer is no longer on the bill").
			label: z.string(),
		})
		.array(),
	// The POS must verify that the tip amount is allowed.
	tip: NonNegativeIntegerSchema,
	// The POS must verify that the currency is supported.
	currency: z.enum(Currency),
	// The POS must verify that the payment option is supported.
	paymentOption: z.object({
		type: z.enum(BillPaymentOption),
	}),
	// The POS should ignore merchant changes.
	// The merchant structure is primarily used for display in payment details.
	merchant: PaymentMerchantSchema.optional(),
});

export type TablePaymentRequest = z.output<typeof TablePaymentRequest>;
