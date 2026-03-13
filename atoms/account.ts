import {
	createId,
	createOwnerSecret,
	createRandomBytes,
	evoluJsonArrayFrom,
	evoluJsonObjectFrom,
	type Id,
	type KyselyNotNull,
	ownerSecretToMnemonic,
	sqliteFalse,
	sqliteTrue,
} from "@evolu/common";
import { faker } from "@faker-js/faker";
import { atom } from "jotai";
import { UAParser } from "ua-parser-js";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { evoluCounterAtom } from "@/atoms/evolu-counter";
import { createDeviceQuery } from "@/lib/evolu/device";
import { NonEmptyString255, TimestampMs, WssUrl } from "@/lib/shared/types";

const getDeviceId = () => {
	const id = (localStorage.getItem("finito.deviceId") ??
		createId({
			randomBytes: createRandomBytes(),
		})) as Id;
	localStorage.setItem("finito.deviceId", id);

	return id;
};

const getDevice = () => {
	const uap = new UAParser();

	const device = uap.getDevice();
	const browser = uap.getBrowser();
	const os = uap.getOS();

	return {
		id: getDeviceId(),
		name: NonEmptyString255(faker.internet.username()),
		deviceType: device.type ?? null,
		deviceVendor: device.vendor ?? null,
		browserName: browser.name ?? null,
		osName: os.name ?? null,
	};
};

export const accountAtom = atom(async (get) => {
	get(evoluCounterAtom); // Because we want to reload evolu when counter is increased
	const deviceEvolu = await get(deviceEvoluAtom);

	const query = createDeviceQuery((db) =>
		db
			.selectFrom("account")
			.select((eb) => [
				"account.id as id",
				"account.mnemonic as mnemonic",
				"account.name as name",

				evoluJsonObjectFrom(
					eb
						.selectFrom("device")
						.select(["device.id as id", "device.name as name"])
						.where("device.isDeleted", "is not", sqliteTrue)
						.where("device.name", "is not", null)
						.$narrowType<{
							name: KyselyNotNull;
						}>(),
				).as("device"),

				evoluJsonArrayFrom(
					eb
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
						.whereRef("accountEvoluTransport.accountId", "=", "account.id")
						.where("accountEvoluTransport.isDeleted", "is not", sqliteTrue)
						.where("accountEvoluTransport.type", "is not", null)
						.where("accountEvoluTransportWebsocket.url", "is not", null)
						.where("accountEvoluTransport.isActive", "=", sqliteTrue)
						.where(
							"accountEvoluTransportWebsocket.isDeleted",
							"is not",
							sqliteTrue,
						)
						.$narrowType<{
							type: KyselyNotNull;
							url: KyselyNotNull;
						}>(),
				).as("transports"),
			])
			.where("isDeleted", "is not", sqliteTrue)
			.where("account.mnemonic", "is not", null)
			.where("account.name", "is not", null)
			.orderBy("lastUseAt", "desc")
			.limit(1)
			.$narrowType<{
				name: KyselyNotNull;
				mnemonic: KyselyNotNull;
			}>(),
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
			name: NonEmptyString255(faker.internet.username()),
			mnemonic,
			lastUseAt: TimestampMs(Date.now()),
		};
		const id = await new Promise<Id>((resolve) => {
			const { id: accountId } = deviceEvolu.insert("account", data, {
				onComplete: () => {
					resolve(accountId);
				},
			});
			const { id } = deviceEvolu.insert("accountEvoluTransport", {
				accountId,
				type: "WebSocket",
				isActive: sqliteFalse,
			});
			deviceEvolu.upsert("accountEvoluTransportWebsocket", {
				id,
				url: WssUrl("wss://free.evoluhq.com"),
			});
		});

		const device = getDevice();
		deviceEvolu.upsert("device", device);

		return {
			id,
			mnemonic: data.mnemonic,
			name: data.name,
			transports: [],
			device,
		};
	}

	let device = row.device;
	if (device === null) {
		device = getDevice();
		deviceEvolu.upsert("device", device);
	}

	return {
		id: row.id,
		mnemonic: row.mnemonic,
		name: row.name,
		transports: row.transports,
		device,
	};
});
