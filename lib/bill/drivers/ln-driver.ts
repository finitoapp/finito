import type { BillDriver, BillSubscription } from "@/lib/bill/driver";
import {
	Currency,
	type Integer,
	type NonEmptyString,
	Uuid7,
} from "@/lib/shared/types";
import {
	extractBtcAmountFromLightningInvoice,
	extractExpirationFromLightningInvoice,
	extractPaymentHashFromLnInvoice,
} from "@/lib/shared/utils/ln";

const lightningInvoiceRegex =
	/^(lightning:)?(ln)(bc|tb|bcrt|tbregtest)?(\d+[pnumk]?)?1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/i;

export class LnDriver implements BillDriver {
	public async subscribe({
		billId,
		screenStack,
	}: Parameters<BillDriver["subscribe"]>[0]) {
		const [_, _prefix, ln] = lightningInvoiceRegex.exec(billId) ?? [
			null,
			null,
			null,
		];

		if (ln === null) {
			return null;
		}

		let amount: Integer;
		try {
			amount = extractBtcAmountFromLightningInvoice(billId);
		} catch (_) {
			return null;
		}

		screenStack.replace({
			variant: "payment",
			payload: {
				payment: {
					id: Uuid7.random(),
					direction: "incoming",
					totalAmount: amount,
					currency: Currency.BTC,
					paymentSpecification: {
						type: "lnInvoice",
						lnInvoice: billId as NonEmptyString,
						paymentHash: extractPaymentHashFromLnInvoice(billId),
						expirationIn: extractExpirationFromLightningInvoice(billId),
					},
				},
			},
		});

		return {
			close: async () => {},
		} satisfies BillSubscription;
	}
}
