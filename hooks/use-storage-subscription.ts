import type { Id } from "@evolu/common";
import { useEffect, useRef, useState } from "react";
import { useStorageDeps } from "@/hooks/use-storage-deps";
import type { Storage, StorageRow } from "@/lib/storage";

export const useStorageSubscription = <TStorage extends Storage<any>>(
	storage: TStorage,
	options: {
		id?: Id | undefined;
		limit?: number | undefined;
	} = {},
): {
	data: undefined | StorageRow<TStorage["$shape"]>[];
	eose: boolean;
	hasNextPage: boolean;
	loadNextPage: () => unknown;
} => {
	const storageDeps = useStorageDeps();
	const subscriptionRef = useRef<ReturnType<typeof storage.subscribe> | null>(
		null,
	);
	const [data, setData] = useState<{
		data: undefined | StorageRow<TStorage["$shape"]>[];
		hasNextPage: boolean;
		eose: boolean;
	}>({
		data: undefined,
		eose: false,
		hasNextPage: true,
	});

	useEffect(() => {
		subscriptionRef.current = storage.subscribe(storageDeps, {
			id: options.id,
			limit: options.limit,
			onEvents: ({ getAllRows, hasNextPage }) => {
				if (subscriptionRef.current === null) {
					return;
				}

				setData((values) => ({
					...values,
					hasNextPage,
					data: Array.from(Object.values(getAllRows())),
					eose: true,
				}));
			},
			onEvent: ({ getAllRows }) => {
				if (subscriptionRef.current === null) {
					return;
				}

				setData((values) => ({
					...values,
					data: Array.from(Object.values(getAllRows())),
				}));
			},
			onDelete: ({ getAllRows }) => {
				if (subscriptionRef.current === null) {
					return;
				}

				setData((values) => ({
					...values,
					data: Array.from(Object.values(getAllRows())),
				}));
			},
		});

		return () => {
			if (subscriptionRef.current) {
				subscriptionRef.current.close();
				subscriptionRef.current = null;
			}
		};
	}, [storage.subscribe, options.id, options.limit, storage, storageDeps]);

	return {
		...data,
		loadNextPage: () => {
			if (subscriptionRef.current) {
				setData((values) => ({
					...values,
					eose: false,
				}));
				subscriptionRef.current.fetchNextPage();
			}
		},
	};
};
