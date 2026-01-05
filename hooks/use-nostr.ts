import { useAtomValue } from "jotai";
import { ndkAtom } from "@/atoms/ndk";
import { seedAtom } from "@/atoms/seed";

export const useNostr = () => {
	const ndk = useAtomValue(ndkAtom);
	useAtomValue(seedAtom);

	return {
		ndk: ndk,
	};
};
