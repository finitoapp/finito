import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { createStore } from "jotai";
import { z } from "zod";
import { ndkAtom } from "@/atoms/ndk";
import { nostrSignerAtom } from "@/atoms/nostr-signer";
import { createNostrStorage } from "@/lib/nostr-storage";

(async () => {
	const nsec =
		"nsec1ylaxw6rp4jf96ar29kzzhus7ntkp5t26s9nk8xjva26tawd94w8s86968n";
	const store = createStore();
	await store.set(nostrSignerAtom, {
		ndkSignerPayload: new NDKPrivateKeySigner(nsec).toPayload(),
	});
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
