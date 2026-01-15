import type { JsonObject } from "type-fest";
import type { z } from "zod";

export type StorageEventId = string & z.$brand<"StorageEventId">;

export type StorageRow<TShape extends Readonly<JsonObject>> = {
	value: TShape;
	createdAt: number;
	eventId: StorageEventId;
	key: string | null;
};

export type Storage<TDeps, TShape extends JsonObject> = {
	namespace: string;
	$shape: TShape;
	$deps: TDeps;
	schema: z.Schema<TShape>;

	select: (
		deps: TDeps,
		params?: {
			key?: string | null;
			limit?: number;
			since?: number;
			until?: number;
		},
	) => Promise<{
		data: StorageRow<TShape>[];
	}>;
	subscribe: (
		deps: TDeps,
		params: {
			key?: string | null;
			limit?: number;
			since?: number;
			until?: number;
			// on eose
			onEvents: (data: {
				getAllRows: () => Record<string, StorageRow<TShape>>;
				hasNextPage: boolean;
			}) => unknown;
			// after eose per each event
			onEvent: (data: {
				row: StorageRow<TShape>;
				getAllRows: () => Record<string, StorageRow<TShape>>;
			}) => unknown;
			// when a row is deleted by kind 5
			onDelete: (data: {
				deletedRow: StorageRow<TShape>;
				getAllRows: () => Record<string, StorageRow<TShape>>;
			}) => unknown;
		},
	) => {
		close: () => void;
		fetchNextPage: () => void;
	};
	insertOrUpdate: (
		deps: TDeps,
		key: string | null,
		value: TShape,
	) => Promise<StorageRow<TShape>>;
	delete: (
		deps: TDeps,
		eventId: StorageEventId,
	) => Promise<{ eventId: StorageEventId }>;
};
