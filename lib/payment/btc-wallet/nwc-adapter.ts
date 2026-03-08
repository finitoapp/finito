import type { BtcWalletAdapter } from "@/lib/payment/btc-wallet/types";

export const nwcBtcWalletAdapter: BtcWalletAdapter<"accountNwc"> = {
	tag: "accountNwc",

	async payInvoice(_params) {
		throw new Error("TODO: implement NWC payInvoice");
	},

	async receiveInvoice(_params) {
		throw new Error("TODO: implement NWC receiveInvoice");
	},
};
