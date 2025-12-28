import { useAtomValue } from "jotai";
import { nostrRelaysAtom } from "@/atoms/nostr-relays";

export const useNostrRelays = () => {
	const { relays } = useAtomValue(nostrRelaysAtom);

	return {
		nostrRelays: relays,
	};
};
