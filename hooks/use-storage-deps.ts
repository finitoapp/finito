import { useMemo } from "react";
import { useEvolu } from "@/hooks/use-evolu";
import { useNostr } from "@/hooks/use-nostr";

export const useStorageDeps = () => {
	const { ndk } = useNostr();
	const evolu = useEvolu();

	return useMemo(
		() => ({
			ndk,
			evolu,
		}),
		[ndk, evolu],
	);
};
