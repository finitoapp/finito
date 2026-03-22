import type { ReservationFormData } from "@/lib/contracts/reservation";
import { createNostrStorage } from "@/lib/nostr/storage";

export const reservationStorage = createNostrStorage<ReservationFormData>({
	namespace: "reservation",
});
