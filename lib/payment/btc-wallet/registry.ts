import type { EvoluSchemaType } from "@/lib/evolu";
import { nwcBtcWalletAdapter } from "@/lib/payment/btc-wallet/nwc-adapter";
import { sparkBtcWalletAdapter } from "@/lib/payment/btc-wallet/spark-adapter";
import type { BtcWalletAdapter } from "@/lib/payment/btc-wallet/types";

const createBtcWalletAdapter = <T extends keyof EvoluSchemaType>(
	btcWalletAdapter: BtcWalletAdapter<T>,
): Record<T, BtcWalletAdapter<T>> =>
	({
		[btcWalletAdapter.tag]: btcWalletAdapter,
	}) as const as Record<T, BtcWalletAdapter<T>>;

const btcWalletAdapters = {
	...createBtcWalletAdapter(sparkBtcWalletAdapter),
	...createBtcWalletAdapter(nwcBtcWalletAdapter),
} as const;

export const getBtcWalletAdapter = <
	TTag extends keyof typeof btcWalletAdapters,
>(
	tag: TTag,
): BtcWalletAdapter<TTag> => btcWalletAdapters[tag] as BtcWalletAdapter<TTag>;
