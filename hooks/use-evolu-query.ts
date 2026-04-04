import type { Query, QueryRows, Row } from "@evolu/common";
import { use, useMemo, useSyncExternalStore } from "react";
import { useEvolu } from "@/hooks/use-evolu";
import type { EvoluSchema } from "@/lib/evolu";

export const useEvoluQuery = <R extends Row>(
	query: Query<EvoluSchema, R>,
	evoluOverride?: {
		loadQuery: (
			query: Query<EvoluSchema, NoInfer<R>>,
		) => Promise<QueryRows<NoInfer<R>>>;
		getQueryRows: (
			query: Query<EvoluSchema, NoInfer<R>>,
		) => QueryRows<NoInfer<R>>;
		subscribeQuery: (
			query: Query<EvoluSchema, NoInfer<R>>,
		) => (callback: () => void) => () => void;
	},
): { data: QueryRows<R> } => {
	const evolu = useEvolu();
	const targetEvolu = evoluOverride ?? evolu;

	use(targetEvolu.loadQuery(query));

	const data = useSyncExternalStore(
		useMemo(() => targetEvolu.subscribeQuery(query), [targetEvolu, query]),
		useMemo(() => () => targetEvolu.getQueryRows(query), [targetEvolu, query]),
	);

	return {
		data: data as QueryRows<R>,
	};
};
