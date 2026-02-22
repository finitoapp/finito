import { getOrThrow, sqliteTrue } from "@evolu/common";
import { atom } from "jotai";
import { accountAtom } from "@/atoms/account";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { WssUrl } from "@/lib/types";

export const defaultRelays = [
	// WssUrl("wss://relay.primal.net"),
	// WssUrl("wss://relay.damus.io"),
	// WssUrl("wss://relay.iris.to"),
	WssUrl("wss://relay.snort.social"),
];

export const nostrRelaysAtom = atom<
	{
		url: WssUrl;
	}[]
>(async (get) => {
	const account = await get(accountAtom);
	const deviceEvolu = await get(deviceEvoluAtom);

	const query = deviceEvolu.createQuery(
		(db) =>
			db
				.selectFrom("accountNostrRelay")
				.select([
					"accountNostrRelay.id as id",
					"accountNostrRelay.isDeleted as isDeleted",
					"accountNostrRelay.isActive as isActive",
					"accountNostrRelay.url as url",
				])
				.where("accountNostrRelay.accountId", "=", account.id),
		// We want to check existence of all, so no need to verify isDeleted=false
		// .where("isDeleted", "is not", sqliteTrue)
	);

	// Create default values
	const data = await deviceEvolu.loadQuery(query);
	if (data.length === 0) {
		await new Promise<void>((resolve) => {
			for (const defaultRelay of defaultRelays) {
				getOrThrow(
					deviceEvolu.insert(
						"accountNostrRelay",
						{
							accountId: account.id,
							isActive: sqliteTrue,
							url: defaultRelay,
						},
						{
							onComplete: resolve,
						},
					),
				);
			}
		});

		return defaultRelays.map((relay) => ({ url: relay }));
	}

	return data
		.filter((row) => row.isActive && !row.isDeleted)
		.map((row) => ({
			url: row.url,
		}));
});
