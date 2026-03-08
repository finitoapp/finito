import type { NostrMenu } from "@/lib/nostr/contracts/menu";
import type { NostrPayment } from "@/lib/nostr/contracts/payment";
import { createNostrStorage } from "@/lib/nostr/storage";

export const menuStorage = createNostrStorage<NostrMenu>({
	namespace: "menu",
});

export const paymentStorage = createNostrStorage<NostrPayment>({
	namespace: "payment",
});
