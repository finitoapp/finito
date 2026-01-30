import {
	createEvolu,
	id,
	Mnemonic,
	NonEmptyString100,
	NonEmptyString1000,
	PositiveInt,
	type Evolu as RawEvolu,
	SimpleName,
	SqliteBoolean,
} from "@evolu/common";
import { evoluReactWebDeps } from "@evolu/react-web";

const DataTableId = id("DataTable");
const DataTableVisibilityStateId = id("DataTableVisibilityState");
const AccountId = id("Account");
const AccountEvoluTransportId = id("AccountEvoluTransport");

const DeviceSchema = {
	dataTable: {
		id: DataTableId,
		name: NonEmptyString100,
	},
	dataTableVisibilityState: {
		id: DataTableVisibilityStateId,
		dataTableId: DataTableId,
		name: NonEmptyString100,
		isHidden: SqliteBoolean,
	},
	account: {
		id: AccountId,
		name: NonEmptyString100,
		mnemonic: Mnemonic,
		lastUseAt: PositiveInt,
	},
	accountNostrRelay: {
		id: AccountEvoluTransportId,
		accountId: AccountId,
		isActive: SqliteBoolean,
		url: NonEmptyString1000,
	},
	accountEvoluTransport: {
		id: AccountEvoluTransportId,
		accountId: AccountId,
		type: NonEmptyString100,
		isActive: SqliteBoolean,
	},
	accountEvoluTransportWebsocket: {
		id: AccountEvoluTransportId,
		url: NonEmptyString1000,
	},
} as const;

export const createDeviceEvolu = () => {
	const evolu = createEvolu(evoluReactWebDeps)(DeviceSchema, {
		name: SimpleName.orThrow("Finito-Device"),
		// enableLogging: true,
		transports: [], // Disable syncing for now
		indexes: () => [],
		// indexes: (create) =>
		// 	storages.map((storage) =>
		// 		create(`${storage.namespace}_createdOrUpdatedAt`)
		// 			.on(`${storage.namespace}`)
		// 			.column("createdOrUpdatedAt"),
		// 	),
	});

	evolu.subscribeError(() => {
		const error = evolu.getError();
		if (!error) return;

		alert("🚨 Evolu error occurred! Check the console.");
		// eslint-disable-next-line no-console
		console.error(error);
	});

	return evolu;
};

export type DeviceEvolu = RawEvolu<typeof DeviceSchema>;
