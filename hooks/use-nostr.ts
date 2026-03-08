import { useAtomValue } from "jotai";
import { ndkAtom } from "@/atoms/ndk";

export const useNostr = () => {
	const ndk = useAtomValue(ndkAtom);

	return {
		ndk: ndk,
	};
};
