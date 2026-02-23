import type { ReservationFormData } from "@/lib/contracts/nostr/reservation";
import { createNostrStorage } from "@/lib/nostr-storage";

export const reservationStorage = createNostrStorage<ReservationFormData>({
	namespace: "reservation",
});
