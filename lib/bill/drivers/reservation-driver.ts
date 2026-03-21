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

		screenStack.replaceLast({
			variant: "loading",
			payload: {
				text: "Loading reservation...",
			},
		});

		const subscriptionResult = await reservationStorage.subscribe(
			{
				ndk,
				pubkey: pubkey.toLowerCase(),
			},
			(resultOrError) => {
				if (!resultOrError.ok) {
					console.error(resultOrError.error);
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

				screenStack.replaceLast({
					variant: "reservation",
					payload: result.data,
				});
			},
		);

		if (!subscriptionResult.ok) {
			console.error(subscriptionResult.error);
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
				subscriptionResult.value.close();
			},
		} satisfies BillSubscription;
	}
}
