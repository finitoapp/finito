import {
	createOwnerSecret,
	createRandomBytes,
	getOrThrow,
	type Id,
	NonEmptyString100,
	ownerSecretToMnemonic,
	PositiveInt,
	sqliteFalse,
	sqliteTrue,
} from "@evolu/common";
import { faker } from "@faker-js/faker";
import { atom } from "jotai";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { evoluCounterAtom } from "@/atoms/evolu-counter";

export const accountAtom = atom(async (get) => {
	get(evoluCounterAtom); // Because we want to reload evolu when counter is increased
	const deviceEvolu = await get(deviceEvoluAtom);

	const query = deviceEvolu.createQuery((db) =>
		db
			.selectFrom("account")
			.select([
				"account.id as id",
				"account.mnemonic as mnemonic",
				"account.name as name",
			])
			.where("isDeleted", "is not", sqliteTrue)
			.orderBy("lastUseAt", "desc")
			.limit(1),
	);

	// Create default values
	const data = await deviceEvolu.loadQuery(query);
	const row = data[0];

	if (row === undefined) {
		const ownerSecret = createOwnerSecret({
			randomBytes: createRandomBytes(),
		});
		const mnemonic = ownerSecretToMnemonic(ownerSecret);

		const data = {
			name: NonEmptyString100.orThrow(faker.internet.username()),
			mnemonic,
			lastUseAt: PositiveInt.orThrow(Date.now()),
		};
		const id = await new Promise<Id>((resolve) => {
			const { id: accountId } = getOrThrow(
				deviceEvolu.insert("account", data, {
					onComplete: () => {
						resolve(accountId);
					},
				}),
			);
			const { id } = getOrThrow(
				deviceEvolu.insert("accountEvoluTransport", {
					accountId,
					type: "websocket",
					isActive: sqliteFalse,
				}),
			);
			getOrThrow(
				deviceEvolu.upsert("accountEvoluTransportWebsocket", {
					id,
					url: "wss://free.evoluhq.com",
				}),
			);
		});

		return {
			id,
			mnemonic: data.mnemonic,
			name: data.name,
			transports: [
				{
					type: "websocket",
					url: "wss://free.evoluhq.com",
				},
			],
		};
	}

	const transports = await deviceEvolu.loadQuery(
		deviceEvolu.createQuery((db) =>
			db
				.selectFrom("accountEvoluTransport")
				.leftJoin(
					"accountEvoluTransportWebsocket",
					"accountEvoluTransportWebsocket.id",
					"accountEvoluTransport.id",
				)
				.select([
					"accountEvoluTransport.type as type",
					"accountEvoluTransportWebsocket.url as url",
				])
				.where("accountEvoluTransport.accountId", "=", row.id)
				.where("accountEvoluTransport.isDeleted", "is not", sqliteTrue)
				.where("accountEvoluTransport.isActive", "=", sqliteTrue)
				.where(
					"accountEvoluTransportWebsocket.isDeleted",
					"is not",
					sqliteTrue,
				),
		),
	);

	return {
		id: row.id,
		mnemonic: row.mnemonic,
		name: row.name,
		transports: transports.map((transport) => ({
			type: transport.type,
			url: transport.url,
		})),
	};
});
