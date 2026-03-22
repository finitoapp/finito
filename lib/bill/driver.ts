import type NDK from "@nostr-dev-kit/ndk";
import type { NDKSigner, NDKUser } from "@nostr-dev-kit/ndk";
import type { TFunction } from "i18next";
import type { Menu } from "@/lib/contracts/menu";
import type { Payment } from "@/lib/contracts/payment";
import type { ReservationFormData } from "@/lib/contracts/reservation";
import type { TablePaymentRequest } from "@/lib/contracts/table";
import type { PaymentMerchant } from "@/lib/evolu/model/payment";
import type {
	Currency,
	InferEnumType,
	Integer,
	NonNegativeInteger,
} from "@/lib/shared/types";

export const BillPaymentOption = {
	BtcLn: "btcLn",
	BankTransferCZ: "bankTransferCZ",
} as const;
export type BillPaymentOption = InferEnumType<typeof BillPaymentOption>;

export type BillSubscription = {
	close: () => Promise<void>;
};

export type ScreenDataPaymentPayFunction = (
	params: TablePaymentRequest,
) => Promise<void>;

export type ScreenData =
	| {
			variant: "payment";
			parentScreen?: ScreenData;
			payload: Payment;
	  }
	| {
			variant: "menu";
			parentScreen?: ScreenData;
			payload: Menu;
	  }
	| {
			variant: "table";
			parentScreen?: ScreenData;
			pay: ScreenDataPaymentPayFunction;
			payload: {
				table?: {
					name: string;
				};
				merchant?: PaymentMerchant;
				// Null when the bill does not exist
				bill: null | {
					currency: Currency;
					allowTip?: boolean;
					itemLines: {
						quantity: number;
						optionality?: {
							checked: NonNegativeInteger;
						};
						item: {
							id: string;
							label: string;
							price: Integer;
						};
					}[];
				};
			};
	  }
	| {
			variant: "reservation";
			parentScreen?: ScreenData;
			payload: ReservationFormData;
	  }
	| {
			variant: "loading";
			parentScreen?: ScreenData;
			payload: {
				text: string | null;
				status?: "loading" | "success" | "failure"; // loading is default
			};
	  }
	| {
			variant: "info";
			parentScreen?: ScreenData;
			payload: {
				text: string | null;
				status?: "loading" | "success" | "failure"; // loading is default
			};
	  };

export type BillDriverSubscriptionEvent = {
	type: "close";
	payload: {
		alertMessage: string;
	};
};

export interface BillDriver {
	/**
	 * Returns null when the driver doesn't support this bill
	 */
	subscribe(props: {
		billId: string;
		callback: (event: BillDriverSubscriptionEvent) => unknown;
		screenStack: {
			push: (screen: ScreenData) => {
				replace: (screen: ScreenData) => void;
			};
			replaceLast: (screen: ScreenData) => {
				replace: (screen: ScreenData) => void;
			};
			back: () => void;
		};
		ndk: NDK & {
			signer: NDKSigner;
			activeUser: NDKUser;
		};
		t: TFunction;
	}): Promise<null | BillSubscription>;
}
