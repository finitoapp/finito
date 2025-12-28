import { type FC, useEffect } from "react";
import type { EmptyObject } from "type-fest";
import { useNostr } from "@/hooks/use-nostr";
import { notificationStorage } from "@/storages/notification-storage";

export const BackgroundProcessing: FC<EmptyObject> = () => {
	const { ndk } = useNostr();
	useEffect(() => {
		(async () => {
			await notificationStorage.insertOrUpdate(
				ndk,
				"backgroundTableProcessing",
				{
					type: "backgroundTableProcessing",
				},
			);
		})();
	}, [ndk]);

	return null;
};
