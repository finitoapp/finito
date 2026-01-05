import { atomWithStorage } from "jotai/utils";
import type { NonEmptyString } from "@/lib/types";

export const seedsAtom = atomWithStorage<null | {
	seeds: Array<NonEmptyString>;
}>("seeds", null, undefined, {
	getOnInit: true,
});
