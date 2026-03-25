import {
	createId,
	createOwnerSecret,
	createRandomBytes,
	evoluJsonArrayFrom,
	evoluJsonObjectFrom,
	type Id,
	type KyselyNotNull,
	type Mnemonic,
	ownerSecretToMnemonic,
	sqliteFalse,
	sqliteTrue,
} from "@evolu/common";
import { faker } from "@faker-js/faker";
import { atom } from "jotai";
import { UAParser } from "ua-parser-js";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { evoluCounterAtom } from "@/atoms/evolu-counter";
import type { DeviceEvolu } from "@/lib/evolu/device";
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

const activeAccountQuery = createDeviceQuery((db) =>
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
		.where("account.isDeleted", "is not", sqliteTrue)
		.where("account.mnemonic", "is not", null)
		.where("account.name", "is not", null)
		.orderBy("account.lastUseAt", "desc")
		.limit(1)
		.$narrowType<{
			name: KyselyNotNull;
			mnemonic: KyselyNotNull;
		}>(),
);

export const createAccountMnemonic = (): Mnemonic =>
	ownerSecretToMnemonic(
		createOwnerSecret({
			randomBytes: createRandomBytes(),
		}),
	);

const createRandomAccountName = () =>
	NonEmptyString255(faker.internet.username());

const insertAccount = (
	deviceEvolu: DeviceEvolu,
	mnemonic: Mnemonic,
	onComplete: () => void,
) => {
	const { id: accountId } = deviceEvolu.insert(
		"account",
		{
			name: createRandomAccountName(),
			mnemonic,
			lastUseAt: TimestampMs(Date.now()),
		},
		{
			onComplete,
		},
	);
	const { id } = deviceEvolu.insert("accountEvoluTransport", {
		accountId,
		type: "WebSocket",
		isActive: sqliteFalse,
	});
	deviceEvolu.upsert("accountEvoluTransportWebsocket", {
		id,
		url: WssUrl("wss://free.evoluhq.com"),
	});
};

export const activateOrCreateAccountWithMnemonic = async (
	deviceEvolu: DeviceEvolu,
	mnemonic: Mnemonic,
) => {
	const existingAccount = await deviceEvolu.loadQuery(
		createDeviceQuery((db) =>
			db
				.selectFrom("account")
				.select(["account.id as id"])
				.where("account.isDeleted", "is not", sqliteTrue)
				.where("account.mnemonic", "=", mnemonic)
				.limit(1),
		),
	);

	await new Promise<void>((resolve) => {
		const account = existingAccount[0];
		if (account !== undefined) {
			deviceEvolu.update(
				"account",
				{
					id: account.id,
					lastUseAt: TimestampMs(Date.now()),
				},
				{
					onComplete: resolve,
				},
			);
			return;
		}

		insertAccount(deviceEvolu, mnemonic, resolve);
	});
};

const activeAccountRowAtom = atom(async (get) => {
	get(evoluCounterAtom); // We want to reload evolu when counter is increased
	const deviceEvolu = await get(deviceEvoluAtom);
	const data = await deviceEvolu.loadQuery(activeAccountQuery);

	return data[0] ?? null;
});

export const hasDeviceAccountAtom = atom(async (get) => {
	const activeAccount = await get(activeAccountRowAtom);

	return activeAccount !== null;
});

export const accountAtom = atom(async (get) => {
	const deviceEvolu = await get(deviceEvoluAtom);
	const row = await get(activeAccountRowAtom);

	if (row === null) {
		throw new Error(
			"No active account found in device Evolu. Complete onboarding first.",
		);
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
