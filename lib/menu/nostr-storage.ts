import type { NostrMenu } from "@/lib/nostr/contracts/menu";
import { createNostrStorage } from "@/lib/nostr/storage";

export const menuStorage = createNostrStorage<NostrMenu>({
	namespace: "menu",
});
