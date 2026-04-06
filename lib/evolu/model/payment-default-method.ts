import type { InferEnumType } from "@/lib/shared/types";

export const PaymentDefaultMethodType = {
	Cash: "cash",
	BtcLn: "btcLn",
	BankTransferCZ: "bankTransferCZ",
} as const;

export type PaymentDefaultMethodType = InferEnumType<
	typeof PaymentDefaultMethodType
>;

export type PaymentDefaultMethodAccountTag =
	| "accountIban"
	| "accountLud16"
	| "accountSpark"
	| "accountNwc"
	| "accountCashRegister";

export const paymentDefaultMethodAllowedAccountTags = {
	[PaymentDefaultMethodType.Cash]: ["accountCashRegister"],
	[PaymentDefaultMethodType.BtcLn]: [
		"accountLud16",
		"accountSpark",
		"accountNwc",
	],
	[PaymentDefaultMethodType.BankTransferCZ]: ["accountIban"],
} as const satisfies Record<
	PaymentDefaultMethodType,
	readonly PaymentDefaultMethodAccountTag[]
>;

export const isPaymentDefaultMethodAccountTagAllowed = (params: {
	type: PaymentDefaultMethodType;
	accountTag: PaymentDefaultMethodAccountTag | null | undefined;
}) =>
	params.accountTag !== null &&
	params.accountTag !== undefined &&
	paymentDefaultMethodAllowedAccountTags[params.type].some(
		(accountTag) => accountTag === params.accountTag,
	);
