import type NDK from "@nostr-dev-kit/ndk";
import type { NDKSigner, NDKUser } from "@nostr-dev-kit/ndk";
import type { TFunction } from "i18next";
import type { EmptyObject } from "type-fest";
import type { NostrMenu } from "@/lib/contracts/nostr/menu";
import type { ReservationFormData } from "@/lib/contracts/nostr/reservation";
import type { InferEnumType } from "@/lib/types";
import type {
	PaymentFinished,
	PaymentInit,
	PaymentReady,
} from "@/storages/payment-progress-storage";
import type { Bill, PaymentMerchant } from "@/storages/payment-storage";

export const BillPaymentOption = {
	BtcLn: "btcLn",
	BankTransferCZ: "bankTransferCZ",
} as const;
export type BillPaymentOption = InferEnumType<typeof BillPaymentOption>;

export type BillSubscription = {
	close: () => Promise<void>;
	refresh: () => Promise<void>;
};

export type ScreenDataPaymentPayFunction = (
	params: PaymentInit,
) => Promise<void>;

export type ScreenData =
	| {
			variant: "payment" | "refund"; // Default payment
			parentScreen?: ScreenData;
			pay: ScreenDataPaymentPayFunction;
			payload: {
				bill: Bill | null; // Null when the bill does not exist
				allowManualRefresh?: boolean;
				table?: {
					name: string;
				};
				merchant?: PaymentMerchant;
				paymentOptions?: (
					| {
							type: (typeof BillPaymentOption)["BtcLn"];
					  }
					| {
							type: (typeof BillPaymentOption)["BankTransferCZ"];
					  }
				)[];
			};
	  }
	| {
			variant: "paymentReady";
			parentScreen?: ScreenData;
			payload: PaymentReady;
	  }
	| {
			variant: "paymentFinished";
			payload: PaymentFinished;
	  }
	| {
			variant: "menu";
			parentScreen?: ScreenData;
			payload: NostrMenu;
	  }
	| {
			variant: "reservation";
			parentScreen?: ScreenData;
			payload: ReservationFormData;
	  };

export type BillDriverSubscriptionEvent =
	| {
			type: "billLoading";
			payload: {
				text: string;
			};
	  }
	| {
			type: "screen";
			payload: ScreenData;
	  }
	| {
			type: "paymentInProgress";
			payload: {
				text: string | null;
			};
	  }
	| {
			type: "closed";
			payload: EmptyObject;
	  }
	| {
			type: "resetBill";
			payload: EmptyObject;
	  };

export interface BillDriver {
	/**
	 * Returns null when the driver doesn't support this bill
	 */
	subscribe(props: {
		billId: string;
		callback: (event: BillDriverSubscriptionEvent) => unknown;
		ndk: NDK & {
			signer: NDKSigner;
			activeUser: NDKUser;
		};
		t: TFunction;
	}): Promise<null | BillSubscription>;
}
