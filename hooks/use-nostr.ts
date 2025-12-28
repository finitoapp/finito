import { useAtomValue } from "jotai";
import { ndkAtom } from "@/atoms/ndk";
import { nostrSignerAtom } from "@/atoms/nostr-signer";

export const useNostr = () => {
	const ndk = useAtomValue(ndkAtom);
	useAtomValue(nostrSignerAtom);

	return {
		ndk: ndk,
	};
};
