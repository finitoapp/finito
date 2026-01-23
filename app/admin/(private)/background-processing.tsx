import { type FC, useEffect } from "react";
import type { EmptyObject } from "type-fest";
import { useStorageDeps } from "@/hooks/use-storage-deps";
import { notificationStorage } from "@/storages/notification-storage";

export const BackgroundProcessing: FC<EmptyObject> = () => {
	const storageDeps = useStorageDeps();

	useEffect(() => {
		(async () => {
			await notificationStorage.insertOrUpdate(
				storageDeps,
				"backgroundTableProcessing",
				{
					type: "backgroundTableProcessing",
				},
			);
		})();
	}, [storageDeps]);

	return null;
};
