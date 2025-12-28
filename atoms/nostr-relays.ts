import { atomWithStorage } from "jotai/utils";
import { WssUrl } from "@/lib/types";

export const defaultRelays = [
	WssUrl("wss://relay.primal.net"),
	WssUrl("wss://relay.damus.io"),
];

export const nostrRelaysAtom = atomWithStorage<{
	relays: WssUrl[];
}>(
	"nostrRelays",
	{
		relays: defaultRelays,
	},
	undefined,
	{
		getOnInit: true,
	},
);
