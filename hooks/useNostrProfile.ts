import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@/hooks/use-nostr";

export const useNostrProfile = () => {
	const { ndk } = useNostr();
	const { data } = useQuery({
		queryKey: [`ndkUserProfile-${ndk.activeUser.pubkey}`],
		queryFn: () =>
			ndk.activeUser.fetchProfile({
				skipOptimisticPublishEvent: true,
			}),
	});

	return data;
};
