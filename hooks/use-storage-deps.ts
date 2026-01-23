import { useMemo } from "react";
import { useNostr } from "@/hooks/use-nostr";

export const useStorageDeps = () => {
	const { ndk } = useNostr();

	return useMemo(
		() => ({
			ndk,
		}),
		[ndk],
	);
};
