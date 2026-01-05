import { atomWithStorage } from "jotai/utils";
import { generateSeedWords } from "nostr-tools/nip06";
import { NonEmptyString } from "@/lib/types";

export const seedAtom = atomWithStorage<NonEmptyString>(
	"seed",
	NonEmptyString(generateSeedWords()),
	{
		getItem: (key) => {
			const result = localStorage.getItem(key);
			if (result !== null) {
				return NonEmptyString(result);
			}

			const seed = NonEmptyString(generateSeedWords());
			localStorage.setItem(key, seed);
			return seed;
		},
		setItem: (key, value) => {
			localStorage.setItem(key, value);
		},
		removeItem: (key) => {
			localStorage.removeItem(key);
		},
	},
	{
		getOnInit: true,
	},
);
