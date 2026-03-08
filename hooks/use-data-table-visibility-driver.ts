"use client";

import { createIdFromString, sqliteFalse, sqliteTrue } from "@evolu/common";
import type {
	OnChangeFn,
	Updater,
	VisibilityState,
} from "@tanstack/react-table";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { createDeviceQuery } from "@/lib/evolu/device";
import { NonEmptyString255 } from "@/lib/shared/types";

const resolveVisibilityState = (
	updater: Updater<VisibilityState>,
): VisibilityState => {
	return typeof updater === "function" ? updater({}) : updater;
};

export const useDataTableVisibilityDriver = (tableKey: string) => {
	const deviceEvolu = useAtomValue(deviceEvoluAtom);

	return useMemo(
		() => ({
			set: ((updater: Updater<VisibilityState>) => {
				const dataTableId = createIdFromString(tableKey);
				const nextVisibility = resolveVisibilityState(updater);

				for (const [name, isVisible] of Object.entries(nextVisibility)) {
					if (isVisible) {
						deviceEvolu.update("dataTableVisibilityState", {
							id: createIdFromString(`${tableKey}.${name}`),
							isDeleted: sqliteTrue,
						});
					} else {
						deviceEvolu.upsert("dataTableVisibilityState", {
							id: createIdFromString(`${tableKey}.${name}`),
							dataTableId,
							name: NonEmptyString255(name),
							isHidden: sqliteTrue,
							isDeleted: sqliteFalse,
						});
					}
				}
			}) satisfies OnChangeFn<VisibilityState>,
			subscribe: (callback: (visibility: VisibilityState) => void) => {
				const dataTableId = createIdFromString(tableKey);
				const query = createDeviceQuery((db) =>
					db
						.selectFrom("dataTableVisibilityState")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("dataTableId", "=", dataTableId as never),
				);

				const fetchData = async () => {
					const data = await deviceEvolu.loadQuery(query);
					callback(
						Object.fromEntries(data.map((row) => [row.name, !row.isHidden])),
					);
				};

				void fetchData();
				return deviceEvolu.subscribeQuery(query)(() => {
					void fetchData();
				});
			},
		}),
		[deviceEvolu, tableKey],
	);
};
