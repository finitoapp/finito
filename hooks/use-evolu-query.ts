import type { Query, QueryRows, Row } from "@evolu/common";
import { use, useMemo, useSyncExternalStore } from "react";
import { useEvolu } from "@/hooks/use-evolu";

export const useEvoluQuery = <R extends Row>(
	query: Query<R>,
	evoluOverride?: {
		loadQuery: (query: Query<R>) => Promise<R[]>;
		getQueryRows: (query: Query<R>) => QueryRows<R>;
		subscribeQuery: (query: Query<R>) => (callback: () => void) => () => void;
	},
): { data: any[] | undefined } => {
	const evolu = useEvolu();
	const targetEvolu = evoluOverride ?? evolu;

	use(targetEvolu.loadQuery(query));

	const data = useSyncExternalStore(
		useMemo(() => targetEvolu.subscribeQuery(query), [targetEvolu, query]),
		useMemo(() => () => targetEvolu.getQueryRows(query), [targetEvolu, query]),
	);

	return {
		data,
	};
};
