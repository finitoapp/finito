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

	// const result = await myStorage.select(ndk);
	// const result = await myStorage.delete(
	// 	ndk,
	// 	"fdc9c2bdf91f4c1576295efb7157986a98e658008e5f80a18bd88bdca5f16715",
	// );
	const result = await myStorage.insertOrUpdate(ndk, "key2", {
		isSuper: false,
	});

	console.log("result", JSON.stringify(result, null, 2));
})();
