import { createStore } from "jotai";
import { generateSeedWords } from "nostr-tools/nip06";
import { ndkAtom } from "@/atoms/ndk";
import { seedAtom } from "@/atoms/seed";
import { NonEmptyString } from "@/lib/types";

(async () => {
	const _nsec =
		"nsec1ylaxw6rp4jf96ar29kzzhus7ntkp5t26s9nk8xjva26tawd94w8s86968n";
	const store = createStore();
	await store.set(seedAtom, NonEmptyString(generateSeedWords()));
	const ndk = await store.get(ndkAtom);

	const result = await ndk.fetchEvents({
		// kinds: [9734],
		// kinds: [9735], // zap receipt
		// kinds: [5], // delete
		// kinds: [30078], // custom app data
		kinds: [1059], // Gift wrap
		// kinds: [9734],
		// kinds: [4],
		// authors: [ndk.activeUser.pubkey],
		// authors: [
		// 	"be1d89794bf92de5dd64c1e60f6a2c70c140abac9932418fee30c5c637fe9479",
		// ],
		// authors: [
		// 	"be1d89794bf92de5dd64c1e60f6a2c70c140abac9932418fee30c5c637fe9479",
		// ],
		// "#p": ["ed2ce1cfbb9853dfccd5ff673db506c8d931c4ca9439a00734b27fc985e4a386"],
		// "#p": [ndk.activeUser.pubkey],
		// "#e": [
		// 	nip19.decode(_npub).data
		// ],
		// '#finito_type': ['static_payment'],
		limit: 5,
	});

	const data = await Promise.all(
		result.values().map((row) => row.toNostrEvent()),
	);
	console.log("result", ...data);
})();
