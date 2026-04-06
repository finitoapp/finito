import { NWCClient } from "@getalby/sdk/nwc";
import type { BtcWalletAdapter } from "@/lib/payment/btc-wallet/types";
import {
	NonEmptyString,
	NonNegativeInteger,
	TimestampMs,
} from "@/lib/shared/types";
import { extractPaymentHashFromLnInvoice } from "@/lib/shared/utils/ln";

const createNwcClient = (credentials: string) =>
	new NWCClient({
		nostrWalletConnectUrl: credentials,
	});

const toExpiresAt = (value: number | null | undefined) => {
	if (value == null) {
		return TimestampMs(Date.now() + 60 * 60 * 1000);
	}

	return TimestampMs(value * 1000);
};

export const nwcBtcWalletAdapter: BtcWalletAdapter<"accountNwc"> = {
	tag: "accountNwc",

	async payInvoice(params) {
		const client = createNwcClient(params.config.credentials);
		const result = await client.payInvoice({
			invoice: params.input.invoice,
			amount: params.input.amountSats
				? Number(params.input.amountSats) * 1000
				: undefined,
		});

		return {
			walletRequestId: NonEmptyString(result.preimage),
			paymentHash: extractPaymentHashFromLnInvoice(params.input.invoice),
			feePaidSats:
				result.fees_paid > 0
					? NonNegativeInteger(Math.trunc(result.fees_paid / 1000))
					: null,
			raw: result,
		};
	},

	async receiveInvoice(params) {
		const client = createNwcClient(params.config.credentials);
		const result = await client.makeInvoice({
			amount: Number(params.input.amountSats) * 1000,
			description: params.input.memo ?? undefined,
			expiry: params.input.expiresAt
				? Math.max(
						1,
						Math.ceil((Number(params.input.expiresAt) - Date.now()) / 1000),
					)
				: undefined,
		});

		return {
			invoice: NonEmptyString(result.invoice),
			paymentHash: NonEmptyString(
				(
					result.payment_hash ?? extractPaymentHashFromLnInvoice(result.invoice)
				).toLowerCase(),
			),
			walletInvoiceId: NonEmptyString(
				result.preimage || result.payment_hash || result.invoice,
			),
			expiresAt: toExpiresAt(result.expires_at),
			raw: result,
		};
	},
};
