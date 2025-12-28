import { atomWithStorage } from "jotai/utils";

export const nostrSignersAtom = atomWithStorage<null | {
	signers: Array<{
		ndkSignerPayload: string;
	}>;
}>("nostrSigners", null, undefined, {
	getOnInit: true,
});
