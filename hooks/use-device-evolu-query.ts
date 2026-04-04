import type { Query, QueryRows, Row } from "@evolu/common";
import { useAtomValue } from "jotai";
import { use, useMemo, useSyncExternalStore } from "react";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import type { DeviceEvoluSchema } from "@/lib/evolu/device";

export const useDeviceEvoluQuery = <R extends Row>(
	query: Query<DeviceEvoluSchema, R>,
): { data: QueryRows<R> } => {
	const evolu = useAtomValue(deviceEvoluAtom);

	use(evolu.loadQuery(query));

	const data = useSyncExternalStore(
		useMemo(() => evolu.subscribeQuery(query), [evolu, query]),
		useMemo(() => () => evolu.getQueryRows(query), [evolu, query]),
	);

	return {
		data: data as QueryRows<R>,
	};
};
