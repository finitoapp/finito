import type { BillDriver, BillSubscription } from "@/lib/bill/billDriver";
import { NostrMenu as NostrMenuSchema } from "@/lib/contracts/nostr/menu";
import { menuStorage } from "@/lib/menu-storage";

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
			(data) => {
				const result = NostrMenuSchema.safeParse(data);
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

		return {
			refresh: async () => {},
			close: async () => {
				subscription.close();
			},
		} satisfies BillSubscription;
	}
}
