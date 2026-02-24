import type { BillDriver, BillSubscription } from "@/lib/bill/driver";
import { extractBtcAmountFromLightningInvoice } from "@/lib/shared/utils/ln";
import { Currency, IntegerSchema, NonEmptyString, Uuid7 } from "@/lib/shared/types";

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

		const amountAsInteger = IntegerSchema.safeParse(amount);
		if (!amountAsInteger.success) {
			callback({
				type: "screen",
				payload: {
					variant: "paymentFinished",
					payload: {
						paymentId: Uuid7.random(),
						type: "failure",
						reason: NonEmptyString(
							"Invoice amount contains milli satoshis which are not supported. Please use a whole number of satoshis.",
						),
					},
				},
			});
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
								price: amountAsInteger.data,
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
