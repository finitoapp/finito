import * as errore from "errore";
import type { BillDriver, BillSubscription } from "@/lib/bill/billDriver";
import { ReservationFormData as ReservationFormDataSchema } from "@/lib/contracts/nostr/reservation";
import { reservationStorage } from "@/lib/reservation-storage";

const reservationBillIdRegex = /^(r|reservation|reservations)-([0-9a-f]{64})$/i;

export class ReservationDriver implements BillDriver {
	public async subscribe({
		billId,
		callback,
		ndk,
	}: Parameters<BillDriver["subscribe"]>[0]) {
		const [_, _prefix, pubkey] = reservationBillIdRegex.exec(billId) ?? [
			null,
			null,
			null,
		];

		if (pubkey === null) {
			return null;
		}

		callback({
			type: "billLoading",
			payload: {
				text: "Loading reservation...",
			},
		});

		const subscription = await reservationStorage.subscribe(
			{
				ndk,
				pubkey: pubkey.toLowerCase(),
			},
			(resultOrError) => {
				if (errore.isError(resultOrError)) {
					console.error(resultOrError);
					return;
				}

				const result = ReservationFormDataSchema.safeParse(resultOrError);
				if (!result.success) {
					console.error(result.error);
					callback({
						type: "billLoading",
						payload: {
							text: "Reservation has an invalid structure...",
						},
					});
					return;
				}

				callback({
					type: "screen",
					payload: {
						variant: "reservation",
						payload: result.data,
					},
				});
			},
		);

		if (errore.isError(subscription)) {
			console.error(subscription);
			callback({
				type: "billLoading",
				payload: {
					text: "Reservation subscription closed before becoming ready...",
				},
			});

			return {
				refresh: async () => {},
				close: async () => {},
			} satisfies BillSubscription;
		}

		return {
			refresh: async () => {},
			close: async () => {
				subscription.close();
			},
		} satisfies BillSubscription;
	}
}
