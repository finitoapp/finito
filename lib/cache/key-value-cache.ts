import { createIdFromString, sqliteTrue } from "@evolu/common";
import { createDeviceQuery } from "@/lib/evolu/device";
import type { DeviceEvoluDep } from "@/lib/shared/dependencies";

export type CacheValue = number | string;

export const getCachedValue = (deps: DeviceEvoluDep) => async (key: string) => {
	const cachedValues = await deps.deviceEvolu.loadQuery(
		createDeviceQuery((db) =>
			db
				.selectFrom("keyValueCache")
				.select(["value"])
				.where("isDeleted", "is not", sqliteTrue)
				.where("id", "=", createIdFromString(key))
				.limit(1),
		),
	);

	return cachedValues[0]?.value;
};

export const setCachedValue =
	(deps: DeviceEvoluDep) => async (key: string, value: CacheValue) => {
		deps.deviceEvolu.upsert("keyValueCache", {
			id: createIdFromString(key),
			value,
		});
	};
