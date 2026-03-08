import type { EvoluSchemaType } from "@/lib/evolu";
import type {
	NonEmptyString,
	NonNegativeInteger,
	TimestampMs,
} from "@/lib/shared/types";

export type PayInvoiceInput = {
	invoice: NonEmptyString;
	amountSats?: NonNegativeInteger | null;
	maxFeeSats?: NonNegativeInteger | null;
};

export type PayInvoiceResult = {
	walletRequestId: NonEmptyString;
	paymentHash: NonEmptyString;
	feePaidSats: NonNegativeInteger | null;
	raw: unknown;
};

export type ReceiveInvoiceInput = {
	amountSats: NonNegativeInteger;
	memo?: string | null;
	expiresAt?: TimestampMs | null;
};

export type ReceiveInvoiceResult = {
	invoice: NonEmptyString;
	paymentHash: NonEmptyString;
	walletInvoiceId: NonEmptyString;
	expiresAt: TimestampMs;
	raw: unknown;
};

export interface BtcWalletAdapter<
	TTag extends keyof EvoluSchemaType = keyof EvoluSchemaType,
> {
	readonly tag: TTag;
	payInvoice(params: {
		config: EvoluSchemaType[TTag];
		input: PayInvoiceInput;
	}): Promise<PayInvoiceResult>;
	receiveInvoice(params: {
		config: EvoluSchemaType[TTag];
		input: ReceiveInvoiceInput;
	}): Promise<ReceiveInvoiceResult>;
}
