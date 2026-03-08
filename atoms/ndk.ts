import NDK, {
	NDKPrivateKeySigner,
	type NDKSigner,
	type NDKUser,
} from "@nostr-dev-kit/ndk";
import { atom } from "jotai";
import { privateKeyFromSeedWords } from "nostr-tools/nip06";
import { accountAtom } from "@/atoms/account";
import { nostrRelaysAtom } from "@/atoms/nostr-relays";

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

	await ndk.connect(5_000);

	return ndk;
});

const ndkSignerAtom = atom<Promise<NDKSigner>>(async (get) => {
	const { mnemonic } = await get(accountAtom);
	const privateKey = privateKeyFromSeedWords(mnemonic);

	return new NDKPrivateKeySigner(privateKey);
});

export const ndkAtom = atom(async (get) => {
	const [nostrRelays, ndk, signer] = await Promise.all([
		get(nostrRelaysAtom),
		get(rawNdkAtom),
		get(ndkSignerAtom),
	]);

	ndk.signer = signer;

	const finalNdk = ndk as NDK & {
		signer: NDKSigner;
		activeUser: NDKUser;
	};

	const currentRelays = Object.keys(finalNdk.pool.relays);
	const nostrRelayUrls = nostrRelays.map((relay) => relay.url);

	const relaysToRemove = currentRelays.filter(
		(currentRelay) => !(nostrRelayUrls as string[]).includes(currentRelay),
	);

	const relaysToAdd = nostrRelayUrls.filter(
		(currentRelay) => !currentRelays.includes(currentRelay),
	);

	for (const relayToRemove of relaysToRemove) {
		finalNdk.pool.removeRelay(relayToRemove);
	}

	for (const relayToAdd of relaysToAdd) {
		finalNdk.addExplicitRelay(relayToAdd, undefined, true);
	}

	return finalNdk;
});
