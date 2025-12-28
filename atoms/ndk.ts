import NDK, {
	NDKPrivateKeySigner,
	type NDKSigner,
	type NDKUser,
	ndkSignerFromPayload,
} from "@nostr-dev-kit/ndk";
import { atom } from "jotai";
import { nostrRelaysAtom } from "@/atoms/nostr-relays";
import { nostrSignerAtom } from "@/atoms/nostr-signer";

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
	const nostrSigner = get(nostrSignerAtom);
	const ndk = await get(rawNdkAtom);

	if (nostrSigner === null) {
		return NDKPrivateKeySigner.generate();
	}

	const signer = await ndkSignerFromPayload(nostrSigner.ndkSignerPayload, ndk);

	return signer ?? NDKPrivateKeySigner.generate();
});

export const ndkAtom = atom(async (get) => {
	const nostrRelays = get(nostrRelaysAtom);
	const [ndk, signer] = await Promise.all([
		get(rawNdkAtom),
		get(ndkSignerAtom),
	]);

	ndk.signer = signer;

	const currentRelays = Object.keys(ndk.pool.relays);
	const relaysToRemove = currentRelays.filter(
		(currentRelay) => !(nostrRelays.relays as string[]).includes(currentRelay),
	);

	const relaysToAdd = nostrRelays.relays.filter(
		(currentRelay) => !currentRelays.includes(currentRelay),
	);

	for (const relayToRemove of relaysToRemove) {
		ndk.pool.removeRelay(relayToRemove);
	}

	for (const relayToAdd of relaysToAdd) {
		ndk.addExplicitRelay(relayToAdd, undefined, true);
	}

	return ndk as NDK & {
		signer: NDKSigner;
		activeUser: NDKUser;
	};
});
