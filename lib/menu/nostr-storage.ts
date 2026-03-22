import type { NostrMenu } from "@/lib/contracts/menu";
import type { NostrPayment } from "@/lib/contracts/payment";
import { createNostrStorage } from "@/lib/nostr/storage";

export const menuStorage = createNostrStorage<NostrMenu>({
	namespace: "menu",
});

export const paymentStorage = createNostrStorage<NostrPayment>({
	namespace: "payment",
});
