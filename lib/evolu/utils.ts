import type { Query, QueryRows, Row } from "@evolu/common";
import type { Evolu } from "@/lib/evolu/index";

export function subscribeToEvoluQuery<T extends Row>(
	evolu: Evolu,
	query: Query<T>,
	callback: (values: QueryRows<T>) => void,
) {
	void evolu.loadQuery(query);
	callback(evolu.getQueryRows(query));

	return evolu.subscribeQuery(query)(() => {
		callback(evolu.getQueryRows(query));
	});
}

export const createExternalStoreForEvoluQuery =
	<T extends Row>(evolu: Evolu, query: Query<T>) =>
	(callback: (values: QueryRows<T>) => void) => {
		void evolu.loadQuery(query);
		callback(evolu.getQueryRows(query));

		return evolu.subscribeQuery(query)(() => {
			callback(evolu.getQueryRows(query));
		});
	};
