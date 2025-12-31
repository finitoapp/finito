import type { BillDriver, BillSubscription } from "@/lib/bill/billDriver";
import { extractBtcAmountFromLightningInvoice } from "@/lib/ln-utils";
import { Currency, Uuid7 } from "@/lib/types";

const lightningInvoiceRegex =
	/^(lightning:)?(ln)(bc|tb|bcrt|tbregtest)?(\d+[pnumk]?)?1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/i;

export class LnDriver implements BillDriver {
	public async subscribe({
		billId,
		callback,
	}: Parameters<BillDriver["subscribe"]>[0]) {
		const [_, _prefix, ln] = lightningInvoiceRegex.exec(billId) ?? [
			null,
			null,
			null,
		];

		if (ln === null) {
			return null;
		}

		let amount: number;
		try {
			amount = extractBtcAmountFromLightningInvoice(billId);
		} catch (_) {
			return null;
		}

		callback({
			type: "screen",
			payload: {
				variant: "paymentReady",
				payload: {
					paymentId: Uuid7.random(),
					bill: {
						items: [
							{
								id: Uuid7.random(),
								price: amount,
								quantity: 1,
								label: "invoice",
							},
						],
						currency: Currency.BTC,
					},
					type: "btcLn",
					lnInvoice: billId,
				},
			},
		});

		return {
			refresh: async () => {},
			close: async () => {},
		} satisfies BillSubscription;
	}
}
