import { sha256 } from "@noble/hashes/sha2.js";
import NDK, {
	NDKPrivateKeySigner,
	type NDKSigner,
	type NDKUser,
} from "@nostr-dev-kit/ndk";
import { atom } from "jotai";
import { privateKeyFromSeedWords } from "nostr-tools/nip06";
import { nostrRelaysAtom } from "@/atoms/nostr-relays";
import { seedAtom } from "@/atoms/seed";
import { NonEmptyString } from "@/lib/types";
import { accountStorage } from "@/storages/account-storage";

const rawNdkAtom = atom<Promise<NDK>>(async () => {
	// const cacheAdapter = new NDKCacheAdapterSqliteWasm({ dbName: "ndk-cache" });
	// const cacheAdapter = new NDKCacheAdapterSqlite({ dbName: "ndk-cache" });
	const cacheAdapter = undefined;
	// const cacheAdapter =
	// 	typeof window !== "undefined"
	// 		? new NDKCacheAdapterDexie({ dbName: "ndk-cache" })
	// 		: undefined;

	const ndk = new NDK({
		explicitRelayUrls: [],
		cacheAdapter,
	});

	console.log("ndk", "connecting");
	await ndk.connect();

	return ndk;
});

const ndkSignerAtom = atom<Promise<NDKSigner>>(async (get) => {
	const seed = get(seedAtom);
	if (seed === null) {
		return NDKPrivateKeySigner.generate();
	}

	const privateKey = privateKeyFromSeedWords(seed);

	return new NDKPrivateKeySigner(privateKey);
});

export const ndkAtom = atom(async (get) => {
	const [nostrRelays, ndk, signer, seed] = await Promise.all([
		get(nostrRelaysAtom),
		get(rawNdkAtom),
		get(ndkSignerAtom),
		get(seedAtom),
	]);

	ndk.signer = signer;

	const finalNdk = ndk as NDK & {
		signer: NDKSigner;
		activeUser: NDKUser;
	};

	const currentRelays = Object.keys(finalNdk.pool.relays);
	const relaysToRemove = currentRelays.filter(
		(currentRelay) => !(nostrRelays.relays as string[]).includes(currentRelay),
	);

	const relaysToAdd = nostrRelays.relays.filter(
		(currentRelay) => !currentRelays.includes(currentRelay),
	);

	for (const relayToRemove of relaysToRemove) {
		finalNdk.pool.removeRelay(relayToRemove);
	}

	for (const relayToAdd of relaysToAdd) {
		finalNdk.addExplicitRelay(relayToAdd, undefined, true);
	}

	await finalNdk.connect();

	// Create default Spark wallet
	await (async () => {
		const msgBuffer = new TextEncoder().encode(seed);
		const hashBuffer = sha256(msgBuffer);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const id = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

		await accountStorage.insertOrUpdate(finalNdk, id, {
			id,
			name: NonEmptyString("Default"),
			_tag: "spark",
			mnemonic: NonEmptyString(seed),
		});
	})();

	return finalNdk;
});
