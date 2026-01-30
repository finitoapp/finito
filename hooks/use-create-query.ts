import type {
	IdBytes,
	InferType,
	Query,
	Row,
	SqliteValue,
	TimestampBytes,
} from "@evolu/common";
import type { SystemColumns } from "@evolu/common/local-first";
import type { Kysely, SelectQueryBuilder } from "kysely";
import { type DependencyList, useMemo } from "react";
import { useEvolu } from "@/hooks/use-evolu";
import type { EvoluSchema } from "@/lib/evolu";

export const useCreateQuery = <R extends Row>(
	callback: (
		db: Pick<
			Kysely<
				{
					[Table in keyof EvoluSchema]: {
						readonly [Column in keyof EvoluSchema[Table]]: Column extends "id"
							? InferType<EvoluSchema[Table][Column]>
							: InferType<EvoluSchema[Table][Column]> | null;
					} & SystemColumns;
				} & {
					readonly evolu_history: {
						readonly timestamp: TimestampBytes;
						readonly table: keyof EvoluSchema;
						readonly id: IdBytes;
						readonly column: string;
						readonly value: SqliteValue;
					};
					readonly evolu_message_quarantine: {
						readonly timestamp: TimestampBytes;
						readonly table: string;
						readonly id: IdBytes;
						readonly column: string;
						readonly value: SqliteValue;
					};
				}
			>,
			"selectFrom" | "fn" | "with" | "withRecursive"
		>,
	) => SelectQueryBuilder<any, any, R>,
	deps: DependencyList,
	evoluOverride?: {
		createQuery: (
			callback: (
				db: Pick<Kysely<any>, "selectFrom" | "fn" | "with" | "withRecursive">,
			) => SelectQueryBuilder<any, any, R>,
		) => Query<R>;
	},
	// ): Query<R> => {
): Query<any> => {
	const evolu = useEvolu();
	const targetEvolu = evoluOverride ?? evolu;

	return useMemo(
		() => targetEvolu.createQuery(callback),
		[targetEvolu, ...deps],
	);
};
