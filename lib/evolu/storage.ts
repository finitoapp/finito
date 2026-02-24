import type { EvoluSchema, Id } from "@evolu/common";
import type { JsonObject, ObjectMerge, ValueOf } from "type-fest";
import type { z } from "zod";
import type { Evolu } from "@/lib/evolu";

export type StorageCursor = string & z.$brand<"StorageCursor">;

export type StorageRow<TShape extends Readonly<JsonObject>> = {
	value: TShape & { id: Id; createdAt: number; updatedAt: number | null };
	cursor: StorageCursor;
};

export type StorageDeps = {
	evolu: Evolu;
};

export type Storage<
	TShape extends Readonly<JsonObject>,
	TNamespace extends string,
> = {
	namespace: TNamespace;
	$shape: TShape;
	schema: z.Schema<TShape>;
	evoluSchema?: ValueOf<EvoluSchema>;
	variants?: {
		discriminant: string;
		column: string;
		schema: EvoluSchema;
	};

	select: (
		deps: StorageDeps,
		params?: {
			id?: Id;
			limit?: number;
			since?: StorageCursor;
			until?: StorageCursor;
		},
	) => Promise<{
		data: StorageRow<TShape>[];
	}>;
	subscribe: (
		deps: StorageDeps,
		params: {
			id?: Id;
			limit?: number;
			since?: StorageCursor;
			until?: StorageCursor;
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
	insert: (
		deps: StorageDeps,
		value: ObjectMerge<TShape, { id?: never | undefined }>,
	) => Promise<StorageRow<TShape>>;
	upsert: (
		deps: StorageDeps,
		value: ObjectMerge<TShape, { id: Id }>,
	) => Promise<StorageRow<TShape>>;
	update: (
		deps: StorageDeps,
		value: ObjectMerge<TShape, { id: Id }>, // This should be partial, but currently nostr-storage can't implement it
	) => Promise<void>;
	insertOrUpdate: (
		deps: StorageDeps,
		value: ObjectMerge<TShape, { id?: Id | never | undefined }>,
	) => Promise<{ id: Id }>;
	delete: (deps: StorageDeps, value: { id: Id }) => Promise<void>;
};
