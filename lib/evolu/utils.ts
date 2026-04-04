import type { Evolu, EvoluSchema, Query, QueryRows, Row } from "@evolu/common";

export function subscribeToEvoluQuery<S extends EvoluSchema, R extends Row>(
	evolu: Evolu<S>,
	query: Query<S, R>,
	callback: (values: QueryRows<R>) => void,
) {
	void evolu.loadQuery(query);
	callback(evolu.getQueryRows(query));

	return evolu.subscribeQuery(query)(() => {
		callback(evolu.getQueryRows(query));
	});
}

export const createExternalStoreForEvoluQuery =
	<S extends EvoluSchema, R extends Row>(evolu: Evolu<S>, query: Query<S, R>) =>
	(callback: (values: QueryRows<R>) => void) => {
		void evolu.loadQuery(query);
		callback(evolu.getQueryRows(query));

		return evolu.subscribeQuery(query)(() => {
			callback(evolu.getQueryRows(query));
		});
	};
