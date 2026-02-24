import * as errore from "errore";
import type { BillDriver, BillSubscription } from "@/lib/bill/driver";
import { NostrMenu as NostrMenuSchema } from "@/lib/nostr/contracts/menu";
import { menuStorage } from "@/lib/menu/nostr-storage";

const menuBillIdRegex = /^(m|menu|menus)-([0-9a-f]{64})$/i;

export class MenuDriver implements BillDriver {
	public async subscribe({
		billId,
		callback,
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

		callback({
			type: "billLoading",
			payload: {
				text: "Loading menu...",
			},
		});

		const subscription = await menuStorage.subscribe(
			{
				ndk,
				pubkey: pubkey.toLowerCase(),
			},
			(resultOrError) => {
				if (errore.isError(resultOrError)) {
					console.error(resultOrError);
					return;
				}

				const result = NostrMenuSchema.safeParse(resultOrError);
				if (!result.success) {
					console.error(result.error);
					callback({
						type: "billLoading",
						payload: {
							text: "Menu has an invalid structure...",
						},
					});
					return;
				}

				callback({
					type: "screen",
					payload: {
						variant: "menu",
						payload: result.data,
					},
				});
			},
		);

		if (errore.isError(subscription)) {
			console.error(subscription);
			callback({
				type: "billLoading",
				payload: {
					text: "Menu subscription closed before becoming ready...",
				},
			});

			return {
				refresh: async () => {},
				close: async () => {},
			} satisfies BillSubscription;
		}

		return {
			refresh: async () => {},
			close: async () => {
				subscription.close();
			},
		} satisfies BillSubscription;
	}
}
