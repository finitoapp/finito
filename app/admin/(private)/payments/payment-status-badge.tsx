import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaymentStatus } from "@/hooks/use-payment-status";
import type { Uuid7 } from "@/lib/types";

export const PaymentStatusBadge: FC<{
	paymentId: Uuid7;
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
