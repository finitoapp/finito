import { atomWithStorage } from "jotai/utils";

export const nostrSignerAtom = atomWithStorage<null | {
	ndkSignerPayload: string;
}>("nostrSigner", null, undefined, {
	getOnInit: true,
});
