import {
	AppName,
	createEvolu,
	createQueryBuilder,
	getOrThrow,
	Mnemonic,
	type Evolu as RawEvolu,
	testAppOwner,
} from "@evolu/common";
import { createEvoluDeps, createRun } from "@evolu/web";
import { z } from "zod";
import { TableIdSchema } from "@/lib/evolu/types";
import {
	NonEmptyString255Schema,
	SqliteBoolSchema,
	TimestampMsSchema,
	WssUrlSchema,
} from "@/lib/shared/types";

const DeviceSchema = {
	dataTable: {
		id: TableIdSchema,
		name: NonEmptyString255Schema,
	},
	dataTableVisibilityState: {
		id: TableIdSchema,
		dataTableId: TableIdSchema,
		name: NonEmptyString255Schema,
		isHidden: SqliteBoolSchema,
	},
	account: {
		id: TableIdSchema,
		name: NonEmptyString255Schema,
		mnemonic: Mnemonic,
		lastUseAt: TimestampMsSchema,
	},
	accountNostrRelay: {
		id: TableIdSchema,
		accountId: TableIdSchema,
		isActive: SqliteBoolSchema,
		url: WssUrlSchema,
	},
	accountEvoluTransport: {
		id: TableIdSchema,
		accountId: TableIdSchema,
		type: z.enum(["WebSocket"]),
		isActive: SqliteBoolSchema,
	},
	accountEvoluTransportWebsocket: {
		id: TableIdSchema,
		url: WssUrlSchema,
	},
	device: {
		id: TableIdSchema,
		name: NonEmptyString255Schema,
		deviceType: z.string().nullable(),
		deviceVendor: z.string().nullable(),
		browserName: z.string().nullable(),
		osName: z.string().nullable(),
	},
	keyValueCache: {
		id: TableIdSchema,
		value: z.union([z.string(), z.number()]).nullable(),
	},
} as const;

export const createDeviceQuery = createQueryBuilder(DeviceSchema);

export const createDeviceEvolu = async () => {
	const run = createRun(createEvoluDeps());
	const evolu = getOrThrow(
		await createEvolu(DeviceSchema, {
			appName: AppName.orThrow("FinitoDevice"),
			appOwner: testAppOwner,
			// enableLogging: true,
			transports: [], // Disable syncing for now
			indexes: () => [],
			// indexes: (create) =>
			// 	storages.map((storage) =>
			// 		create(`${storage.namespace}_createdOrUpdatedAt`)
			// 			.on(`${storage.namespace}`)
			// 			.column("createdOrUpdatedAt"),
			// 	),
		})(run),
	);

	// (async () => {
	// 	console.log("deviceAppOwner", await evolu.appOwner);
	// })();
	//
	// evolu.subscribeError(() => {
	// 	const error = evolu.getError();
	// 	if (!error) return;
	//
	// 	alert("🚨 Evolu error occurred! Check the console.");
	// 	// eslint-disable-next-line no-console
	// 	console.error(error);
	// });

	return evolu;
};

export type DeviceEvolu = RawEvolu<typeof DeviceSchema>;
