import * as errore from "errore";
import type { BillDriver, BillSubscription } from "@/lib/bill/driver";
import { ReservationFormData as ReservationFormDataSchema } from "@/lib/nostr/contracts/reservation";
import { reservationStorage } from "@/lib/reservation/nostr-storage";

const reservationBillIdRegex = /^(r|reservation|reservations)-([0-9a-f]{64})$/i;

export class ReservationDriver implements BillDriver {
	public async subscribe({
		billId,
		callback,
		screenStack,
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

		screenStack.replace({
			variant: "loading",
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
						type: "close",
						payload: {
							alertMessage: "Reservation has an invalid structure...",
						},
					});
					return;
				}

				screenStack.replace({
					variant: "reservation",
					payload: result.data,
				});
			},
		);

		if (errore.isError(subscription)) {
			console.error(subscription);
			callback({
				type: "close",
				payload: {
					alertMessage:
						"Reservation subscription closed before becoming ready...",
				},
			});

			return {
				close: async () => {},
			} satisfies BillSubscription;
		}

		return {
			close: async () => {
				subscription.close();
			},
		} satisfies BillSubscription;
	}
}
