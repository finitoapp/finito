import type { Id } from "@evolu/common";
import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaymentStatus } from "@/hooks/use-payment-status";

export const PaymentStatusBadge: FC<{
	paymentId: Id;
}> = (props) => {
	const paymentStatus = usePaymentStatus(props);

	if (paymentStatus === null) {
		return <Skeleton />;
	}

	return (
		<Badge variant={paymentStatus === "unpaid" ? "primary" : "success"}>
			{paymentStatus}
		</Badge>
	);
};
