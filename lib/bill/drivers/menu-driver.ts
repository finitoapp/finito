import type { BillDriver, BillSubscription } from "@/lib/bill/driver";
import { NostrMenu as NostrMenuSchema } from "@/lib/contracts/menu";
import { menuStorage } from "@/lib/menu/nostr-storage";

const menuBillIdRegex = /^(m|menu|menus)-([0-9a-f]{64})$/i;

export class MenuDriver implements BillDriver {
	public async subscribe({
		billId,
		callback,
		screenStack,
		ndk,
	}: Parameters<BillDriver["subscribe"]>[0]) {
		const [_, _prefix, pubkey] = menuBillIdRegex.exec(billId) ?? [
			null,
			null,
			null,
		];

		if (pubkey === null) {
			return null;
		}

		screenStack.replaceLast({
			variant: "loading",
			payload: {
				text: "Loading menu...",
			},
		});

		const subscriptionResult = await menuStorage.subscribe(
			{
				ndk,
				pubkey: pubkey.toLowerCase(),
			},
			(resultOrError) => {
				if (!resultOrError.ok) {
					console.error(resultOrError.error);
					return;
				}

				const result = NostrMenuSchema.safeParse(resultOrError.value);
				if (!result.success) {
					callback({
						type: "close",
						payload: {
							alertMessage: "Menu has an invalid structure...",
						},
					});
					return;
				}

				screenStack.replaceLast({
					variant: "menu",
					payload: result.data.payload,
				});
			},
		);

		if (!subscriptionResult.ok) {
			console.error(subscriptionResult.error);
			callback({
				type: "close",
				payload: {
					alertMessage: "Menu subscription closed before becoming ready...",
				},
			});

			return {
				close: async () => {},
			} satisfies BillSubscription;
		}

		return {
			close: async () => {
				subscriptionResult.value.close();
			},
		} satisfies BillSubscription;
	}
}
