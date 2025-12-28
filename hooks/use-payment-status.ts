import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import type { Uuid7 } from "@/lib/types";
import { paymentStatusStorage } from "@/storages/payment-status-storage";

export const usePaymentStatus = (props: { paymentId: Uuid7 }) => {
	const { data: paymentStates } = useStorageSubscription(paymentStatusStorage, {
		limit: 1,
		key: props.paymentId,
	});

	const paymentStatus = paymentStates ? paymentStates[0] : undefined;
	if (paymentStatus === undefined) {
		return null;
	}

	return paymentStatus.value.status;
};
