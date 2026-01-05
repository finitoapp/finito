import { createStore } from "jotai";
import { generateSeedWords } from "nostr-tools/nip06";
import { z } from "zod";
import { ndkAtom } from "@/atoms/ndk";
import { seedAtom } from "@/atoms/seed";
import { createNostrStorage } from "@/lib/nostr-storage";
import { NonEmptyString } from "@/lib/types";

(async () => {
	const _nsec =
		"nsec1ylaxw6rp4jf96ar29kzzhus7ntkp5t26s9nk8xjva26tawd94w8s86968n";
	const store = createStore();
	await store.set(seedAtom, NonEmptyString(generateSeedWords()));
	const ndk = await store.get(ndkAtom);

	const myStorage = createNostrStorage({
		namespace: "test_storage",
		schema: z.object({
			isSuper: z.boolean(),
		}),
	});

	const _result = await myStorage.subscribe(ndk, {
		onEvent: () => {
			console.log("eose");
		},
		onEvents: (data) => {
			console.log("result", JSON.stringify(data, null, 2));
		},
		onDelete: (data) => {
			console.log("result", JSON.stringify(data, null, 2));
		},
	});
})();
