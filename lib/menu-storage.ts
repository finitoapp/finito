import type { NostrMenu } from "@/lib/contracts/nostr/menu";
import { createNostrStorage } from "@/lib/nostr-storage";

export const menuStorage = createNostrStorage<NostrMenu>({
	namespace: "menu",
});
