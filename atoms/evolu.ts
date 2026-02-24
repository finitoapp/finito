import { createIdFromString, getOrThrow, sqliteTrue } from "@evolu/common";
import { sha256 } from "@noble/hashes/sha2.js";
import { atom } from "jotai";
import { accountAtom } from "@/atoms/account";
import { createAppEvolu } from "@/lib/evolu";
import { NonEmptyString } from "@/lib/shared/types";

export const evoluAtom = atom(async (get) => {
	const account = await get(accountAtom);
	const evolu = createAppEvolu({
		mnemonic: account.mnemonic,
		transports: account.transports,
	});

	// Seed initial data
	(async () => {
		const appOwner = await evolu.appOwner;
		if (appOwner.mnemonic === null || appOwner.mnemonic === undefined)
			throw new Error(
				"App owner mnemonic is not set. Please create a new account.",
			);

		// Create default Spark wallet
		{
			const msgBuffer = new TextEncoder().encode(appOwner.mnemonic);
			const hashBuffer = sha256(msgBuffer);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			const id = createIdFromString(
				hashArray.map((b) => b.toString(16).padStart(2, "0")).join(""),
			);

			const data = await evolu.loadQuery(
				evolu.createQuery((db) =>
					db
						.selectFrom("account")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("id", "=", id),
				),
			);

			if (data.length === 0) {
				getOrThrow(
					evolu.upsert("account", {
						id,
						name: NonEmptyString("Default"),
						_tag: "accountSpark",
					}),
				);
				getOrThrow(
					evolu.upsert("accountSpark", {
						id,
						mnemonic: NonEmptyString(appOwner.mnemonic),
					}),
				);
			}
		}

		// Create background table processing
		{
			const id = createIdFromString(`backgroundTableProcessing`);
			const data = await evolu.loadQuery(
				evolu.createQuery((db) =>
					db
						.selectFrom("notification")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("id", "=", id),
				),
			);

			if (data.length === 0) {
				getOrThrow(
					evolu.upsert("notification", {
						id,
						type: "backgroundTableProcessing",
					}),
				);
				getOrThrow(
					evolu.upsert("notificationBackgroundTableProcessing", {
						id,
					}),
				);
			}
		}
	})();

	return evolu;
});
