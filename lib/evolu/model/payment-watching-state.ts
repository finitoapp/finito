import type { InferEnumType } from "@/lib/shared/types";

export const PaymentWatchingStatus = {
	Watching: "watching",
	Verified: "verified",
	Stopped: "stopped",
} as const;
export type PaymentWatchingStatus = InferEnumType<typeof PaymentWatchingStatus>;

export const resolvePaymentWatchingStatus = (params: {
	verifiedAt: number | null;
	stoppedAt: number | null;
}): PaymentWatchingStatus =>
	params.verifiedAt !== null
		? PaymentWatchingStatus.Verified
		: params.stoppedAt !== null
			? PaymentWatchingStatus.Stopped
			: PaymentWatchingStatus.Watching;

export const PaymentWatchingStopReason = {
	Manual: "manual",
	Timeout: "timeout",
	Deleted: "deleted",
	Replaced: "replaced",
	Error: "error",
} as const;
export type PaymentWatchingStopReason = InferEnumType<
	typeof PaymentWatchingStopReason
>;
